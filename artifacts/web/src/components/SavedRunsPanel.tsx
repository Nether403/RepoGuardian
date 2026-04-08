import { useState, type FormEvent } from "react";
import type {
  AnalyzeRepoResponse,
  SavedAnalysisRunSummary
} from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type SavedRunsPanelProps = {
  analysis: AnalyzeRepoResponse | null;
  baseRunId: string;
  errorMessage: string | null;
  isComparing: boolean;
  isLoading: boolean;
  isOpening: boolean;
  isSaving: boolean;
  onBaseRunChange: (runId: string) => void;
  onCompareRuns: () => void;
  onOpenRun: (runId: string) => void;
  onRefreshRuns: () => void;
  onSaveCurrentRun: (label: string | null) => void;
  onTargetRunChange: (runId: string) => void;
  runs: SavedAnalysisRunSummary[];
  targetRunId: string;
};

function getRunTitle(run: SavedAnalysisRunSummary): string {
  return run.label ?? `${run.repositoryFullName} at ${formatTimestamp(run.fetchedAt)}`;
}

export function SavedRunsPanel({
  analysis,
  baseRunId,
  errorMessage,
  isComparing,
  isLoading,
  isOpening,
  isSaving,
  onBaseRunChange,
  onCompareRuns,
  onOpenRun,
  onRefreshRuns,
  onSaveCurrentRun,
  onTargetRunChange,
  runs,
  targetRunId
}: SavedRunsPanelProps) {
  const [label, setLabel] = useState("");
  const canCompare =
    runs.length >= 2 &&
    baseRunId.length > 0 &&
    targetRunId.length > 0 &&
    baseRunId !== targetRunId;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveCurrentRun(label.trim().length > 0 ? label : null);
    setLabel("");
  }

  return (
    <Panel
      className="panel-wide"
      eyebrow="Saved Runs"
      footer={
        <div className="badge-row">
          <StatusBadge label={`${runs.length} saved run${runs.length === 1 ? "" : "s"}`} tone={runs.length > 0 ? "active" : "muted"} />
          {analysis ? <StatusBadge label="Current analysis loaded" tone="active" /> : null}
        </div>
      }
      title="Saved analysis runs"
    >
      <div className="saved-runs-shell">
        <p className="empty-copy">
          Save the current analysis locally, reopen prior runs without re-analyzing,
          or compare two saved snapshots.
        </p>
        <form className="saved-run-form" onSubmit={handleSave}>
          <label>
            <span>Run label</span>
            <input
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Optional label, e.g. Before dependency cleanup"
              value={label}
            />
          </label>
          <button
            className="submit-button"
            disabled={!analysis || isSaving}
            type="submit"
          >
            {isSaving ? "Saving run..." : "Save current analysis"}
          </button>
          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={onRefreshRuns}
            type="button"
          >
            {isLoading ? "Loading saved runs..." : "Refresh saved runs"}
          </button>
        </form>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="saved-run-compare-row" aria-label="Saved run comparison controls">
          <label>
            <span>Base run</span>
            <select
              aria-label="Base saved run"
              onChange={(event) => onBaseRunChange(event.target.value)}
              value={baseRunId}
            >
              <option value="">Select base run</option>
              {runs.map((run) => (
                <option key={`base:${run.id}`} value={run.id}>
                  {getRunTitle(run)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Target run</span>
            <select
              aria-label="Target saved run"
              onChange={(event) => onTargetRunChange(event.target.value)}
              value={targetRunId}
            >
              <option value="">Select target run</option>
              {runs.map((run) => (
                <option key={`target:${run.id}`} value={run.id}>
                  {getRunTitle(run)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            disabled={!canCompare || isComparing}
            onClick={onCompareRuns}
            type="button"
          >
            {isComparing ? "Comparing runs..." : "Compare saved runs"}
          </button>
        </div>
        {runs.length > 0 ? (
          <div className="saved-run-list">
            {runs.map((run) => (
              <article className="saved-run-card" key={run.id}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{run.repositoryFullName}</p>
                    <h3>{getRunTitle(run)}</h3>
                  </div>
                  <StatusBadge
                    label={`${run.totalFindings} finding${run.totalFindings === 1 ? "" : "s"}`}
                    tone={run.highSeverityFindings > 0 ? "warning" : "muted"}
                  />
                </div>
                <p className="trace-copy">
                  Saved {formatTimestamp(run.createdAt)} from snapshot{" "}
                  {formatTimestamp(run.fetchedAt)} on {run.defaultBranch}.
                </p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    <code>{run.id}</code>
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {run.issueCandidates} issues
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {run.prCandidates} PRs
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {run.executablePatchPlans} executable patch plans
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {run.blockedPatchPlans} blocked patch plans
                  </span>
                </div>
                <button
                  className="secondary-button"
                  disabled={isOpening}
                  onClick={() => onOpenRun(run.id)}
                  type="button"
                >
                  Reopen saved run
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No saved runs are loaded yet. Refresh saved runs or save the current
            analysis.
          </p>
        )}
      </div>
    </Panel>
  );
}
