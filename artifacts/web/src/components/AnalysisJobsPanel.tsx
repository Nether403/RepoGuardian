import { useMemo, useState } from "react";
import type { AnalysisJob } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../lib/notifications-client";
import { Panel } from "./Panel";
import {
  NOTIFICATION_LABEL,
  NOTIFICATION_TONE,
  dedupeQueueNotifications
} from "./queue-activity";
import { StatusBadge } from "./StatusBadge";
import { Button, EmptyState } from "./ui";

type AnalysisJobsPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  jobs: AnalysisJob[];
  notifications?: ExecutionPlanNotification[];
  pendingJobId: string | null;
  onCancelJob: (jobId: string) => void;
  onClearNotifications?: () => void;
  onDismissNotification?: (
    planId: string,
    status: ExecutionPlanNotificationType
  ) => void;
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
  notifications,
  pendingJobId,
  onCancelJob,
  onClearNotifications,
  onDismissNotification,
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
  const visibleNotifications = useMemo(
    () => dedupeQueueNotifications(notifications ?? [], jobs),
    [notifications, jobs]
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
          {visibleNotifications.length > 0 ? (
            <StatusBadge
              label={`${visibleNotifications.length} live event${visibleNotifications.length === 1 ? "" : "s"}`}
              tone="up-next"
            />
          ) : null}
        </div>
      }
      title="Analysis jobs"
    >
      <div className="fleet-panel-shell">
        <section
          aria-label="Live queue activity"
          className="queue-activity"
          data-testid="queue-activity"
        >
          <div className="queue-activity-header">
            <p className="subsection-label">Live activity</p>
            {visibleNotifications.length > 0 && onClearNotifications ? (
              <Button
                data-testid="queue-activity-clear"
                icon="close"
                onClick={onClearNotifications}
              >
                Clear activity
              </Button>
            ) : null}
          </div>
          {visibleNotifications.length > 0 ? (
            <ol className="queue-activity-list">
              {visibleNotifications.map((notification) => {
                const key = `${notification.planId}:${notification.status}:${notification.createdAt}`;
                return (
                  <li
                    className="queue-activity-item"
                    data-testid="queue-activity-item"
                    key={key}
                  >
                    <div className="queue-activity-item-header">
                      <StatusBadge
                        label={NOTIFICATION_LABEL[notification.status]}
                        tone={NOTIFICATION_TONE[notification.status]}
                      />
                      <time
                        className="queue-activity-timestamp"
                        dateTime={notification.createdAt}
                      >
                        {formatTimestamp(notification.createdAt)}
                      </time>
                    </div>
                    <p className="trace-copy">
                      <code>{notification.repositoryFullName}</code> · plan{" "}
                      <code>{notification.planId}</code>
                      {notification.executionId ? (
                        <>
                          {" "}· execution <code>{notification.executionId}</code>
                        </>
                      ) : null}
                    </p>
                    {notification.reason ? (
                      <p className="form-message form-message-error">
                        {notification.reason}
                      </p>
                    ) : null}
                    <div className="fleet-inline-actions">
                      <Button
                        data-testid="queue-activity-open-plan"
                        icon="arrow-right"
                        iconPosition="trailing"
                        onClick={() => {
                          onDismissNotification?.(
                            notification.planId,
                            notification.status
                          );
                          onOpenPlanDetails(notification.planId);
                        }}
                      >
                        Open plan
                      </Button>
                      {onDismissNotification ? (
                        <Button
                          data-testid="queue-activity-dismiss"
                          icon="x"
                          onClick={() =>
                            onDismissNotification(
                              notification.planId,
                              notification.status
                            )
                          }
                        >
                          Dismiss
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState>Live plan lifecycle events will appear here as the queue runs.</EmptyState>
          )}
        </section>
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
          <Button
            disabled={isLoading}
            icon={isLoading ? undefined : "refresh"}
            loading={isLoading}
            onClick={onRefresh}
          >
            {isLoading ? "Refreshing jobs..." : "Refresh jobs"}
          </Button>
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
                  <Button
                    icon="search"
                    onClick={() => onOpenJobDetails(job.jobId)}
                  >
                    View details
                  </Button>
                  {job.runId ? (
                    <Button
                      icon="arrow-right"
                      iconPosition="trailing"
                      onClick={() => onOpenRunDetails(job.runId!)}
                    >
                      Open run
                    </Button>
                  ) : null}
                  {job.planId ? (
                    <Button
                      icon="arrow-right"
                      iconPosition="trailing"
                      onClick={() => onOpenPlanDetails(job.planId!)}
                    >
                      Open plan
                    </Button>
                  ) : null}
                  {job.status === "queued" ? (
                    <Button
                      disabled={pendingJobId === job.jobId}
                      icon="x"
                      onClick={() => onCancelJob(job.jobId)}
                    >
                      {pendingJobId === job.jobId ? "Cancelling..." : "Cancel"}
                    </Button>
                  ) : null}
                  {job.status === "failed" || job.status === "cancelled" ? (
                    <Button
                      disabled={pendingJobId === job.jobId}
                      icon={pendingJobId === job.jobId ? undefined : "refresh"}
                      loading={pendingJobId === job.jobId}
                      onClick={() => onRetryJob(job.jobId)}
                    >
                      {pendingJobId === job.jobId ? "Retrying..." : "Retry"}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No jobs match the current filter.</EmptyState>
        )}
      </div>
    </Panel>
  );
}
