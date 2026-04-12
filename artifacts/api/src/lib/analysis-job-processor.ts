import { normalizeRepoInput } from "@repo-guardian/github";
import type { GitHubReadClient } from "@repo-guardian/github";
import type {
  AnalysisJobRepository,
  AnalysisRunRepository,
  TrackedRepositoryRepository
} from "@repo-guardian/persistence";
import { analyzeRepository } from "./analyze-repository.js";
import {
  getAnalysisJobRepository,
  getAnalysisRunRepository,
  getTrackedRepositoryRepository
} from "./persistence.js";

type ReadClientLike = GitHubReadClient;

type AnalysisJobProcessorDependencies = {
  analysisJobRepository: Pick<
    AnalysisJobRepository,
    "claimNextQueuedJob" | "completeJob" | "enqueueJob" | "failJob" | "getJob"
  >;
  analyzeRepository: typeof analyzeRepository;
  readClient: ReadClientLike;
  runRepository: Pick<AnalysisRunRepository, "saveRun">;
  trackedRepositoryRepository: Pick<TrackedRepositoryRepository, "getRepository">;
};

export class AnalysisJobProcessor {
  private processing = false;
  private needsDrain = false;
  private readonly dependencies: AnalysisJobProcessorDependencies;

  constructor(dependencies: AnalysisJobProcessorDependencies) {
    this.dependencies = dependencies;
  }

  async enqueueAdHoc(input: {
    label?: string | null;
    repoInput: string;
    requestedByUserId: string | null;
  }) {
    const normalized = normalizeRepoInput(input.repoInput);
    const job = await this.dependencies.analysisJobRepository.enqueueJob({
      label: input.label,
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
      label: repository.label,
      repoInput: repository.fullName,
      repositoryFullName: repository.fullName,
      requestedByUserId: input.requestedByUserId,
      trackedRepositoryId: repository.id
    });

    this.kick();
    return job;
  }

  async getJob(jobId: string) {
    return this.dependencies.analysisJobRepository.getJob(jobId);
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

  private async drain(): Promise<void> {
    try {
      for (;;) {
        const job = await this.dependencies.analysisJobRepository.claimNextQueuedJob();

        if (!job) {
          return;
        }

        try {
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

export function getAnalysisJobProcessor(input: { readClient: ReadClientLike }) {
  processor ??= new AnalysisJobProcessor({
    analysisJobRepository: getAnalysisJobRepository(),
    analyzeRepository,
    readClient: input.readClient,
    runRepository: getAnalysisRunRepository(),
    trackedRepositoryRepository: getTrackedRepositoryRepository()
  });

  return processor;
}
