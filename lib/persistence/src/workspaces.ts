import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  type AuthenticatedUser,
  type SessionWorkspace,
  type Workspace,
  type WorkspaceMembership,
  AuthenticatedUserSchema,
  CreateWorkspaceResponseSchema,
  SessionWorkspaceSchema,
  WorkspaceMembershipSchema,
  WorkspaceSchema
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";
import { PersistenceError } from "./errors.js";
import {
  DEFAULT_MEMBERSHIP_ID,
  DEFAULT_USER_ID,
  DEFAULT_WORKSPACE_ID,
  resolveWorkspaceId
} from "./scope.js";

type WorkspaceRow = QueryResultRow & {
  workspace_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserRow = QueryResultRow & {
  user_id: string;
  github_user_id: number;
  github_login: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MembershipRow = QueryResultRow & {
  membership_id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMembership["role"];
  created_at: Date | string;
  updated_at: Date | string;
};

type SessionWorkspaceRow = WorkspaceRow & MembershipRow;

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function slugifyWorkspaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120) || `workspace-${randomUUID().slice(0, 8)}`;
}

function parseWorkspace(row: WorkspaceRow): Workspace {
  return WorkspaceSchema.parse({
    id: row.workspace_id,
    name: row.name,
    slug: row.slug,
    isDefault: row.is_default,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseUser(row: UserRow): AuthenticatedUser {
  return AuthenticatedUserSchema.parse({
    id: row.user_id,
    githubUserId: row.github_user_id,
    githubLogin: row.github_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseMembership(row: MembershipRow): WorkspaceMembership {
  return WorkspaceMembershipSchema.parse({
    id: row.membership_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  });
}

function parseSessionWorkspace(row: SessionWorkspaceRow): SessionWorkspace {
  return SessionWorkspaceSchema.parse({
    workspace: parseWorkspace(row),
    membership: parseMembership(row)
  });
}

export class WorkspaceRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async ensureDefaultDevMembership(): Promise<{
    membership: WorkspaceMembership;
    user: AuthenticatedUser;
    workspace: Workspace;
  }> {
    const [workspace, user, memberships] = await Promise.all([
      this.getWorkspace(DEFAULT_WORKSPACE_ID),
      this.getUser(DEFAULT_USER_ID),
      this.listWorkspacesForUser(DEFAULT_USER_ID)
    ]);
    const membership = memberships.find((entry) => entry.workspace.id === DEFAULT_WORKSPACE_ID)?.membership;

    if (!membership) {
      throw new PersistenceError("not_found", "Default workspace membership was not found.");
    }

    return { membership, user, workspace };
  }

  async upsertGitHubUser(input: {
    avatarUrl?: string | null;
    displayName?: string | null;
    githubLogin: string;
    githubUserId: number;
  }): Promise<AuthenticatedUser> {
    const now = new Date().toISOString();
    const result = await this.client.query<UserRow>(
      `INSERT INTO users (
        user_id,
        github_user_id,
        github_login,
        display_name,
        avatar_url,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      ON CONFLICT (github_user_id) DO UPDATE SET
        github_login = EXCLUDED.github_login,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = EXCLUDED.updated_at
      RETURNING
        user_id,
        github_user_id,
        github_login,
        display_name,
        avatar_url,
        created_at,
        updated_at`,
      [
        input.githubUserId === 0
          ? DEFAULT_USER_ID
          : `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        input.githubUserId,
        input.githubLogin,
        input.displayName ?? null,
        input.avatarUrl ?? null,
        now
      ]
    );

    return parseUser(result.rows[0]!);
  }

  async getUser(userId: string): Promise<AuthenticatedUser> {
    const result = await this.client.query<UserRow>(
      `SELECT
        user_id,
        github_user_id,
        github_login,
        display_name,
        avatar_url,
        created_at,
        updated_at
      FROM users
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "User was not found.");
    }

    return parseUser(result.rows[0]!);
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const result = await this.client.query<WorkspaceRow>(
      `SELECT
        workspace_id,
        name,
        slug,
        is_default,
        created_at,
        updated_at
      FROM workspaces
      WHERE workspace_id = $1`,
      [resolveWorkspaceId(workspaceId)]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Workspace was not found.");
    }

    return parseWorkspace(result.rows[0]!);
  }

  async createWorkspace(input: {
    name: string;
    ownerUserId: string;
  }): Promise<ReturnType<typeof CreateWorkspaceResponseSchema.parse>> {
    const now = new Date().toISOString();
    const workspaceId = `workspace_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const membershipId = `membership_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    return this.client.transaction(async (session) => {
      const workspaceResult = await session.query<WorkspaceRow>(
        `INSERT INTO workspaces (
          workspace_id,
          name,
          slug,
          is_default,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, FALSE, $4, $4)
        RETURNING
          workspace_id,
          name,
          slug,
          is_default,
          created_at,
          updated_at`,
        [workspaceId, input.name.trim(), slugifyWorkspaceName(input.name), now]
      );

      const membershipResult = await session.query<MembershipRow>(
        `INSERT INTO workspace_memberships (
          membership_id,
          workspace_id,
          user_id,
          role,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, 'owner', $4, $4)
        RETURNING
          membership_id,
          workspace_id,
          user_id,
          role,
          created_at,
          updated_at`,
        [membershipId, workspaceId, input.ownerUserId, now]
      );

      return CreateWorkspaceResponseSchema.parse({
        workspace: parseWorkspace(workspaceResult.rows[0]!),
        membership: parseMembership(membershipResult.rows[0]!)
      });
    });
  }

  async ensureMembership(input: {
    role: WorkspaceMembership["role"];
    userId: string;
    workspaceId: string;
  }): Promise<WorkspaceMembership> {
    const now = new Date().toISOString();
    const result = await this.client.query<MembershipRow>(
      `INSERT INTO workspace_memberships (
        membership_id,
        workspace_id,
        user_id,
        role,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = EXCLUDED.updated_at
      RETURNING
        membership_id,
        workspace_id,
        user_id,
        role,
        created_at,
        updated_at`,
      [
        input.workspaceId === DEFAULT_WORKSPACE_ID && input.userId === DEFAULT_USER_ID
          ? DEFAULT_MEMBERSHIP_ID
          : `membership_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        resolveWorkspaceId(input.workspaceId),
        input.userId,
        input.role,
        now
      ]
    );

    return parseMembership(result.rows[0]!);
  }

  async getMembership(input: {
    userId: string;
    workspaceId: string;
  }): Promise<SessionWorkspace> {
    const result = await this.client.query<SessionWorkspaceRow>(
      `SELECT
        workspaces.workspace_id,
        workspaces.name,
        workspaces.slug,
        workspaces.is_default,
        workspaces.created_at,
        workspaces.updated_at,
        memberships.membership_id,
        memberships.user_id,
        memberships.role
      FROM workspace_memberships AS memberships
      INNER JOIN workspaces
        ON workspaces.workspace_id = memberships.workspace_id
      WHERE memberships.workspace_id = $1
        AND memberships.user_id = $2`,
      [resolveWorkspaceId(input.workspaceId), input.userId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Workspace membership was not found.");
    }

    return parseSessionWorkspace(result.rows[0]!);
  }

  async listWorkspacesForUser(userId: string): Promise<SessionWorkspace[]> {
    const result = await this.client.query<SessionWorkspaceRow>(
      `SELECT
        workspaces.workspace_id,
        workspaces.name,
        workspaces.slug,
        workspaces.is_default,
        workspaces.created_at,
        workspaces.updated_at,
        memberships.membership_id,
        memberships.user_id,
        memberships.role,
        memberships.created_at,
        memberships.updated_at
      FROM workspace_memberships AS memberships
      INNER JOIN workspaces
        ON workspaces.workspace_id = memberships.workspace_id
      WHERE memberships.user_id = $1
      ORDER BY workspaces.is_default DESC, workspaces.name ASC`,
      [userId]
    );

    return result.rows.map(parseSessionWorkspace);
  }
}
