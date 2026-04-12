import { useState, type FormEvent } from "react";
import type { FleetTrackedRepositoryStatus } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type TrackedRepositoriesPanelProps = {
  errorMessage: string | null;
  isCreating: boolean;
  isLoading: boolean;
  pendingTrackedRepositoryId: string | null;
  repositories: FleetTrackedRepositoryStatus[];
  onCreateRepository: (input: {
    label?: string | null;
    repoInput: string;
  }) => void;
  onEnqueueAnalysis: (trackedRepositoryId: string) => void;
  onOpenJobDetails: (jobId: string) => void;
  onOpenPlanDetails: (planId: string) => void;
  onOpenRepositoryDetails: (trackedRepositoryId: string) => void;
  onOpenRunDetails: (runId: string) => void;
  onRefresh: () => void;
};

function formatPlanStatus(status: FleetTrackedRepositoryStatus["latestPlanStatus"]): string {
  if (!status) {
    return "No plan";
  }

  return status.replace(/_/gu, " ");
}

export function TrackedRepositoriesPanel({
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
  onRefresh
}: TrackedRepositoriesPanelProps) {
  const [label, setLabel] = useState("");
  const [repoInput, setRepoInput] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateRepository({
      label: label.trim().length > 0 ? label : null,
      repoInput
    });
    setLabel("");
    setRepoInput("");
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
            <input
              onChange={(event) => setRepoInput(event.target.value)}
              placeholder="owner/repo or GitHub URL"
              value={repoInput}
            />
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
              disabled={isCreating}
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
