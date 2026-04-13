import { useEffect, useState, type FormEvent } from "react";
import type {
  FleetTrackedRepositoryStatus,
  GitHubInstallationRepository
} from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type TrackedRepositoriesPanelProps = {
  availableRepositories: GitHubInstallationRepository[];
  canUseRepoInputFallback: boolean;
  errorMessage: string | null;
  isCreating: boolean;
  isLoading: boolean;
  pendingTrackedRepositoryId: string | null;
  repositories: FleetTrackedRepositoryStatus[];
  onCreateRepository: (input: {
    installationRepositoryId?: string;
    label?: string | null;
    repoInput?: string;
    workspaceId?: string | null;
  }) => void;
  onEnqueueAnalysis: (trackedRepositoryId: string) => void;
  onOpenJobDetails: (jobId: string) => void;
  onOpenPlanDetails: (planId: string) => void;
  onOpenRepositoryDetails: (trackedRepositoryId: string) => void;
  onOpenRunDetails: (runId: string) => void;
  onRefresh: () => void;
  selectedWorkspaceId: string | null;
};

function formatPlanStatus(status: FleetTrackedRepositoryStatus["latestPlanStatus"]): string {
  if (!status) {
    return "No plan";
  }

  return status.replace(/_/gu, " ");
}

export function TrackedRepositoriesPanel({
  availableRepositories,
  canUseRepoInputFallback,
  errorMessage,
  isCreating,
  isLoading,
  pendingTrackedRepositoryId,
  repositories,
  onCreateRepository,
  onEnqueueAnalysis,
  onOpenJobDetails,
  onOpenPlanDetails,
  onOpenRepositoryDetails,
  onOpenRunDetails,
  onRefresh,
  selectedWorkspaceId
}: TrackedRepositoriesPanelProps) {
  const [label, setLabel] = useState("");
  const [installationRepositoryId, setInstallationRepositoryId] = useState(
    availableRepositories[0]?.id ?? ""
  );
  const [repoInput, setRepoInput] = useState("");
  const hasSelectableRepositories = availableRepositories.length > 0;

  useEffect(() => {
    if (availableRepositories.length === 0) {
      setInstallationRepositoryId("");
      return;
    }

    setInstallationRepositoryId((current) =>
      availableRepositories.some((repository) => repository.id === current)
        ? current
        : availableRepositories[0]!.id
    );
  }, [availableRepositories]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onCreateRepository({
      installationRepositoryId: hasSelectableRepositories
        ? installationRepositoryId
        : undefined,
      label: label.trim().length > 0 ? label : null,
      repoInput: canUseRepoInputFallback ? repoInput : undefined,
      workspaceId: selectedWorkspaceId
    });
    setLabel("");
    if (canUseRepoInputFallback) {
      setRepoInput("");
    }
  }

  return (
    <Panel
      className="panel-wide"
      eyebrow="Tracked Repositories"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${repositories.length} tracked repo${repositories.length === 1 ? "" : "s"}`}
            tone={repositories.length > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Tracked repositories"
    >
      <div className="fleet-panel-shell">
        <form className="fleet-form" onSubmit={handleSubmit}>
          <label>
            <span>Repository input</span>
            {hasSelectableRepositories ? (
              <select
                aria-label="Repository input"
                onChange={(event) => setInstallationRepositoryId(event.target.value)}
                value={installationRepositoryId}
              >
                {availableRepositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.fullName}
                    {repository.isArchived ? " (archived)" : ""}
                    {repository.isPrivate ? " (private)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                onChange={(event) => setRepoInput(event.target.value)}
                placeholder="owner/repo or GitHub URL"
                value={repoInput}
              />
            )}
          </label>
          <label>
            <span>Label</span>
            <input
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Optional label for recurring review context"
              value={label}
            />
          </label>
          <div className="fleet-form-actions">
            <button
              className="submit-button"
              disabled={
                isCreating ||
                (!hasSelectableRepositories &&
                  !canUseRepoInputFallback &&
                  availableRepositories.length === 0)
              }
              type="submit"
            >
              {isCreating ? "Registering..." : "Register tracked repo"}
            </button>
            <button
              className="secondary-button"
              disabled={isLoading}
              onClick={onRefresh}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh repositories"}
            </button>
          </div>
        </form>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {hasSelectableRepositories ? (
          <p className="empty-copy">
            New tracked repositories are selected from synced installation-visible
            repositories for the active workspace.
          </p>
        ) : canUseRepoInputFallback ? (
          <p className="empty-copy">
            Local development fallback is active. Free-form repository input is still
            available until a workspace installation is synced.
          </p>
        ) : (
          <p className="empty-copy">
            Sync a workspace installation before registering a tracked repository.
          </p>
        )}
        {repositories.length > 0 ? (
          <div className="fleet-card-list">
            {repositories.map((entry) => (
              <article className="fleet-entity-card" key={entry.trackedRepository.id}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{entry.trackedRepository.fullName}</p>
                    <h3>{entry.trackedRepository.label ?? "Tracked repository"}</h3>
                  </div>
                  <div className="badge-row">
                    <StatusBadge
                      label={entry.stale ? "Stale run" : "Fresh run"}
                      tone={entry.stale ? "warning" : "active"}
                    />
                    <StatusBadge
                      label={formatPlanStatus(entry.latestPlanStatus)}
                      tone={entry.latestPlanStatus ? "up-next" : "muted"}
                    />
                  </div>
                </div>
                <p className="trace-copy">
                  Latest run:{" "}
                  {entry.latestRun
                    ? `${formatTimestamp(entry.latestRun.fetchedAt)} on ${entry.latestRun.defaultBranch}`
                    : "No saved run yet."}
                </p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    {entry.patchPlanCounts.executable} executable
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {entry.patchPlanCounts.blocked} blocked
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {entry.patchPlanCounts.stale} stale
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    Last queued{" "}
                    {entry.trackedRepository.lastQueuedAt
                      ? formatTimestamp(entry.trackedRepository.lastQueuedAt)
                      : "never"}
                  </span>
                </div>
                {entry.latestAnalysisJob ? (
                  <p className="trace-copy">
                    Latest job <code>{entry.latestAnalysisJob.jobId}</code>:{" "}
                    {entry.latestAnalysisJob.status}
                  </p>
                ) : null}
                <div className="fleet-inline-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onOpenRepositoryDetails(entry.trackedRepository.id)}
                    type="button"
                  >
                    View details
                  </button>
                  {entry.latestRun ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenRunDetails(entry.latestRun!.id)}
                      type="button"
                    >
                      Open run
                    </button>
                  ) : null}
                  {entry.latestPlanId ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenPlanDetails(entry.latestPlanId!)}
                      type="button"
                    >
                      Open plan
                    </button>
                  ) : null}
                  {entry.latestAnalysisJob ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenJobDetails(entry.latestAnalysisJob!.jobId)}
                      type="button"
                    >
                      Open job
                    </button>
                  ) : null}
                  <button
                    className="secondary-button"
                    disabled={pendingTrackedRepositoryId === entry.trackedRepository.id}
                    onClick={() => onEnqueueAnalysis(entry.trackedRepository.id)}
                    type="button"
                  >
                    {pendingTrackedRepositoryId === entry.trackedRepository.id
                      ? "Queueing analysis..."
                      : "Enqueue analysis"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No tracked repositories registered yet. Add one to start repeat
            analysis and scheduled plan-only sweeps.
          </p>
        )}
      </div>
    </Panel>
  );
}
