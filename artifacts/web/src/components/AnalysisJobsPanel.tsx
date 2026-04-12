import { useMemo, useState } from "react";
import type { AnalysisJob } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type AnalysisJobsPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  jobs: AnalysisJob[];
  pendingJobId: string | null;
  onCancelJob: (jobId: string) => void;
  onOpenJobDetails: (jobId: string) => void;
  onOpenPlanDetails: (planId: string) => void;
  onOpenRunDetails: (runId: string) => void;
  onRefresh: () => void;
  onRetryJob: (jobId: string) => void;
};

function formatJobKind(jobKind: AnalysisJob["jobKind"]): string {
  return jobKind.replace(/_/gu, " ");
}

function getJobTone(status: AnalysisJob["status"]): "active" | "muted" | "up-next" | "warning" {
  switch (status) {
    case "completed":
      return "active";
    case "running":
      return "up-next";
    case "failed":
      return "warning";
    default:
      return "muted";
  }
}

export function AnalysisJobsPanel({
  errorMessage,
  isLoading,
  jobs,
  pendingJobId,
  onCancelJob,
  onOpenJobDetails,
  onOpenPlanDetails,
  onOpenRunDetails,
  onRefresh,
  onRetryJob
}: AnalysisJobsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<AnalysisJob["status"] | "all">("all");
  const visibleJobs = useMemo(
    () => jobs.filter((job) => statusFilter === "all" || job.status === statusFilter),
    [jobs, statusFilter]
  );

  return (
    <Panel
      className="panel-wide"
      eyebrow="Queue"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${jobs.length} recent job${jobs.length === 1 ? "" : "s"}`}
            tone={jobs.length > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Analysis jobs"
    >
      <div className="fleet-panel-shell">
        <div className="fleet-panel-toolbar">
          <label className="fleet-filter">
            <span>Status filter</span>
            <select
              onChange={(event) =>
                setStatusFilter(event.target.value as AnalysisJob["status"] | "all")
              }
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
          >
            {isLoading ? "Refreshing jobs..." : "Refresh jobs"}
          </button>
        </div>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {visibleJobs.length > 0 ? (
          <div className="fleet-card-list">
            {visibleJobs.map((job) => (
              <article className="fleet-entity-card" key={job.jobId}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{formatJobKind(job.jobKind)}</p>
                    <h3>{job.label ?? job.repositoryFullName}</h3>
                  </div>
                  <StatusBadge label={job.status} tone={getJobTone(job.status)} />
                </div>
                <p className="trace-copy">
                  Queued {formatTimestamp(job.queuedAt)} for <code>{job.repositoryFullName}</code>.
                </p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    attempts {job.attemptCount}/{job.maxAttempts}
                  </span>
                  {job.runId ? (
                    <span className="trace-chip trace-chip-muted">
                      run <code>{job.runId}</code>
                    </span>
                  ) : null}
                  {job.planId ? (
                    <span className="trace-chip trace-chip-muted">
                      plan <code>{job.planId}</code>
                    </span>
                  ) : null}
                  {job.trackedRepositoryId ? (
                    <span className="trace-chip trace-chip-muted">
                      tracked <code>{job.trackedRepositoryId}</code>
                    </span>
                  ) : null}
                </div>
                {job.errorMessage ? (
                  <p className="form-message form-message-error">{job.errorMessage}</p>
                ) : null}
                <div className="fleet-inline-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onOpenJobDetails(job.jobId)}
                    type="button"
                  >
                    View details
                  </button>
                  {job.runId ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenRunDetails(job.runId!)}
                      type="button"
                    >
                      Open run
                    </button>
                  ) : null}
                  {job.planId ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenPlanDetails(job.planId!)}
                      type="button"
                    >
                      Open plan
                    </button>
                  ) : null}
                  {job.status === "queued" ? (
                    <button
                      className="secondary-button"
                      disabled={pendingJobId === job.jobId}
                      onClick={() => onCancelJob(job.jobId)}
                      type="button"
                    >
                      {pendingJobId === job.jobId ? "Cancelling..." : "Cancel"}
                    </button>
                  ) : null}
                  {job.status === "failed" || job.status === "cancelled" ? (
                    <button
                      className="secondary-button"
                      disabled={pendingJobId === job.jobId}
                      onClick={() => onRetryJob(job.jobId)}
                      type="button"
                    >
                      {pendingJobId === job.jobId ? "Retrying..." : "Retry"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No jobs match the current filter.
          </p>
        )}
      </div>
    </Panel>
  );
}
