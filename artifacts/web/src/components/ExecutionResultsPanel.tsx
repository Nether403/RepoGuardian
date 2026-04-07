import type {
  ExecutionActionPlan,
  ExecutionResult
} from "@repo-guardian/shared-types";
import type { ReactNode } from "react";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type ExecutionResultsPanelProps = {
  result: ExecutionResult | null;
};

function formatValue(value: string): string {
  return value.replace(/_/gu, " ");
}

function getStatusTone(status: ExecutionResult["status"]): "active" | "muted" | "warning" {
  if (status === "completed" || status === "planned") {
    return "active";
  }

  return status === "blocked" ? "warning" : "muted";
}

function getActionTone(action: ExecutionActionPlan): "active" | "muted" | "warning" {
  if (action.succeeded) {
    return "active";
  }

  return action.blocked || action.errorMessage ? "warning" : "muted";
}

function renderRemoteMetadata(action: ExecutionActionPlan) {
  const items: { label: string; value: ReactNode }[] = [];

  if (action.issueNumber) {
    items.push({
      label: "Issue",
      value: action.issueUrl ? (
        <a href={action.issueUrl} rel="noreferrer" target="_blank">
          #{action.issueNumber}
        </a>
      ) : (
        `#${action.issueNumber}`
      )
    });
  }

  if (action.branchName) {
    items.push({
      label: "Branch",
      value: <code>{action.branchName}</code>
    });
  }

  if (action.commitSha) {
    items.push({
      label: "Commit",
      value: <code>{action.commitSha}</code>
    });
  }

  if (action.pullRequestNumber) {
    items.push({
      label: "Pull request",
      value: action.pullRequestUrl ? (
        <a href={action.pullRequestUrl} rel="noreferrer" target="_blank">
          #{action.pullRequestNumber}
        </a>
      ) : (
        `#${action.pullRequestNumber}`
      )
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="execution-metadata">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExecutionResultsPanel({ result }: ExecutionResultsPanelProps) {
  return (
    <Panel
      className="panel-wide"
      eyebrow="Execution Result"
      footer={
        result ? (
          <div className="badge-row">
            <StatusBadge label={`${result.summary.totalActions} actions`} tone="muted" />
            <StatusBadge
              label={`${result.summary.eligibleActions} eligible`}
              tone="active"
            />
            <StatusBadge
              label={`${result.summary.blockedActions} blocked`}
              tone={result.summary.blockedActions > 0 ? "warning" : "muted"}
            />
          </div>
        ) : null
      }
      title="Execution results"
    >
      {result ? (
        <div className="execution-results">
          <div className="badge-row">
            <StatusBadge label={formatValue(result.mode)} tone="muted" />
            <StatusBadge
              label={formatValue(result.status)}
              tone={getStatusTone(result.status)}
            />
            <StatusBadge
              label={`approval ${formatValue(result.approvalStatus)}`}
              tone={result.approvalStatus === "granted" ? "active" : "warning"}
            />
          </div>
          {result.errors.length > 0 ? (
            <ul className="warning-list" aria-label="Execution errors">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          {result.warnings.length > 0 ? (
            <ul className="warning-list" aria-label="Execution warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="execution-action-list">
            {result.actions.map((action) => (
              <article className="execution-action-card" key={action.id}>
                <div className="candidate-selection-header">
                  <div>
                    <p className="subsection-label">{formatValue(action.actionType)}</p>
                    <h3>{action.title}</h3>
                  </div>
                  <div className="badge-row">
                    <StatusBadge
                      label={formatValue(action.eligibility)}
                      tone={action.eligibility === "eligible" ? "active" : "warning"}
                    />
                    <StatusBadge
                      label={action.succeeded ? "succeeded" : action.blocked ? "blocked" : action.attempted ? "attempted" : "not attempted"}
                      tone={getActionTone(action)}
                    />
                  </div>
                </div>
                <p className="trace-copy">{action.reason}</p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    <code>{action.targetId}</code>
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {formatValue(action.targetType)}
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    approval {formatValue(action.approvalStatus)}
                  </span>
                </div>
                {action.errorMessage ? (
                  <p className="form-message form-message-error">{action.errorMessage}</p>
                ) : null}
                {renderRemoteMetadata(action)}
                {action.plannedSteps.length > 0 ? (
                  <details className="trace-expander">
                    <summary>Planned steps</summary>
                    <ul className="simple-list">
                      {action.plannedSteps.map((step) => (
                        <li key={`${action.id}:${step}`}>{step}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-copy">
          Run a dry-run plan or approved execution to see action-by-action results.
        </p>
      )}
    </Panel>
  );
}
