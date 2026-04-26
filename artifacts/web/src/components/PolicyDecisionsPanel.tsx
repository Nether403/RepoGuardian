import { useMemo, useState } from "react";
import type { PolicyDecisionEvent } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type PolicyDecisionsPanelProps = {
  decisions: PolicyDecisionEvent[];
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

export function PolicyDecisionsPanel({ decisions }: PolicyDecisionsPanelProps) {
  const [actionFilter, setActionFilter] = useState<PolicyActionFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<PolicyDecisionFilter>("all");
  const actionOptions = useMemo(
    () => Array.from(new Set(decisions.map((decision) => decision.actionType))).sort(),
    [decisions]
  );
  const visibleDecisions = useMemo(
    () =>
      decisions.filter(
        (decision) =>
          (actionFilter === "all" || decision.actionType === actionFilter) &&
          (decisionFilter === "all" || decision.decision === decisionFilter)
      ),
    [actionFilter, decisionFilter, decisions]
  );

  return (
    <Panel
      className="panel-wide"
      eyebrow="Policy History"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${decisions.length} recent decisions`}
            tone={decisions.length > 0 ? "active" : "muted"}
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
              <span>Decision filter</span>
              <select
                aria-label="Decision filter"
                onChange={(event) =>
                  setDecisionFilter(event.target.value as PolicyDecisionFilter)
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
                  setActionFilter(event.target.value as PolicyActionFilter)
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
          visibleDecisions.length > 0 ? (
            <>
              <p className="empty-copy">
                Showing {visibleDecisions.length} of {decisions.length} recent policy
                decisions.
              </p>
              <div className="fleet-card-list">
                {visibleDecisions.map(renderPolicyDecision)}
              </div>
            </>
          ) : (
            <p className="empty-copy">No policy decisions match the current filters.</p>
          )
        ) : (
          <p className="empty-copy">No policy decisions have been recorded yet.</p>
        )}
      </div>
    </Panel>
  );
}
