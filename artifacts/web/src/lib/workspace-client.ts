import {
  AuthSessionSchema,
  ListGitHubInstallationsResponseSchema,
  type AuthSession,
  type GitHubInstallationRepository,
  type GitHubInstallation
} from "@repo-guardian/shared-types";
import {
  getApiOptions,
  getLocalApiToken,
  getStoredActiveWorkspaceId,
  setStoredActiveWorkspaceId
} from "./api-options";

export type WorkspaceInstallationsSnapshot = {
  installations: GitHubInstallation[];
  repositories: GitHubInstallationRepository[];
};

export class WorkspaceClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkspaceClientError";
    this.status = status;
    this.details = details;
  }
}

function buildSyntheticLocalSession(): AuthSession {
  const timestamp = new Date(0).toISOString();
  const selectedWorkspaceId =
    getStoredActiveWorkspaceId() ?? "workspace_local_default";

  setStoredActiveWorkspaceId(selectedWorkspaceId);

  return AuthSessionSchema.parse({
    authenticated: true,
    activeWorkspaceId: selectedWorkspaceId,
    authMode: "api_key",
    user: {
      avatarUrl: null,
      createdAt: timestamp,
      displayName: "Local Dev User",
      githubLogin: "local-dev",
      githubUserId: 1,
      id: "usr_local_default",
      updatedAt: timestamp
    },
    workspaces: [
      {
        membership: {
          createdAt: timestamp,
          id: "membership_local_default",
          role: "owner",
          updatedAt: timestamp,
          userId: "usr_local_default",
          workspaceId: selectedWorkspaceId
        },
        workspace: {
          createdAt: timestamp,
          id: selectedWorkspaceId,
          name: "Local Workspace",
          slug: "local-workspace",
          updatedAt: timestamp
        }
      }
    ]
  });
}

async function parseResponse<T>(response: Response, parser: { parse: (value: unknown) => T }): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Repo Guardian request failed.";
    throw new WorkspaceClientError(message, response.status, body);
  }

  return parser.parse(body);
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const localToken = getLocalApiToken();
  if (localToken) {
    return buildSyntheticLocalSession();
  }

  const response = await fetch("/api/auth/session", {
    method: "GET",
    ...getApiOptions()
  });

  if (response.status === 401) {
    return null;
  }

  return parseResponse(response, AuthSessionSchema);
}

export async function logoutAuthSession(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    ...getApiOptions()
  });

  if (!response.ok && response.status !== 204) {
    const body = (await response.json().catch(() => null)) as unknown;
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Repo Guardian could not sign out.";
    throw new WorkspaceClientError(message, response.status, body);
  }
}

export async function listWorkspaceInstallations(
  workspaceId: string
): Promise<WorkspaceInstallationsSnapshot> {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/installations`,
    {
      method: "GET",
      ...getApiOptions()
    }
  );

  return parseResponse(response, ListGitHubInstallationsResponseSchema);
}

export async function syncWorkspaceInstallation(input: {
  installationId: string;
  workspaceId: string;
}): Promise<void> {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(input.workspaceId)}/installations/${encodeURIComponent(input.installationId)}/sync`,
    {
      method: "POST",
      ...getApiOptions()
    }
  );

  await parseResponse(response, {
    parse: () => undefined
  });
}

export function getGitHubSignInUrl(): string {
  return "/api/auth/github/start";
}
