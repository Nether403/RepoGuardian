import { useMemo } from "react";
import type { PolicyDecisionEvent } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui";

type PolicyDecisionsPanelProps = {
  actionFilter: PolicyActionFilter;
  decisions: PolicyDecisionEvent[];
  decisionFilter: PolicyDecisionFilter;
  isLoading?: boolean;
  onActionFilterChange: (actionFilter: PolicyActionFilter) => void;
  onDecisionFilterChange: (decisionFilter: PolicyDecisionFilter) => void;
  onOccurredAfterChange: (occurredAfter: string) => void;
  onOccurredBeforeChange: (occurredBefore: string) => void;
  onPageChange: (page: number) => void;
  onRepositoryFilterChange: (repositoryFilter: string) => void;
  occurredAfter: string;
  occurredBefore: string;
  page: number;
  pageSize: number;
  repositoryFilter: string;
  totalDecisions: number;
  totalPages: number;
};

type PolicyActionFilter = PolicyDecisionEvent["actionType"] | "all";
type PolicyDecisionFilter = PolicyDecisionEvent["decision"] | "all";

function formatPolicyAction(actionType: PolicyDecisionEvent["actionType"]): string {
  return actionType.replaceAll("_", " ");
}

function getDecisionTone(
  decision: PolicyDecisionEvent["decision"]
): "active" | "muted" | "warning" {
  if (decision === "allowed") {
    return "active";
  }

  if (decision === "manual_review") {
    return "warning";
  }

  return "muted";
}

function getPolicyScopeLabel(decision: PolicyDecisionEvent): string {
  return (
    decision.repositoryFullName ??
    decision.githubInstallationId ??
    decision.workspaceId
  );
}

function renderPolicyDecision(decision: PolicyDecisionEvent) {
  const scopeLabel = getPolicyScopeLabel(decision);

  return (
    <article className="fleet-entity-card" key={decision.eventId}>
      <div className="trace-card-header">
        <div>
          <p className="subsection-label">{formatPolicyAction(decision.actionType)}</p>
          <h3>{scopeLabel}</h3>
        </div>
        <StatusBadge
          label={decision.decision}
          tone={getDecisionTone(decision.decision)}
        />
      </div>
      <p className="trace-copy">{decision.reason}</p>
      <div className="trace-chip-row">
        <span className="trace-chip trace-chip-muted">{decision.scopeType}</span>
        <span className="trace-chip trace-chip-muted">
          {formatTimestamp(decision.createdAt)}
        </span>
        {decision.planId ? (
          <span className="trace-chip trace-chip-muted">Plan {decision.planId}</span>
        ) : null}
        {decision.jobId ? (
          <span className="trace-chip trace-chip-muted">Job {decision.jobId}</span>
        ) : null}
        {decision.sweepScheduleId ? (
          <span className="trace-chip trace-chip-muted">
            Sweep {decision.sweepScheduleId}
          </span>
        ) : null}
      </div>
      <details className="trace-expander">
        <summary>Decision details</summary>
        <div className="trace-expander-content">
          <div>
            <p className="subsection-label">Identifiers</p>
            <div className="trace-chip-row">
              <span className="trace-chip trace-chip-muted">
                Event {decision.eventId}
              </span>
              <span className="trace-chip trace-chip-muted">
                Workspace {decision.workspaceId}
              </span>
              {decision.actorUserId ? (
                <span className="trace-chip trace-chip-muted">
                  Actor {decision.actorUserId}
                </span>
              ) : null}
              {decision.runId ? (
                <span className="trace-chip trace-chip-muted">Run {decision.runId}</span>
              ) : null}
            </div>
          </div>
          <div>
            <p className="subsection-label">Policy details</p>
            <pre className="trace-pre">
              {JSON.stringify(decision.details, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </article>
  );
}

export function PolicyDecisionsPanel({
  actionFilter,
  decisions,
  decisionFilter,
  isLoading = false,
  onActionFilterChange,
  onDecisionFilterChange,
  onOccurredAfterChange,
  onOccurredBeforeChange,
  onPageChange,
  onRepositoryFilterChange,
  occurredAfter,
  occurredBefore,
  page,
  pageSize,
  repositoryFilter,
  totalDecisions,
  totalPages
}: PolicyDecisionsPanelProps) {
  const actionOptions = useMemo(
    () =>
      [
        "analyze_repository",
        "schedule_sweep",
        "generate_pr_candidates",
        "execute_write"
      ] as PolicyDecisionEvent["actionType"][],
    []
  );
  const pageSummary = useMemo(
    () =>
      totalPages > 0
        ? `Page ${page} of ${totalPages}, ${totalDecisions} policy decisions`
        : `${totalDecisions} policy decisions`,
    [page, totalDecisions, totalPages]
  );

  return (
    <Panel
      className="panel-wide"
      eyebrow="Policy History"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={isLoading ? "Loading decisions" : pageSummary}
            tone={totalDecisions > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Policy decisions"
    >
      <div className="fleet-panel-shell">
        <div className="fleet-panel-toolbar">
          <p className="empty-copy">
            Recent policy evaluations for planning, sweep scheduling, and approved
            GitHub write execution.
          </p>
          <div className="fleet-inline-actions">
            <label className="fleet-filter">
              <span>Repository filter</span>
              <input
                aria-label="Repository filter"
                onChange={(event) => onRepositoryFilterChange(event.target.value)}
                placeholder="owner/repo"
                type="text"
                value={repositoryFilter}
              />
            </label>
            <label className="fleet-filter">
              <span>Occurred after</span>
              <input
                aria-label="Occurred after"
                onChange={(event) => onOccurredAfterChange(event.target.value)}
                type="date"
                value={occurredAfter}
              />
            </label>
            <label className="fleet-filter">
              <span>Occurred before</span>
              <input
                aria-label="Occurred before"
                onChange={(event) => onOccurredBeforeChange(event.target.value)}
                type="date"
                value={occurredBefore}
              />
            </label>
            <label className="fleet-filter">
              <span>Decision filter</span>
              <select
                aria-label="Decision filter"
                onChange={(event) =>
                  onDecisionFilterChange(event.target.value as PolicyDecisionFilter)
                }
                value={decisionFilter}
              >
                <option value="all">All decisions</option>
                <option value="allowed">Allowed</option>
                <option value="denied">Denied</option>
                <option value="manual_review">Manual review</option>
              </select>
            </label>
            <label className="fleet-filter">
              <span>Action filter</span>
              <select
                aria-label="Action filter"
                onChange={(event) =>
                  onActionFilterChange(event.target.value as PolicyActionFilter)
                }
                value={actionFilter}
              >
                <option value="all">All actions</option>
                {actionOptions.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {formatPolicyAction(actionType)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {decisions.length > 0 ? (
          <>
            <p className="empty-copy">
              Showing {decisions.length} of {totalDecisions} policy decisions.
            </p>
            <div className="fleet-card-list">
              {decisions.map(renderPolicyDecision)}
            </div>
            <div className="fleet-inline-actions">
              <Button
                disabled={page <= 1 || isLoading}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <span className="empty-copy">
                Page {page} of {Math.max(totalPages, 1)} · {pageSize} per page
              </span>
              <Button
                disabled={totalPages === 0 || page >= totalPages || isLoading}
                icon="arrow-right"
                iconPosition="trailing"
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <p className="empty-copy">
            {actionFilter !== "all" ||
            decisionFilter !== "all" ||
            repositoryFilter.trim().length > 0 ||
            occurredAfter ||
            occurredBefore
              ? "No policy decisions match the current filters."
              : "No policy decisions have been recorded yet."}
          </p>
        )}
      </div>
    </Panel>
  );
}
