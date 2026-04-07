import type { ExecutionMode } from "@repo-guardian/shared-types";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type ExecutionPlannerPanelProps = {
  approvalGranted: boolean;
  executionErrorMessage: string | null;
  isSubmitting: boolean;
  mode: ExecutionMode;
  onApprovalChange: (approvalGranted: boolean) => void;
  onModeChange: (mode: ExecutionMode) => void;
  onSubmit: () => void;
  selectedIssueCount: number;
  selectedPRCount: number;
};

export function ExecutionPlannerPanel({
  approvalGranted,
  executionErrorMessage,
  isSubmitting,
  mode,
  onApprovalChange,
  onModeChange,
  onSubmit,
  selectedIssueCount,
  selectedPRCount
}: ExecutionPlannerPanelProps) {
  const totalSelections = selectedIssueCount + selectedPRCount;
  const isExecuteMode = mode === "execute_approved";
  const isSubmitDisabled =
    isSubmitting || totalSelections === 0 || (isExecuteMode && !approvalGranted);

  return (
    <Panel
      className="panel-wide"
      eyebrow="Execution"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${selectedIssueCount} issue${selectedIssueCount === 1 ? "" : "s"}`}
            tone={selectedIssueCount > 0 ? "active" : "muted"}
          />
          <StatusBadge
            label={`${selectedPRCount} PR${selectedPRCount === 1 ? "" : "s"}`}
            tone={selectedPRCount > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Execution planner"
    >
      <div className="execution-planner">
        <p className="empty-copy">
          Select candidate issues and PRs, preview a dry-run plan, or explicitly approve
          execution for supported GitHub write-back actions.
        </p>
        <div className="readiness-filter-row" aria-label="Execution mode">
          <label>
            <span>Mode</span>
            <select
              onChange={(event) => onModeChange(event.target.value as ExecutionMode)}
              value={mode}
            >
              <option value="dry_run">Dry-run plan</option>
              <option value="execute_approved">Execute approved actions</option>
            </select>
          </label>
        </div>
        {isExecuteMode ? (
          <label className="approval-control">
            <input
              checked={approvalGranted}
              onChange={(event) => onApprovalChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              I explicitly approve Repo Guardian to create the selected GitHub Issues
              and open supported Pull Requests for this repository.
            </span>
          </label>
        ) : (
          <p className="execution-note">
            Dry-run mode does not perform GitHub write actions and does not require approval.
          </p>
        )}
        {executionErrorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {executionErrorMessage}
          </p>
        ) : null}
        <button
          className="submit-button execution-submit-button"
          disabled={isSubmitDisabled}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting
            ? "Submitting execution request..."
            : isExecuteMode
              ? "Execute approved actions"
              : "Preview dry-run plan"}
        </button>
      </div>
    </Panel>
  );
}
