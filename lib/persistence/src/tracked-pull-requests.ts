import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  TrackedPullRequestSchema,
  type TrackedPullRequest,
  type TrackedPullRequestLifecycleStatus
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";

type TrackedPullRequestRow = QueryResultRow & {
  branch_name: string;
  closed_at: Date | string | null;
  created_at: Date | string;
  execution_id: string | null;
  lifecycle_status: TrackedPullRequestLifecycleStatus;
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

export class TrackedPullRequestRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async upsertOpenedPullRequest(input: {
    branchName: string;
    executionId: string | null;
    owner: string;
    planId: string | null;
    pullRequestNumber: number;
    pullRequestUrl: string;
    repo: string;
    title: string;
  }): Promise<TrackedPullRequest> {
    const repositoryFullName = `${input.owner}/${input.repo}`;
    const now = new Date().toISOString();
    const result = await this.client.query<TrackedPullRequestRow>(
      `INSERT INTO tracked_pull_requests (
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
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11, $11, NULL, NULL
      )
      ON CONFLICT (repository_full_name, pull_request_number) DO UPDATE SET
        pull_request_url = EXCLUDED.pull_request_url,
        branch_name = EXCLUDED.branch_name,
        title = EXCLUDED.title,
        plan_id = EXCLUDED.plan_id,
        execution_id = EXCLUDED.execution_id,
        updated_at = EXCLUDED.updated_at
      RETURNING
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
        merged_at`,
      [
        `tpr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        repositoryFullName,
        input.owner,
        input.repo,
        input.pullRequestNumber,
        input.pullRequestUrl,
        input.branchName,
        input.title,
        input.planId,
        input.executionId,
        now
      ]
    );

    return parseTrackedPullRequest(result.rows[0]!);
  }

  async listTrackedPullRequests(): Promise<TrackedPullRequest[]> {
    const result = await this.client.query<TrackedPullRequestRow>(
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
    );

    return result.rows.map(parseTrackedPullRequest);
  }

  async listOpenTrackedPullRequests(): Promise<TrackedPullRequest[]> {
    const result = await this.client.query<TrackedPullRequestRow>(
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
      WHERE lifecycle_status = 'open'
      ORDER BY updated_at DESC, tracked_pull_request_id DESC`
    );

    return result.rows.map(parseTrackedPullRequest);
  }

  async updateLifecycle(input: {
    lifecycleStatus: TrackedPullRequestLifecycleStatus;
    mergedAt?: string | null;
    pullRequestNumber: number;
    repositoryFullName: string;
    updatedAt?: string;
    closedAt?: string | null;
  }): Promise<TrackedPullRequest> {
    const result = await this.client.query<TrackedPullRequestRow>(
      `UPDATE tracked_pull_requests
      SET
        lifecycle_status = $3,
        closed_at = $4,
        merged_at = $5,
        updated_at = $6
      WHERE repository_full_name = $1 AND pull_request_number = $2
      RETURNING
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
        merged_at`,
      [
        input.repositoryFullName,
        input.pullRequestNumber,
        input.lifecycleStatus,
        input.closedAt ?? null,
        input.mergedAt ?? null,
        input.updatedAt ?? new Date().toISOString()
      ]
    );

    return parseTrackedPullRequest(result.rows[0]!);
  }
}
