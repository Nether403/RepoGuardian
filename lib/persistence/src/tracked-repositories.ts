import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  TrackedRepositorySchema,
  type TrackedRepository
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";
import { PersistenceError } from "./errors.js";

type TrackedRepositoryRow = QueryResultRow & {
  canonical_url: string;
  created_at: Date | string;
  is_active: boolean;
  label: string | null;
  last_queued_at: Date | string | null;
  repository_full_name: string;
  repository_owner: string;
  repository_repo: string;
  tracked_repository_id: string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseTrackedRepository(row: TrackedRepositoryRow): TrackedRepository {
  return TrackedRepositorySchema.parse({
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
}

function assertValidTrackedRepositoryId(trackedRepositoryId: string): void {
  if (!/^[a-z0-9._:-]+$/iu.test(trackedRepositoryId)) {
    throw new PersistenceError(
      "invalid_tracked_repository_id",
      "Tracked repository id is invalid."
    );
  }
}

export class TrackedRepositoryRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async createRepository(input: {
    canonicalUrl: string;
    fullName: string;
    label?: string | null;
    owner: string;
    repo: string;
  }): Promise<TrackedRepository> {
    const now = new Date().toISOString();
    const result = await this.client.query<TrackedRepositoryRow>(
      `INSERT INTO tracked_repositories (
        tracked_repository_id,
        repository_full_name,
        repository_owner,
        repository_repo,
        canonical_url,
        label,
        is_active,
        created_at,
        updated_at,
        last_queued_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $7, NULL)
      ON CONFLICT (repository_full_name) DO UPDATE SET
        repository_owner = EXCLUDED.repository_owner,
        repository_repo = EXCLUDED.repository_repo,
        canonical_url = EXCLUDED.canonical_url,
        label = EXCLUDED.label,
        is_active = TRUE,
        updated_at = EXCLUDED.updated_at
      RETURNING
        tracked_repository_id,
        repository_full_name,
        repository_owner,
        repository_repo,
        canonical_url,
        label,
        is_active,
        created_at,
        updated_at,
        last_queued_at`,
      [
        `tracked_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        input.fullName,
        input.owner,
        input.repo,
        input.canonicalUrl,
        input.label?.trim() ? input.label.trim() : null,
        now
      ]
    );

    return parseTrackedRepository(result.rows[0]!);
  }

  async getRepository(trackedRepositoryId: string): Promise<TrackedRepository> {
    assertValidTrackedRepositoryId(trackedRepositoryId);
    const result = await this.client.query<TrackedRepositoryRow>(
      `SELECT
        tracked_repository_id,
        repository_full_name,
        repository_owner,
        repository_repo,
        canonical_url,
        label,
        is_active,
        created_at,
        updated_at,
        last_queued_at
      FROM tracked_repositories
      WHERE tracked_repository_id = $1`,
      [trackedRepositoryId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Tracked repository was not found.");
    }

    return parseTrackedRepository(result.rows[0]!);
  }

  async listRepositories(): Promise<TrackedRepository[]> {
    const result = await this.client.query<TrackedRepositoryRow>(
      `SELECT
        tracked_repository_id,
        repository_full_name,
        repository_owner,
        repository_repo,
        canonical_url,
        label,
        is_active,
        created_at,
        updated_at,
        last_queued_at
      FROM tracked_repositories
      ORDER BY updated_at DESC, repository_full_name ASC`
    );

    return result.rows.map(parseTrackedRepository);
  }
}
