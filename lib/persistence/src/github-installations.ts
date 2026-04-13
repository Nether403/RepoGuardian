import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  type GitHubInstallation,
  type GitHubInstallationRepository,
  GitHubInstallationRepositorySchema,
  GitHubInstallationSchema
} from "@repo-guardian/shared-types";
import type { PostgresClient, PostgresSession } from "./client.js";
import { PersistenceError } from "./errors.js";
import { resolveWorkspaceId } from "./scope.js";

type InstallationRow = QueryResultRow & {
  installation_id: string;
  workspace_id: string;
  github_installation_id: number;
  target_type: "Organization" | "User";
  target_id: number;
  target_login: string;
  status: GitHubInstallation["status"];
  permissions: unknown;
  repository_selection: "all" | "selected";
  installed_at: Date | string;
  suspended_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type InstallationRepositoryRow = QueryResultRow & {
  installation_repository_id: string;
  workspace_id: string;
  installation_id: string;
  repository_node_id: string | null;
  github_repository_id: number;
  owner: string;
  repo: string;
  full_name: string;
  canonical_url: string;
  default_branch: string | null;
  is_private: boolean;
  is_archived: boolean;
  is_selected: boolean;
  last_synced_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseInstallation(row: InstallationRow): GitHubInstallation {
  return GitHubInstallationSchema.parse({
    id: row.installation_id,
    workspaceId: row.workspace_id,
    githubInstallationId: row.github_installation_id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLogin: row.target_login,
    status: row.status,
    permissions:
      row.permissions && typeof row.permissions === "object"
        ? (row.permissions as Record<string, string>)
        : {},
    repositorySelection: row.repository_selection,
    installedAt: toIsoString(row.installed_at),
    suspendedAt: toIsoString(row.suspended_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseInstallationRepository(
  row: InstallationRepositoryRow
): GitHubInstallationRepository {
  return GitHubInstallationRepositorySchema.parse({
    id: row.installation_repository_id,
    workspaceId: row.workspace_id,
    githubInstallationId: row.installation_id,
    repositoryNodeId: row.repository_node_id,
    githubRepositoryId: row.github_repository_id,
    owner: row.owner,
    repo: row.repo,
    fullName: row.full_name,
    canonicalUrl: row.canonical_url,
    defaultBranch: row.default_branch,
    isPrivate: row.is_private,
    isArchived: row.is_archived,
    isSelected: row.is_selected,
    lastSyncedAt: toIsoString(row.last_synced_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

export class GitHubInstallationRepositoryStore {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async upsertInstallation(input: {
    githubInstallationId: number;
    permissions: Record<string, string>;
    repositorySelection: "all" | "selected";
    status: GitHubInstallation["status"];
    suspendedAt?: string | null;
    targetId: number;
    targetLogin: string;
    targetType: "Organization" | "User";
    workspaceId: string;
  }): Promise<GitHubInstallation> {
    const now = new Date().toISOString();
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const result = await this.client.query<InstallationRow>(
      `INSERT INTO github_installations (
        installation_id,
        workspace_id,
        github_installation_id,
        target_type,
        target_id,
        target_login,
        status,
        permissions,
        repository_selection,
        installed_at,
        suspended_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $10, $10)
      ON CONFLICT (github_installation_id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        target_type = EXCLUDED.target_type,
        target_id = EXCLUDED.target_id,
        target_login = EXCLUDED.target_login,
        status = EXCLUDED.status,
        permissions = EXCLUDED.permissions,
        repository_selection = EXCLUDED.repository_selection,
        installed_at = EXCLUDED.installed_at,
        suspended_at = EXCLUDED.suspended_at,
        updated_at = EXCLUDED.updated_at
      RETURNING
        installation_id,
        workspace_id,
        github_installation_id,
        target_type,
        target_id,
        target_login,
        status,
        permissions,
        repository_selection,
        installed_at,
        suspended_at,
        created_at,
        updated_at`,
      [
        `ghi_${input.githubInstallationId}`,
        workspaceId,
        input.githubInstallationId,
        input.targetType,
        input.targetId,
        input.targetLogin,
        input.status,
        JSON.stringify(input.permissions),
        input.repositorySelection,
        now,
        input.suspendedAt ?? null
      ]
    );

    return parseInstallation(result.rows[0]!);
  }

  async listInstallationsByWorkspace(workspaceId: string): Promise<GitHubInstallation[]> {
    const result = await this.client.query<InstallationRow>(
      `SELECT
        installation_id,
        workspace_id,
        github_installation_id,
        target_type,
        target_id,
        target_login,
        status,
        permissions,
        repository_selection,
        installed_at,
        suspended_at,
        created_at,
        updated_at
      FROM github_installations
      WHERE workspace_id = $1
      ORDER BY target_login ASC, github_installation_id ASC`,
      [resolveWorkspaceId(workspaceId)]
    );

    return result.rows.map(parseInstallation);
  }

  async getInstallationById(input: {
    installationId: string;
    workspaceId?: string | null;
  }): Promise<GitHubInstallation> {
    const values: unknown[] = [input.installationId];
    let query = `SELECT
      installation_id,
      workspace_id,
      github_installation_id,
      target_type,
      target_id,
      target_login,
      status,
      permissions,
      repository_selection,
      installed_at,
      suspended_at,
      created_at,
      updated_at
    FROM github_installations
    WHERE installation_id = $1`;

    if (input.workspaceId) {
      values.push(resolveWorkspaceId(input.workspaceId));
      query += ` AND workspace_id = $2`;
    }

    const result = await this.client.query<InstallationRow>(query, values);

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "GitHub installation was not found.");
    }

    return parseInstallation(result.rows[0]!);
  }

  async getInstallationByGithubInstallationId(input: {
    githubInstallationId: number;
    workspaceId?: string | null;
  }): Promise<GitHubInstallation> {
    const values: unknown[] = [input.githubInstallationId];
    let query = `SELECT
      installation_id,
      workspace_id,
      github_installation_id,
      target_type,
      target_id,
      target_login,
      status,
      permissions,
      repository_selection,
      installed_at,
      suspended_at,
      created_at,
      updated_at
    FROM github_installations
    WHERE github_installation_id = $1`;

    if (input.workspaceId) {
      values.push(resolveWorkspaceId(input.workspaceId));
      query += ` AND workspace_id = $2`;
    }

    const result = await this.client.query<InstallationRow>(query, values);

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "GitHub installation was not found.");
    }

    return parseInstallation(result.rows[0]!);
  }

  async replaceInstallationRepositories(input: {
    installationId: string;
    repositories: Array<{
      canonicalUrl: string;
      defaultBranch?: string | null;
      fullName: string;
      githubRepositoryId: number;
      isArchived: boolean;
      isPrivate: boolean;
      isSelected: boolean;
      owner: string;
      repo: string;
      repositoryNodeId?: string | null;
    }>;
    workspaceId: string;
  }): Promise<GitHubInstallationRepository[]> {
    const now = new Date().toISOString();
    const workspaceId = resolveWorkspaceId(input.workspaceId);

    return this.client.transaction(async (session) => {
      await session.query(
        `DELETE FROM github_installation_repositories
        WHERE installation_id = $1
          AND workspace_id = $2`,
        [input.installationId, workspaceId]
      );

      const repositories: GitHubInstallationRepository[] = [];

      for (const repository of input.repositories) {
        const result = await this.insertInstallationRepository(session, {
          ...repository,
          installationId: input.installationId,
          now,
          workspaceId
        });
        repositories.push(result);
      }

      return repositories.sort((left, right) => left.fullName.localeCompare(right.fullName));
    });
  }

  private async insertInstallationRepository(
    session: PostgresSession,
    input: {
      canonicalUrl: string;
      defaultBranch?: string | null;
      fullName: string;
      githubRepositoryId: number;
      installationId: string;
      isArchived: boolean;
      isPrivate: boolean;
      isSelected: boolean;
      now: string;
      owner: string;
      repo: string;
      repositoryNodeId?: string | null;
      workspaceId: string;
    }
  ): Promise<GitHubInstallationRepository> {
    const result = await session.query<InstallationRepositoryRow>(
      `INSERT INTO github_installation_repositories (
        installation_repository_id,
        workspace_id,
        installation_id,
        repository_node_id,
        github_repository_id,
        owner,
        repo,
        full_name,
        canonical_url,
        default_branch,
        is_private,
        is_archived,
        is_selected,
        last_synced_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $14
      )
      RETURNING
        installation_repository_id,
        workspace_id,
        installation_id,
        repository_node_id,
        github_repository_id,
        owner,
        repo,
        full_name,
        canonical_url,
        default_branch,
        is_private,
        is_archived,
        is_selected,
        last_synced_at,
        created_at,
        updated_at`,
      [
        `ghir_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        input.workspaceId,
        input.installationId,
        input.repositoryNodeId ?? null,
        input.githubRepositoryId,
        input.owner,
        input.repo,
        input.fullName,
        input.canonicalUrl,
        input.defaultBranch ?? null,
        input.isPrivate,
        input.isArchived,
        input.isSelected,
        input.now
      ]
    );

    return parseInstallationRepository(result.rows[0]!);
  }

  async listRepositoriesByWorkspace(workspaceId: string): Promise<GitHubInstallationRepository[]> {
    const result = await this.client.query<InstallationRepositoryRow>(
      `SELECT
        installation_repository_id,
        workspace_id,
        installation_id,
        repository_node_id,
        github_repository_id,
        owner,
        repo,
        full_name,
        canonical_url,
        default_branch,
        is_private,
        is_archived,
        is_selected,
        last_synced_at,
        created_at,
        updated_at
      FROM github_installation_repositories
      WHERE workspace_id = $1
      ORDER BY full_name ASC`,
      [resolveWorkspaceId(workspaceId)]
    );

    return result.rows.map(parseInstallationRepository);
  }

  async getRepositoryById(input: {
    installationRepositoryId: string;
    workspaceId: string;
  }): Promise<GitHubInstallationRepository> {
    const result = await this.client.query<InstallationRepositoryRow>(
      `SELECT
        installation_repository_id,
        workspace_id,
        installation_id,
        repository_node_id,
        github_repository_id,
        owner,
        repo,
        full_name,
        canonical_url,
        default_branch,
        is_private,
        is_archived,
        is_selected,
        last_synced_at,
        created_at,
        updated_at
      FROM github_installation_repositories
      WHERE installation_repository_id = $1
        AND workspace_id = $2`,
      [input.installationRepositoryId, resolveWorkspaceId(input.workspaceId)]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "GitHub installation repository was not found.");
    }

    return parseInstallationRepository(result.rows[0]!);
  }

  async findRepositoryByFullName(input: {
    repositoryFullName: string;
    workspaceId: string;
  }): Promise<GitHubInstallationRepository> {
    const result = await this.client.query<InstallationRepositoryRow>(
      `SELECT
        installation_repository_id,
        workspace_id,
        installation_id,
        repository_node_id,
        github_repository_id,
        owner,
        repo,
        full_name,
        canonical_url,
        default_branch,
        is_private,
        is_archived,
        is_selected,
        last_synced_at,
        created_at,
        updated_at
      FROM github_installation_repositories
      WHERE workspace_id = $1
        AND full_name = $2`,
      [resolveWorkspaceId(input.workspaceId), input.repositoryFullName]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Repository is not linked to an active installation.");
    }

    return parseInstallationRepository(result.rows[0]!);
  }
}
