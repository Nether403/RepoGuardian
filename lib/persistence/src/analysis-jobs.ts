import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { AnalysisJobSchema, type AnalysisJob } from "@repo-guardian/shared-types";
import type { PostgresClient, PostgresSession } from "./client.js";
import { PersistenceError } from "./errors.js";

type AnalysisJobRow = QueryResultRow & {
  attempt_count: number;
  completed_at: Date | string | null;
  error_message: string | null;
  failed_at: Date | string | null;
  job_id: string;
  job_kind: string;
  label: string | null;
  max_attempts: number;
  queued_at: Date | string;
  repo_input: string;
  repository_full_name: string;
  requested_by_user_id: string | null;
  run_id: string | null;
  started_at: Date | string | null;
  status: string;
  tracked_repository_id: string | null;
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
    queuedAt: toIsoString(row.queued_at),
    repoInput: row.repo_input,
    repositoryFullName: row.repository_full_name,
    requestedByUserId: row.requested_by_user_id,
    runId: row.run_id,
    startedAt: toIsoString(row.started_at),
    status: row.status,
    trackedRepositoryId: row.tracked_repository_id,
    updatedAt: toIsoString(row.updated_at)
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
      job_kind,
      status,
      repo_input,
      repository_full_name,
      tracked_repository_id,
      requested_by_user_id,
      label,
      attempt_count,
      max_attempts,
      run_id,
      error_message,
      queued_at,
      started_at,
      completed_at,
      failed_at,
      updated_at
    FROM analysis_jobs
    WHERE job_id = $1`,
    [jobId]
  );

  if (result.rows.length === 0) {
    throw new PersistenceError("not_found", "Analysis job was not found.");
  }

  return result.rows[0]!;
}

export class AnalysisJobRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async enqueueJob(input: {
    label?: string | null;
    maxAttempts?: number;
    repoInput: string;
    repositoryFullName: string;
    requestedByUserId: string | null;
    trackedRepositoryId?: string | null;
  }): Promise<AnalysisJob> {
    const now = new Date().toISOString();
    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    return this.client.transaction(async (session) => {
      const result = await session.query<AnalysisJobRow>(
        `INSERT INTO analysis_jobs (
          job_id,
          job_kind,
          status,
          repo_input,
          repository_full_name,
          tracked_repository_id,
          requested_by_user_id,
          label,
          attempt_count,
          max_attempts,
          run_id,
          error_message,
          queued_at,
          started_at,
          completed_at,
          failed_at,
          updated_at
        ) VALUES (
          $1,
          'analyze_repository',
          'queued',
          $2,
          $3,
          $4,
          $5,
          $6,
          0,
          $7,
          NULL,
          NULL,
          $8,
          NULL,
          NULL,
          NULL,
          $8
        )
        RETURNING
          job_id,
          job_kind,
          status,
          repo_input,
          repository_full_name,
          tracked_repository_id,
          requested_by_user_id,
          label,
          attempt_count,
          max_attempts,
          run_id,
          error_message,
          queued_at,
          started_at,
          completed_at,
          failed_at,
          updated_at`,
        [
          jobId,
          input.repoInput,
          input.repositoryFullName,
          input.trackedRepositoryId ?? null,
          input.requestedByUserId,
          input.label?.trim() ? input.label.trim() : null,
          input.maxAttempts ?? 1,
          now
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

  async getJob(jobId: string): Promise<AnalysisJob> {
    assertValidJobId(jobId);
    return parseAnalysisJob(await getJobRow(this.client, jobId));
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
          job_kind,
          status,
          repo_input,
          repository_full_name,
          tracked_repository_id,
          requested_by_user_id,
          label,
          attempt_count,
          max_attempts,
          run_id,
          error_message,
          queued_at,
          started_at,
          completed_at,
          failed_at,
          updated_at`
      );

      return claimed.rows[0] ? parseAnalysisJob(claimed.rows[0]) : null;
    });
  }

  async completeJob(input: { jobId: string; runId: string }): Promise<AnalysisJob> {
    assertValidJobId(input.jobId);
    const result = await this.client.query<AnalysisJobRow>(
      `UPDATE analysis_jobs
      SET
        status = 'completed',
        run_id = $2,
        error_message = NULL,
        completed_at = NOW(),
        failed_at = NULL,
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING
        job_id,
        job_kind,
        status,
        repo_input,
        repository_full_name,
        tracked_repository_id,
        requested_by_user_id,
        label,
        attempt_count,
        max_attempts,
        run_id,
        error_message,
        queued_at,
        started_at,
        completed_at,
        failed_at,
        updated_at`,
      [input.jobId, input.runId]
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
        job_kind,
        status,
        repo_input,
        repository_full_name,
        tracked_repository_id,
        requested_by_user_id,
        label,
        attempt_count,
        max_attempts,
        run_id,
        error_message,
        queued_at,
        started_at,
        completed_at,
        failed_at,
        updated_at`,
      [input.jobId, input.errorMessage]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Analysis job was not found.");
    }

    return parseAnalysisJob(result.rows[0]!);
  }
}
