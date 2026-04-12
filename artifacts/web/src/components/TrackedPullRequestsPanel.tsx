import type { TrackedPullRequest } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type TrackedPullRequestsPanelProps = {
  onOpenPlanDetails: (planId: string) => void;
  pullRequests: TrackedPullRequest[];
};

function getTone(status: TrackedPullRequest["lifecycleStatus"]): "active" | "muted" | "up-next" | "warning" {
  switch (status) {
    case "merged":
      return "active";
    case "closed":
      return "warning";
    default:
      return "up-next";
  }
}

export function TrackedPullRequestsPanel({
  onOpenPlanDetails,
  pullRequests
}: TrackedPullRequestsPanelProps) {
  return (
    <Panel
      className="panel-half"
      eyebrow="PR Lifecycle"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${pullRequests.length} tracked PR${pullRequests.length === 1 ? "" : "s"}`}
            tone={pullRequests.length > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Tracked pull requests"
    >
      <div className="fleet-panel-shell">
        {pullRequests.length > 0 ? (
          <div className="fleet-card-list">
            {pullRequests.map((pullRequest) => (
              <article className="fleet-entity-card" key={pullRequest.trackedPullRequestId}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{pullRequest.repositoryFullName}</p>
                    <h3>
                      <a href={pullRequest.pullRequestUrl} rel="noreferrer" target="_blank">
                        #{pullRequest.pullRequestNumber} {pullRequest.title}
                      </a>
                    </h3>
                  </div>
                  <StatusBadge
                    label={pullRequest.lifecycleStatus}
                    tone={getTone(pullRequest.lifecycleStatus)}
                  />
                </div>
                <p className="trace-copy">
                  Branch <code>{pullRequest.branchName}</code>, updated{" "}
                  {formatTimestamp(pullRequest.updatedAt)}.
                </p>
                <div className="trace-chip-row">
                  {pullRequest.planId ? (
                    <span className="trace-chip trace-chip-muted">
                      plan <code>{pullRequest.planId}</code>
                    </span>
                  ) : null}
                  {pullRequest.executionId ? (
                    <span className="trace-chip trace-chip-muted">
                      execution <code>{pullRequest.executionId}</code>
                    </span>
                  ) : null}
                  {pullRequest.closedAt ? (
                    <span className="trace-chip trace-chip-muted">
                      closed {formatTimestamp(pullRequest.closedAt)}
                    </span>
                  ) : null}
                  {pullRequest.mergedAt ? (
                    <span className="trace-chip trace-chip-muted">
                      merged {formatTimestamp(pullRequest.mergedAt)}
                    </span>
                  ) : null}
                </div>
                <div className="fleet-inline-actions">
                  {pullRequest.planId ? (
                    <button
                      className="secondary-button"
                      onClick={() => onOpenPlanDetails(pullRequest.planId!)}
                      type="button"
                    >
                      Open plan
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No tracked remediation pull requests are recorded yet.
          </p>
        )}
      </div>
    </Panel>
  );
}
