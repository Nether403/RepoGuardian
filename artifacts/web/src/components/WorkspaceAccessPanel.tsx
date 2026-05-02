import type { AuthSession, GitHubInstallation, GitHubInstallationRepository } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { Button, EmptyState } from "./ui";

type WorkspaceAccessPanelProps = {
  authErrorMessage: string | null;
  authSession: AuthSession | null;
  installationErrorMessage: string | null;
  installations: GitHubInstallation[];
  isInstallationsLoading: boolean;
  isSessionLoading: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  onSyncInstallation: (installationId: string) => void;
  onWorkspaceChange: (workspaceId: string) => void;
  pendingInstallationId: string | null;
  repositories: GitHubInstallationRepository[];
  selectedWorkspaceId: string | null;
};

function describeInstallationRepositories(
  installation: GitHubInstallation,
  repositories: GitHubInstallationRepository[]
): string {
  const totalRepositories = repositories.filter(
    (repository) => repository.githubInstallationId === installation.id
  ).length;

  if (installation.repositorySelection === "all") {
    return `${totalRepositories} synced repo${totalRepositories === 1 ? "" : "s"}`;
  }

  return `${totalRepositories} selected repo${totalRepositories === 1 ? "" : "s"}`;
}

export function WorkspaceAccessPanel({
  authErrorMessage,
  authSession,
  installationErrorMessage,
  installations,
  isInstallationsLoading,
  isSessionLoading,
  onLogout,
  onRefresh,
  onSignIn,
  onSyncInstallation,
  onWorkspaceChange,
  pendingInstallationId,
  repositories,
  selectedWorkspaceId
}: WorkspaceAccessPanelProps) {
  const selectedWorkspace =
    authSession?.workspaces.find(
      (entry) => entry.workspace.id === selectedWorkspaceId
    ) ?? authSession?.workspaces[0] ?? null;
  const sessionUser = authSession?.user;

  return (
    <Panel
      className="panel-wide"
      eyebrow="Workspace Access"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={
              authSession
                ? `${authSession.workspaces.length} workspace${authSession.workspaces.length === 1 ? "" : "s"}`
                : "Sign-in required"
            }
            tone={authSession ? "active" : "warning"}
          />
          {selectedWorkspace ? (
            <StatusBadge
              label={selectedWorkspace.membership.role}
              tone="up-next"
            />
          ) : null}
        </div>
      }
      title="GitHub session and workspace"
    >
      <div className="fleet-panel-shell">
        <div className="fleet-panel-toolbar">
          <EmptyState>Fleet Admin now scopes reads and write-back planning through the active
            workspace. Sign in with GitHub, pick the workspace you want to operate
            in, sync GitHub App installations, and select tracked repositories from
            synced installation visibility.</EmptyState>
          <div className="fleet-inline-actions">
            <Button
              disabled={isSessionLoading || isInstallationsLoading}
              icon={
                isSessionLoading || isInstallationsLoading ? undefined : "refresh"
              }
              loading={isSessionLoading || isInstallationsLoading}
              onClick={onRefresh}
            >
              {isSessionLoading || isInstallationsLoading ? "Refreshing..." : "Refresh access"}
            </Button>
            {authSession ? (
              <Button icon="x" onClick={onLogout}>
                {authSession.authMode === "session" ? "Sign out" : "Leave local mode"}
              </Button>
            ) : (
              <Button icon="github" onClick={onSignIn} variant="primary">
                Sign in with GitHub
              </Button>
            )}
          </div>
        </div>
        {authErrorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {authErrorMessage}
          </p>
        ) : null}
        {!authSession ? (
          <EmptyState>Sign in to load workspace membership and GitHub App installations.</EmptyState>
        ) : (
          <>
            <div className="fleet-metric-grid">
              <article className="fleet-metric-card">
                <span>Actor</span>
                <strong>{sessionUser?.displayName ?? sessionUser?.githubLogin ?? "Unknown actor"}</strong>
                <p>{sessionUser?.githubLogin ? `@${sessionUser.githubLogin}` : "No actor profile loaded"}</p>
              </article>
              <article className="fleet-metric-card">
                <span>Auth mode</span>
                <strong>{authSession.authMode === "session" ? "GitHub OAuth" : "Local Dev"}</strong>
                <p>
                  {authSession.authMode === "session"
                    ? "Session-backed workspace membership is active."
                    : "Bearer key fallback is active for local development."}
                </p>
              </article>
              <article className="fleet-metric-card">
                <span>Repositories</span>
                <strong>{repositories.length}</strong>
                <p>Repositories currently visible through synced installations.</p>
              </article>
            </div>
            <form className="fleet-form fleet-form-compact">
              <label>
                <span>Workspace</span>
                <select
                  aria-label="Workspace"
                  onChange={(event) => onWorkspaceChange(event.target.value)}
                  value={selectedWorkspaceId ?? ""}
                >
                  {authSession.workspaces.map((entry) => (
                    <option key={entry.workspace.id} value={entry.workspace.id}>
                      {entry.workspace.name} ({entry.membership.role})
                    </option>
                  ))}
                </select>
              </label>
            </form>
            {installationErrorMessage ? (
              <p className="form-message form-message-error" role="alert">
                {installationErrorMessage}
              </p>
            ) : null}
            {installations.length > 0 ? (
              <div className="fleet-card-list">
                {installations.map((installation) => (
                  <article className="fleet-entity-card" key={installation.id}>
                    <div className="trace-card-header">
                      <div>
                        <p className="subsection-label">{installation.targetLogin}</p>
                        <h3>{installation.targetType} installation</h3>
                      </div>
                      <div className="badge-row">
                        <StatusBadge label={installation.status} tone={installation.status === "active" ? "active" : "warning"} />
                        <StatusBadge label={installation.repositorySelection} tone="muted" />
                      </div>
                    </div>
                    <p className="trace-copy">
                      {describeInstallationRepositories(installation, repositories)}. Installed{" "}
                      {formatTimestamp(installation.installedAt)}.
                    </p>
                    <div className="fleet-inline-actions">
                      <Button
                        disabled={pendingInstallationId === installation.id || isInstallationsLoading}
                        icon={
                          pendingInstallationId === installation.id
                            ? undefined
                            : "refresh"
                        }
                        loading={pendingInstallationId === installation.id}
                        onClick={() => onSyncInstallation(installation.id)}
                      >
                        {pendingInstallationId === installation.id ? "Syncing..." : "Sync repositories"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState>{authSession.authMode === "session"
                  ? "No synced installations are available for this workspace yet. Install the Repo Guardian GitHub App on the target account, then refresh access."
                  : "Local development mode is active. Installation-backed repository selection appears here when a workspace is connected to a GitHub App installation."}</EmptyState>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
