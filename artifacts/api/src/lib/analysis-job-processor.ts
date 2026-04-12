import crypto from "node:crypto";
import type { GitHubReadClient } from "@repo-guardian/github";
import { normalizeRepoInput } from "@repo-guardian/github";
import { createExecutionPlanResult } from "@repo-guardian/execution";
import type {
  AnalysisJobRepository,
  AnalysisRunRepository,
  ExecutionPlanRepository,
  FleetStatusRepository,
  SweepScheduleRepository,
  TrackedPullRequestRepository,
  TrackedRepositoryRepository
} from "@repo-guardian/persistence";
import type {
  AnalysisJob,
  AsyncPlanSelectionStrategy,
  CreateSweepScheduleRequest,
  FleetStatusResponse,
  SweepSchedule
} from "@repo-guardian/shared-types";
import { analyzeRepository } from "./analyze-repository.js";
import {
  getAnalysisJobRepository,
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getFleetStatusRepository,
  getSweepScheduleRepository,
  getTrackedPullRequestRepository,
  getTrackedRepositoryRepository
} from "./persistence.js";

type AnalysisJobProcessorDependencies = {
  analysisJobRepository: Pick<
    AnalysisJobRepository,
    | "cancelJob"
    | "claimNextQueuedJob"
    | "completeJob"
    | "enqueueJob"
    | "failJob"
    | "getJob"
    | "getJobPayload"
    | "listJobs"
    | "retryJob"
  >;
  analyzeRepository: typeof analyzeRepository;
  executionPlanRepository: Pick<ExecutionPlanRepository, "savePlan">;
  fleetStatusRepository: Pick<FleetStatusRepository, "getFleetStatus">;
  readClient: GitHubReadClient;
  runRepository: Pick<AnalysisRunRepository, "getRun" | "saveRun">;
  sweepScheduleRepository: Pick<
    SweepScheduleRepository,
    "claimDueSchedules" | "createSchedule" | "getSchedule" | "listSchedules" | "markTriggered"
  >;
  trackedPullRequestRepository: Pick<
    TrackedPullRequestRepository,
    "listOpenTrackedPullRequests" | "listTrackedPullRequests" | "updateLifecycle"
  >;
  trackedRepositoryRepository: Pick<
    TrackedRepositoryRepository,
    "getRepository" | "listRepositories"
  >;
};

const approvalConfirmationText = "I approve this GitHub write-back plan.";

function hashActions(actions: unknown[]): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(actions)).digest("hex")}`;
}

function buildAutoPlanSelection(input: {
  analysis: Awaited<ReturnType<typeof analyzeRepository>>;
  selectionStrategy: AsyncPlanSelectionStrategy;
  selectedIssueCandidateIds?: string[];
  selectedPRCandidateIds?: string[];
}) {
  if (input.selectionStrategy === "provided_candidates") {
    return {
      selectedIssueCandidateIds: [...new Set(input.selectedIssueCandidateIds ?? [])].sort(),
      selectedPRCandidateIds: [...new Set(input.selectedPRCandidateIds ?? [])].sort()
    };
  }

  return {
    selectedIssueCandidateIds: [],
    selectedPRCandidateIds: input.analysis.prPatchPlans
      .filter((plan) => plan.writeBackEligibility?.status === "executable")
      .map((plan) => plan.prCandidateId)
      .sort((left, right) => left.localeCompare(right))
  };
}

export class AnalysisJobProcessor {
  private processing = false;
  private needsDrain = false;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private readonly dependencies: AnalysisJobProcessorDependencies;

  constructor(dependencies: AnalysisJobProcessorDependencies) {
    this.dependencies = dependencies;
  }

  startScheduler(intervalMs = 30_000): void {
    if (this.schedulerTimer) {
      return;
    }

    this.schedulerTimer = setInterval(() => {
      void this.pumpDueSchedules();
    }, intervalMs);
    this.schedulerTimer.unref();
    void this.pumpDueSchedules();
  }

  async enqueueAdHoc(input: {
    label?: string | null;
    repoInput: string;
    requestedByUserId: string | null;
  }) {
    const normalized = normalizeRepoInput(input.repoInput);
    const job = await this.dependencies.analysisJobRepository.enqueueJob({
      jobKind: "analyze_repository",
      label: input.label,
      payload: {
        enqueuePlanAfterRun: false
      },
      repoInput: normalized.fullName,
      repositoryFullName: normalized.fullName,
      requestedByUserId: input.requestedByUserId
    });

    this.kick();
    return job;
  }

  async enqueueTrackedRepositoryAnalysis(input: {
    requestedByUserId: string | null;
    trackedRepositoryId: string;
  }) {
    const repository = await this.dependencies.trackedRepositoryRepository.getRepository(
      input.trackedRepositoryId
    );
    const job = await this.dependencies.analysisJobRepository.enqueueJob({
      jobKind: "analyze_repository",
      label: repository.label,
      payload: {
        enqueuePlanAfterRun: false
      },
      repoInput: repository.fullName,
      repositoryFullName: repository.fullName,
      requestedByUserId: input.requestedByUserId,
      trackedRepositoryId: repository.id
    });

    this.kick();
    return job;
  }

  async enqueueExecutionPlanJob(input: {
    analysisRunId: string;
    requestedByUserId: string | null;
    selectionStrategy: AsyncPlanSelectionStrategy;
    selectedIssueCandidateIds?: string[];
    selectedPRCandidateIds?: string[];
    trackedRepositoryId?: string | null;
  }) {
    const run = await this.dependencies.runRepository.getRun(input.analysisRunId);
    const job = await this.dependencies.analysisJobRepository.enqueueJob({
      jobKind: "generate_execution_plan",
      label: run.run.label,
      payload: {
        analysisRunId: input.analysisRunId,
        selectedIssueCandidateIds: input.selectedIssueCandidateIds ?? [],
        selectedPRCandidateIds: input.selectedPRCandidateIds ?? [],
        selectionStrategy: input.selectionStrategy
      },
      repoInput: run.run.analysis.repository.fullName,
      repositoryFullName: run.run.analysis.repository.fullName,
      requestedByUserId: input.requestedByUserId,
      trackedRepositoryId: input.trackedRepositoryId ?? null
    });

    this.kick();
    return job;
  }

  async createSweepSchedule(
    input: CreateSweepScheduleRequest
  ): Promise<SweepSchedule> {
    return this.dependencies.sweepScheduleRepository.createSchedule({
      cadence: input.cadence,
      label: input.label,
      selectionStrategy: input.selectionStrategy
    });
  }

  async listSweepSchedules(): Promise<SweepSchedule[]> {
    return this.dependencies.sweepScheduleRepository.listSchedules();
  }

  async triggerSweepSchedule(input: {
    requestedByUserId: string | null;
    scheduleId: string;
  }): Promise<{ job: AnalysisJob; schedule: SweepSchedule }> {
    const schedule = await this.dependencies.sweepScheduleRepository.markTriggered(
      input.scheduleId
    );
    const job = await this.dependencies.analysisJobRepository.enqueueJob({
      jobKind: "run_scheduled_sweep",
      label: schedule.label,
      payload: {
        scheduleId: schedule.scheduleId,
        selectionStrategy: schedule.selectionStrategy
      },
      repoInput: "[scheduled-sweep]",
      repositoryFullName: "[scheduled-sweep]",
      requestedByUserId: input.requestedByUserId,
      scheduledSweepId: schedule.scheduleId
    });

    this.kick();
    return {
      job,
      schedule
    };
  }

  async listJobs(status?: AnalysisJob["status"]) {
    return this.dependencies.analysisJobRepository.listJobs({
      status
    });
  }

  async cancelJob(jobId: string) {
    return this.dependencies.analysisJobRepository.cancelJob(jobId);
  }

  async retryJob(jobId: string) {
    const job = await this.dependencies.analysisJobRepository.retryJob(jobId);
    this.kick();
    return job;
  }

  async getJob(jobId: string) {
    return this.dependencies.analysisJobRepository.getJob(jobId);
  }

  async getFleetStatus(): Promise<FleetStatusResponse> {
    await this.refreshOpenTrackedPullRequests();
    return this.dependencies.fleetStatusRepository.getFleetStatus();
  }

  private async refreshOpenTrackedPullRequests(): Promise<void> {
    const openPullRequests =
      await this.dependencies.trackedPullRequestRepository.listOpenTrackedPullRequests();

    for (const pullRequest of openPullRequests) {
      const lifecycle = await this.dependencies.readClient.fetchPullRequestLifecycle({
        owner: pullRequest.owner,
        pullRequestNumber: pullRequest.pullRequestNumber,
        repo: pullRequest.repo
      });
      const lifecycleStatus = lifecycle.merged
        ? "merged"
        : lifecycle.closedAt
          ? "closed"
          : "open";

      if (
        lifecycleStatus !== pullRequest.lifecycleStatus ||
        lifecycle.closedAt !== pullRequest.closedAt ||
        lifecycle.mergedAt !== pullRequest.mergedAt
      ) {
        await this.dependencies.trackedPullRequestRepository.updateLifecycle({
          closedAt: lifecycle.closedAt,
          lifecycleStatus,
          mergedAt: lifecycle.mergedAt,
          pullRequestNumber: pullRequest.pullRequestNumber,
          repositoryFullName: pullRequest.repositoryFullName,
          updatedAt: lifecycle.updatedAt
        });
      }
    }
  }

  private async pumpDueSchedules(): Promise<void> {
    const schedules = await this.dependencies.sweepScheduleRepository.claimDueSchedules();

    if (schedules.length === 0) {
      return;
    }

    for (const schedule of schedules) {
      await this.dependencies.analysisJobRepository.enqueueJob({
        jobKind: "run_scheduled_sweep",
        label: schedule.label,
        payload: {
          scheduleId: schedule.scheduleId,
          selectionStrategy: schedule.selectionStrategy
        },
        repoInput: "[scheduled-sweep]",
        repositoryFullName: "[scheduled-sweep]",
        requestedByUserId: null,
        scheduledSweepId: schedule.scheduleId
      });
    }

    this.kick();
  }

  private kick(): void {
    if (this.processing) {
      this.needsDrain = true;
      return;
    }

    this.processing = true;
    queueMicrotask(() => {
      void this.drain();
    });
  }

  private async handleAnalyzeJob(job: AnalysisJob, payload: Record<string, unknown>) {
    const analysis = await this.dependencies.analyzeRepository(
      this.dependencies.readClient,
      job.repoInput
    );
    const savedRun = await this.dependencies.runRepository.saveRun({
      analysis,
      label: job.label
    });

    await this.dependencies.analysisJobRepository.completeJob({
      jobId: job.jobId,
      runId: savedRun.run.id
    });

    if (payload.enqueuePlanAfterRun === true) {
      await this.dependencies.analysisJobRepository.enqueueJob({
        jobKind: "generate_execution_plan",
        label: job.label,
        payload: {
          analysisRunId: savedRun.run.id,
          selectionStrategy:
            payload.selectionStrategy === "provided_candidates"
              ? "provided_candidates"
              : "all_executable_prs",
          selectedIssueCandidateIds:
            Array.isArray(payload.selectedIssueCandidateIds)
              ? payload.selectedIssueCandidateIds
              : [],
          selectedPRCandidateIds:
            Array.isArray(payload.selectedPRCandidateIds)
              ? payload.selectedPRCandidateIds
              : []
        },
        repoInput: job.repoInput,
        repositoryFullName: job.repositoryFullName,
        requestedByUserId: job.requestedByUserId,
        trackedRepositoryId: job.trackedRepositoryId
      });
    }
  }

  private async handlePlanJob(job: AnalysisJob, payload: Record<string, unknown>) {
    const analysisRunId =
      typeof payload.analysisRunId === "string" ? payload.analysisRunId : job.runId;

    if (!analysisRunId) {
      throw new Error("Plan job is missing analysisRunId.");
    }

    const run = await this.dependencies.runRepository.getRun(analysisRunId);
    const selectionStrategy =
      payload.selectionStrategy === "provided_candidates"
        ? "provided_candidates"
        : "all_executable_prs";
    const selection = buildAutoPlanSelection({
      analysis: run.run.analysis,
      selectedIssueCandidateIds: Array.isArray(payload.selectedIssueCandidateIds)
        ? payload.selectedIssueCandidateIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      selectedPRCandidateIds: Array.isArray(payload.selectedPRCandidateIds)
        ? payload.selectedPRCandidateIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      selectionStrategy
    });
    const result = await createExecutionPlanResult({
      analysis: run.run.analysis,
      approvalGranted: false,
      mode: "dry_run",
      selectedIssueCandidateIds: selection.selectedIssueCandidateIds,
      selectedPRCandidateIds: selection.selectedPRCandidateIds
    });
    const createdAt = new Date().toISOString();
    const planId = `plan_${crypto.randomBytes(8).toString("hex")}`;
    const planHash = hashActions(result.actions);

    await this.dependencies.executionPlanRepository.savePlan({
      actions: result.actions,
      actorUserId: null,
      analysisRunId,
      approval: {
        confirmationText: approvalConfirmationText,
        required: true
      },
      createdAt,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      planHash,
      planId,
      repository: {
        defaultBranch: run.run.analysis.repository.defaultBranch,
        fullName: run.run.analysis.repository.fullName,
        owner: run.run.analysis.repository.owner,
        repo: run.run.analysis.repository.repo
      },
      selectedIssueCandidateIds: selection.selectedIssueCandidateIds,
      selectedPRCandidateIds: selection.selectedPRCandidateIds,
      summary: result.summary
    });
    await this.dependencies.analysisJobRepository.completeJob({
      jobId: job.jobId,
      planId,
      runId: analysisRunId
    });
  }

  private async handleScheduledSweepJob(
    job: AnalysisJob,
    payload: Record<string, unknown>
  ) {
    const trackedRepositories =
      await this.dependencies.trackedRepositoryRepository.listRepositories();
    const selectionStrategy =
      payload.selectionStrategy === "provided_candidates"
        ? "provided_candidates"
        : "all_executable_prs";

    for (const repository of trackedRepositories.filter((entry) => entry.isActive)) {
      await this.dependencies.analysisJobRepository.enqueueJob({
        jobKind: "analyze_repository",
        label: repository.label ?? job.label,
        payload: {
          enqueuePlanAfterRun: true,
          selectionStrategy
        },
        repoInput: repository.fullName,
        repositoryFullName: repository.fullName,
        requestedByUserId: job.requestedByUserId,
        scheduledSweepId: job.scheduledSweepId,
        trackedRepositoryId: repository.id
      });
    }

    await this.dependencies.analysisJobRepository.completeJob({
      jobId: job.jobId
    });
  }

  private async drain(): Promise<void> {
    try {
      for (;;) {
        const job = await this.dependencies.analysisJobRepository.claimNextQueuedJob();

        if (!job) {
          return;
        }

        const payload = await this.dependencies.analysisJobRepository.getJobPayload(
          job.jobId
        );

        try {
          switch (job.jobKind) {
            case "analyze_repository":
              await this.handleAnalyzeJob(job, payload);
              break;
            case "generate_execution_plan":
              await this.handlePlanJob(job, payload);
              break;
            case "run_scheduled_sweep":
              await this.handleScheduledSweepJob(job, payload);
              break;
          }
        } catch (error) {
          await this.dependencies.analysisJobRepository.failJob({
            errorMessage:
              error instanceof Error ? error.message : "Unexpected analysis job failure",
            jobId: job.jobId
          });
        }
      }
    } finally {
      this.processing = false;

      if (this.needsDrain) {
        this.needsDrain = false;
        this.kick();
      }
    }
  }
}

let processor: AnalysisJobProcessor | null = null;

export function getAnalysisJobProcessor(input: { readClient: GitHubReadClient }) {
  processor ??= new AnalysisJobProcessor({
    analysisJobRepository: getAnalysisJobRepository(),
    analyzeRepository,
    executionPlanRepository: getExecutionPlanRepository(),
    fleetStatusRepository: getFleetStatusRepository(),
    readClient: input.readClient,
    runRepository: getAnalysisRunRepository(),
    sweepScheduleRepository: getSweepScheduleRepository(),
    trackedPullRequestRepository: getTrackedPullRequestRepository(),
    trackedRepositoryRepository: getTrackedRepositoryRepository()
  });

  processor.startScheduler();

  return processor;
}
