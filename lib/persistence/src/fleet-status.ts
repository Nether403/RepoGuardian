import type { QueryResultRow } from "pg";
import {
  AnalysisJobSchema,
  FleetStatusResponseSchema,
  SavedAnalysisRunSummarySchema,
  TrackedPullRequestSchema,
  TrackedRepositorySchema,
  type AnalysisJob,
  type FleetStatusResponse,
  type SavedAnalysisRunSummary,
  type TrackedPullRequest
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";

type FleetTrackedRepositoryRow = QueryResultRow & {
  blocked_patch_plans: number | null;
  created_at: Date | string;
  default_branch: string | null;
  executable_patch_plans: number | null;
  fetched_at: Date | string | null;
  high_severity_findings: number | null;
  is_active: boolean;
  issue_candidates: number | null;
  job_attempt_count: number | null;
  job_completed_at: Date | string | null;
  job_error_message: string | null;
  job_failed_at: Date | string | null;
  job_id: string | null;
  job_kind: string | null;
  job_label: string | null;
  job_max_attempts: number | null;
  job_plan_id: string | null;
  job_queued_at: Date | string | null;
  job_repo_input: string | null;
  job_requested_by_user_id: string | null;
  job_run_id: string | null;
  job_scheduled_sweep_id: string | null;
  job_started_at: Date | string | null;
  job_status: string | null;
  job_updated_at: Date | string | null;
  label: string | null;
  last_queued_at: Date | string | null;
  latest_execution_completed_at: Date | string | null;
  latest_plan_id: string | null;
  latest_plan_status: string | null;
  pr_candidates: number | null;
  repository_full_name: string;
  repository_owner: string;
  repository_repo: string;
  run_created_at: Date | string | null;
  run_id: string | null;
  stars: number | null;
  total_findings: number | null;
  updated_at: Date | string;
  canonical_url: string;
  tracked_repository_id: string;
};

type AnalysisJobRow = QueryResultRow & {
  attempt_count: number;
  completed_at: Date | string | null;
  error_message: string | null;
  failed_at: Date | string | null;
  job_id: string;
  job_kind: string;
  label: string | null;
  max_attempts: number;
  plan_id: string | null;
  queued_at: Date | string;
  repo_input: string;
  repository_full_name: string;
  requested_by_user_id: string | null;
  run_id: string | null;
  scheduled_sweep_id: string | null;
  started_at: Date | string | null;
  status: string;
  tracked_repository_id: string | null;
  updated_at: Date | string;
};

type TrackedPullRequestRow = QueryResultRow & {
  branch_name: string;
  closed_at: Date | string | null;
  created_at: Date | string;
  execution_id: string | null;
  lifecycle_status: string;
  merged_at: Date | string | null;
  plan_id: string | null;
  pull_request_number: number;
  pull_request_url: string;
  repository_full_name: string;
  repository_owner: string;
  repository_repo: string;
  title: string;
  tracked_pull_request_id: string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseAnalysisJob(row: AnalysisJobRow): AnalysisJob {
  return AnalysisJobSchema.parse({
    attemptCount: row.attempt_count,
    completedAt: toIsoString(row.completed_at),
    errorMessage: row.error_message,
    failedAt: toIsoString(row.failed_at),
    jobId: row.job_id,
    jobKind: row.job_kind,
    label: row.label,
    maxAttempts: row.max_attempts,
    planId: row.plan_id,
    queuedAt: toIsoString(row.queued_at),
    repoInput: row.repo_input,
    repositoryFullName: row.repository_full_name,
    requestedByUserId: row.requested_by_user_id,
    runId: row.run_id,
    scheduledSweepId: row.scheduled_sweep_id,
    startedAt: toIsoString(row.started_at),
    status: row.status,
    trackedRepositoryId: row.tracked_repository_id,
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseTrackedPullRequest(row: TrackedPullRequestRow): TrackedPullRequest {
  return TrackedPullRequestSchema.parse({
    branchName: row.branch_name,
    closedAt: toIsoString(row.closed_at),
    createdAt: toIsoString(row.created_at),
    executionId: row.execution_id,
    lifecycleStatus: row.lifecycle_status,
    mergedAt: toIsoString(row.merged_at),
    owner: row.repository_owner,
    planId: row.plan_id,
    pullRequestNumber: row.pull_request_number,
    pullRequestUrl: row.pull_request_url,
    repo: row.repository_repo,
    repositoryFullName: row.repository_full_name,
    title: row.title,
    trackedPullRequestId: row.tracked_pull_request_id,
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseLatestRun(row: FleetTrackedRepositoryRow): SavedAnalysisRunSummary | null {
  if (!row.run_id || !row.run_created_at || !row.fetched_at || row.total_findings === null) {
    return null;
  }

  return SavedAnalysisRunSummarySchema.parse({
    blockedPatchPlans: row.blocked_patch_plans ?? 0,
    createdAt: toIsoString(row.run_created_at),
    defaultBranch: row.default_branch ?? "main",
    executablePatchPlans: row.executable_patch_plans ?? 0,
    fetchedAt: toIsoString(row.fetched_at),
    highSeverityFindings: row.high_severity_findings ?? 0,
    id: row.run_id,
    issueCandidates: row.issue_candidates ?? 0,
    label: row.label,
    prCandidates: row.pr_candidates ?? 0,
    repositoryFullName: row.repository_full_name,
    totalFindings: row.total_findings,
    execution:
      row.latest_plan_id && row.latest_plan_status
        ? {
            latestExecutionCompletedAt: toIsoString(row.latest_execution_completed_at),
            latestPlanId: row.latest_plan_id,
            latestPlanStatus: row.latest_plan_status
          }
        : undefined
  });
}

export class FleetStatusRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async getFleetStatus(): Promise<FleetStatusResponse> {
    const [trackedRows, recentJobsResult, trackedPullRequestsResult] = await Promise.all([
      this.client.query<FleetTrackedRepositoryRow>(
        `SELECT
          tracked.tracked_repository_id,
          tracked.repository_full_name,
          tracked.repository_owner,
          tracked.repository_repo,
          tracked.canonical_url,
          tracked.label,
          tracked.is_active,
          tracked.created_at,
          tracked.updated_at,
          tracked.last_queued_at,
          runs.run_id,
          runs.created_at AS run_created_at,
          runs.default_branch,
          runs.fetched_at,
          runs.total_findings,
          runs.high_severity_findings,
          runs.issue_candidates,
          runs.pr_candidates,
          runs.executable_patch_plans,
          runs.blocked_patch_plans,
          plans.plan_id AS latest_plan_id,
          plans.status AS latest_plan_status,
          plans.completed_at AS latest_execution_completed_at,
          jobs.job_id,
          jobs.job_kind,
          jobs.status AS job_status,
          jobs.repo_input AS job_repo_input,
          jobs.requested_by_user_id AS job_requested_by_user_id,
          jobs.label AS job_label,
          jobs.attempt_count AS job_attempt_count,
          jobs.max_attempts AS job_max_attempts,
          jobs.run_id AS job_run_id,
          jobs.plan_id AS job_plan_id,
          jobs.error_message AS job_error_message,
          jobs.queued_at AS job_queued_at,
          jobs.started_at AS job_started_at,
          jobs.completed_at AS job_completed_at,
          jobs.failed_at AS job_failed_at,
          jobs.updated_at AS job_updated_at,
          jobs.scheduled_sweep_id AS job_scheduled_sweep_id,
          jobs.tracked_repository_id,
          0 AS stars
        FROM tracked_repositories AS tracked
        LEFT JOIN LATERAL (
          SELECT *
          FROM analysis_runs
          WHERE analysis_runs.repository_full_name = tracked.repository_full_name
          ORDER BY analysis_runs.created_at DESC
          LIMIT 1
        ) AS runs ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            execution_plans.plan_id,
            execution_plans.status,
            execution_plans.completed_at
          FROM execution_plans
          WHERE execution_plans.analysis_run_id = runs.run_id
          ORDER BY execution_plans.created_at DESC
          LIMIT 1
        ) AS plans ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            analysis_jobs.job_id,
            analysis_jobs.job_kind,
            analysis_jobs.status,
            analysis_jobs.repo_input,
            analysis_jobs.requested_by_user_id,
            analysis_jobs.label,
            analysis_jobs.attempt_count,
            analysis_jobs.max_attempts,
            analysis_jobs.run_id,
            analysis_jobs.plan_id,
            analysis_jobs.error_message,
            analysis_jobs.queued_at,
            analysis_jobs.started_at,
            analysis_jobs.completed_at,
            analysis_jobs.failed_at,
            analysis_jobs.updated_at,
            analysis_jobs.scheduled_sweep_id,
            analysis_jobs.tracked_repository_id
          FROM analysis_jobs
          WHERE analysis_jobs.repository_full_name = tracked.repository_full_name
          ORDER BY analysis_jobs.queued_at DESC
          LIMIT 1
        ) AS jobs ON TRUE
        ORDER BY tracked.updated_at DESC, tracked.repository_full_name ASC`
      ),
      this.client.query<AnalysisJobRow>(
        `SELECT
          job_id,
          job_kind,
          status,
          repo_input,
          repository_full_name,
          tracked_repository_id,
          scheduled_sweep_id,
          requested_by_user_id,
          label,
          attempt_count,
          max_attempts,
          run_id,
          plan_id,
          error_message,
          queued_at,
          started_at,
          completed_at,
          failed_at,
          updated_at
        FROM analysis_jobs
        ORDER BY queued_at DESC, job_id DESC
        LIMIT 25`
      ),
      this.client.query<TrackedPullRequestRow>(
        `SELECT
          tracked_pull_request_id,
          repository_full_name,
          repository_owner,
          repository_repo,
          pull_request_number,
          pull_request_url,
          branch_name,
          title,
          plan_id,
          execution_id,
          lifecycle_status,
          created_at,
          updated_at,
          closed_at,
          merged_at
        FROM tracked_pull_requests
        ORDER BY updated_at DESC, tracked_pull_request_id DESC`
      )
    ]);

    const staleThreshold = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const trackedRepositories = trackedRows.rows.map((row) => {
      const trackedRepository = TrackedRepositorySchema.parse({
        canonicalUrl: row.canonical_url,
        createdAt: toIsoString(row.created_at),
        fullName: row.repository_full_name,
        id: row.tracked_repository_id,
        isActive: row.is_active,
        label: row.label,
        lastQueuedAt: toIsoString(row.last_queued_at),
        owner: row.repository_owner,
        repo: row.repository_repo,
        updatedAt: toIsoString(row.updated_at)
      });
      const latestRun = parseLatestRun(row);
      const latestAnalysisJob = row.job_id
        ? parseAnalysisJob({
            attempt_count: row.job_attempt_count ?? 0,
            completed_at: row.job_completed_at,
            error_message: row.job_error_message,
            failed_at: row.job_failed_at,
            job_id: row.job_id,
            job_kind: row.job_kind ?? "analyze_repository",
            job_payload: {},
            label: row.job_label,
            max_attempts: row.job_max_attempts ?? 1,
            plan_id: row.job_plan_id,
            queued_at: row.job_queued_at!,
            repo_input: row.job_repo_input ?? row.repository_full_name,
            repository_full_name: row.repository_full_name,
            requested_by_user_id: row.job_requested_by_user_id,
            run_id: row.job_run_id,
            scheduled_sweep_id: row.job_scheduled_sweep_id,
            started_at: row.job_started_at,
            status: row.job_status ?? "queued",
            tracked_repository_id: row.tracked_repository_id,
            updated_at: row.job_updated_at!
          })
        : null;
      const stale =
        latestRun === null || new Date(latestRun.fetchedAt) < staleThreshold;
      const executablePatchPlans = latestRun?.executablePatchPlans ?? 0;
      const blockedPatchPlans = latestRun?.blockedPatchPlans ?? 0;

      return {
        latestAnalysisJob,
        latestPlanId: latestRun?.execution?.latestPlanId ?? null,
        latestPlanStatus: latestRun?.execution?.latestPlanStatus ?? null,
        latestRun,
        patchPlanCounts: stale
          ? {
              blocked: 0,
              executable: 0,
              stale: executablePatchPlans + blockedPatchPlans
            }
          : {
              blocked: blockedPatchPlans,
              executable: executablePatchPlans,
              stale: 0
            },
        stale,
        trackedRepository
      };
    });

    const recentJobs = recentJobsResult.rows.map(parseAnalysisJob);
    const trackedPullRequests = trackedPullRequestsResult.rows.map(parseTrackedPullRequest);

    return FleetStatusResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      recentJobs,
      summary: {
        blockedPatchPlans: trackedRepositories.reduce(
          (sum, repository) => sum + repository.patchPlanCounts.blocked,
          0
        ),
        executablePatchPlans: trackedRepositories.reduce(
          (sum, repository) => sum + repository.patchPlanCounts.executable,
          0
        ),
        failedJobs: recentJobs.filter((job) => job.status === "failed").length,
        mergedPullRequests: trackedPullRequests.filter(
          (pullRequest) => pullRequest.lifecycleStatus === "merged"
        ).length,
        openPullRequests: trackedPullRequests.filter(
          (pullRequest) => pullRequest.lifecycleStatus === "open"
        ).length,
        stalePatchPlans: trackedRepositories.reduce(
          (sum, repository) => sum + repository.patchPlanCounts.stale,
          0
        ),
        staleRepositories: trackedRepositories.filter((repository) => repository.stale)
          .length,
        trackedRepositories: trackedRepositories.length
      },
      trackedPullRequests,
      trackedRepositories
    });
  }
}
