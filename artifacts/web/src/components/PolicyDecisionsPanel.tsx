import type { PolicyDecisionEvent } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type PolicyDecisionsPanelProps = {
  decisions: PolicyDecisionEvent[];
};

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

function renderPolicyDecision(decision: PolicyDecisionEvent) {
  const scopeLabel =
    decision.repositoryFullName ??
    decision.githubInstallationId ??
    decision.workspaceId;

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
    </article>
  );
}

export function PolicyDecisionsPanel({ decisions }: PolicyDecisionsPanelProps) {
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
        <p className="empty-copy">
          Recent policy evaluations for planning, sweep scheduling, and approved
          GitHub write execution.
        </p>
        {decisions.length > 0 ? (
          <div className="fleet-card-list">
            {decisions.map(renderPolicyDecision)}
          </div>
        ) : (
          <p className="empty-copy">No policy decisions have been recorded yet.</p>
        )}
      </div>
    </Panel>
  );
}
