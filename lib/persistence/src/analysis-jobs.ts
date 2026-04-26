import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  AnalysisJobSchema,
  type AnalysisJob,
  type AnalysisJobKind
} from "@repo-guardian/shared-types";
import type { PostgresClient, PostgresSession } from "./client.js";
import { PersistenceError } from "./errors.js";
import { resolveWorkspaceId } from "./scope.js";

type AnalysisJobRow = QueryResultRow & {
  attempt_count: number;
  completed_at: Date | string | null;
  error_message: string | null;
  failed_at: Date | string | null;
  github_installation_id: string | null;
  job_id: string;
  job_kind: string;
  job_payload: unknown;
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
  workspace_id: string;
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
    githubInstallationId: row.github_installation_id,
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
    updatedAt: toIsoString(row.updated_at),
    workspaceId: row.workspace_id
  });
}

function assertValidJobId(jobId: string): void {
  if (!/^[a-z0-9._:-]+$/iu.test(jobId)) {
    throw new PersistenceError("invalid_job_id", "Analysis job id is invalid.");
  }
}

async function getJobRow(
  executor: PostgresClient | PostgresSession,
  jobId: string
): Promise<AnalysisJobRow> {
  const result = await executor.query<AnalysisJobRow>(
    `SELECT
      job_id,
      workspace_id,
      github_installation_id,
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
      updated_at,
      job_payload
    FROM analysis_jobs
    WHERE job_id = $1`,
    [jobId]
  );

  if (result.rows.length === 0) {
    throw new PersistenceError("not_found", "Analysis job was not found.");
  }

  return result.rows[0]!;
}

export type StoredAnalysisJob = {
  githubInstallationId?: string | null;
  jobKind: AnalysisJobKind;
  label?: string | null;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
  planId?: string | null;
  repoInput: string;
  repositoryFullName: string;
  requestedByUserId: string | null;
  scheduledSweepId?: string | null;
  trackedRepositoryId?: string | null;
  workspaceId?: string | null;
};

export class AnalysisJobRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async enqueueJob(input: StoredAnalysisJob): Promise<AnalysisJob> {
    const now = new Date().toISOString();
    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    return this.client.transaction(async (session) => {
      const workspaceId = resolveWorkspaceId(input.workspaceId);
      const result = await session.query<AnalysisJobRow>(
        `INSERT INTO analysis_jobs (
          job_id,
          workspace_id,
          github_installation_id,
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
          updated_at,
          job_payload
        ) VALUES (
          $1, $2, $3, $4, 'queued', $5, $6, $7, $8, $9, $10, 0, $11,
          NULL, $12, NULL, $13, NULL, NULL, NULL, $13, $14::jsonb
        )
        RETURNING
          job_id,
          workspace_id,
          github_installation_id,
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
          updated_at,
          job_payload`,
        [
          jobId,
          workspaceId,
          input.githubInstallationId ?? null,
          input.jobKind,
          input.repoInput,
          input.repositoryFullName,
          input.trackedRepositoryId ?? null,
          input.scheduledSweepId ?? null,
          input.requestedByUserId,
          input.label?.trim() ? input.label.trim() : null,
          input.maxAttempts ?? 1,
          input.planId ?? null,
          now,
          JSON.stringify(input.payload ?? {})
        ]
      );

      if (input.trackedRepositoryId) {
        const trackedRepositoryUpdate = await session.query(
          `UPDATE tracked_repositories
          SET
            last_queued_at = $2,
            updated_at = $2
          WHERE tracked_repository_id = $1`,
          [input.trackedRepositoryId, now]
        );

        if (trackedRepositoryUpdate.rowCount !== 1) {
          throw new PersistenceError("not_found", "Tracked repository was not found.");
        }
      }

      return parseAnalysisJob(result.rows[0]!);
    });
  }

  async getJob(jobId: string, workspaceId?: string | null): Promise<AnalysisJob> {
    assertValidJobId(jobId);
    const row = await getJobRow(this.client, jobId);
    if (row.workspace_id !== resolveWorkspaceId(workspaceId)) {
      throw new PersistenceError("not_found", "Analysis job was not found.");
    }
    return parseAnalysisJob(row);
  }

  async getJobPayload(jobId: string): Promise<Record<string, unknown>> {
    assertValidJobId(jobId);
    const row = await getJobRow(this.client, jobId);

    return row.job_payload && typeof row.job_payload === "object"
      ? (row.job_payload as Record<string, unknown>)
      : {};
  }

  async listJobs(options: {
    limit?: number;
    repositoryFullName?: string;
    status?: AnalysisJob["status"];
    trackedRepositoryId?: string;
    workspaceId?: string | null;
  } = {}): Promise<AnalysisJob[]> {
    const values: unknown[] = [];
    const filters: string[] = [];
    values.push(resolveWorkspaceId(options.workspaceId));
    filters.push(`workspace_id = $${values.length}`);

    if (options.status) {
      values.push(options.status);
      filters.push(`status = $${values.length}`);
    }

    if (options.repositoryFullName) {
      values.push(options.repositoryFullName);
      filters.push(`repository_full_name = $${values.length}`);
    }

    if (options.trackedRepositoryId) {
      values.push(options.trackedRepositoryId);
      filters.push(`tracked_repository_id = $${values.length}`);
    }

    values.push(options.limit ?? 50);

    const result = await this.client.query<AnalysisJobRow>(
      `SELECT
        job_id,
        workspace_id,
        github_installation_id,
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
        updated_at,
        job_payload
      FROM analysis_jobs
      ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY queued_at DESC, job_id DESC
      LIMIT $${values.length}`,
      values
    );

    return result.rows.map(parseAnalysisJob);
  }

  async claimNextQueuedJob(): Promise<AnalysisJob | null> {
    return this.client.transaction(async (session) => {
      const claimed = await session.query<AnalysisJobRow>(
        `WITH next_job AS (
          SELECT job_id
          FROM analysis_jobs
          WHERE status = 'queued'
          ORDER BY queued_at ASC, job_id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE analysis_jobs
        SET
          status = 'running',
          attempt_count = attempt_count + 1,
          started_at = NOW(),
          updated_at = NOW()
        WHERE job_id IN (SELECT job_id FROM next_job)
        RETURNING
          job_id,
          workspace_id,
          github_installation_id,
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
          updated_at,
          job_payload`
      );

      return claimed.rows[0] ? parseAnalysisJob(claimed.rows[0]) : null;
    });
  }

  async completeJob(input: {
    jobId: string;
    planId?: string | null;
    runId?: string | null;
  }): Promise<AnalysisJob> {
    assertValidJobId(input.jobId);
    const result = await this.client.query<AnalysisJobRow>(
      `UPDATE analysis_jobs
      SET
        status = 'completed',
        run_id = COALESCE($2, run_id),
        plan_id = COALESCE($3, plan_id),
        error_message = NULL,
        completed_at = NOW(),
        failed_at = NULL,
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING
        job_id,
        workspace_id,
        github_installation_id,
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
        updated_at,
        job_payload`,
      [input.jobId, input.runId ?? null, input.planId ?? null]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Analysis job was not found.");
    }

    return parseAnalysisJob(result.rows[0]!);
  }

  async failJob(input: { errorMessage: string; jobId: string }): Promise<AnalysisJob> {
    assertValidJobId(input.jobId);
    const result = await this.client.query<AnalysisJobRow>(
      `UPDATE analysis_jobs
      SET
        status = 'failed',
        error_message = $2,
        failed_at = NOW(),
        completed_at = NULL,
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING
        job_id,
        workspace_id,
        github_installation_id,
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
        updated_at,
        job_payload`,
      [input.jobId, input.errorMessage]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Analysis job was not found.");
    }

    return parseAnalysisJob(result.rows[0]!);
  }

  async cancelJob(jobId: string): Promise<AnalysisJob> {
    assertValidJobId(jobId);
    const result = await this.client.query<AnalysisJobRow>(
      `UPDATE analysis_jobs
      SET
        status = 'cancelled',
        completed_at = NOW(),
        failed_at = NULL,
        error_message = NULL,
        updated_at = NOW()
      WHERE job_id = $1 AND status = 'queued'
      RETURNING
        job_id,
        workspace_id,
        github_installation_id,
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
        updated_at,
        job_payload`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError(
        "conflict",
        "Only queued analysis jobs can be cancelled."
      );
    }

    return parseAnalysisJob(result.rows[0]!);
  }

  async retryJob(jobId: string): Promise<AnalysisJob> {
    assertValidJobId(jobId);
    const result = await this.client.query<AnalysisJobRow>(
      `UPDATE analysis_jobs
      SET
        status = 'queued',
        error_message = NULL,
        started_at = NULL,
        completed_at = NULL,
        failed_at = NULL,
        updated_at = NOW()
      WHERE job_id = $1 AND status IN ('failed', 'cancelled')
      RETURNING
        job_id,
        workspace_id,
        github_installation_id,
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
        updated_at,
        job_payload`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError(
        "conflict",
        "Only failed or cancelled analysis jobs can be retried."
      );
    }

    return parseAnalysisJob(result.rows[0]!);
  }
}
