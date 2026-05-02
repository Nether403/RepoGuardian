import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import type { ExecutionPlanResponse } from "@repo-guardian/shared-types";

type ExecutionPlannerPanelProps = {
  approvalGranted: boolean;
  executionErrorMessage: string | null;
  executionPlan: ExecutionPlanResponse | null;
  isSubmittingPlan: boolean;
  isSubmittingExecute: boolean;
  onApprovalChange: (approvalGranted: boolean) => void;
  onRequestPlan: () => void;
  onRequestExecute: () => void;
  selectedIssueCount: number;
  selectedPRCount: number;
};

export function ExecutionPlannerPanel({
  approvalGranted,
  executionErrorMessage,
  executionPlan,
  isSubmittingPlan,
  isSubmittingExecute,
  onApprovalChange,
  onRequestPlan,
  onRequestExecute,
  selectedIssueCount,
  selectedPRCount
}: ExecutionPlannerPanelProps) {
  const totalSelections = selectedIssueCount + selectedPRCount;
  const isPlanDisabled = isSubmittingPlan || totalSelections === 0;
  const isExecuteDisabled = isSubmittingExecute || !approvalGranted || !executionPlan;

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
          Select candidate issues and PRs to preview an execution plan.
          The plan must be explicitly approved before any GitHub write actions occur.
        </p>

        {!executionPlan ? (
          <p className="execution-note">
            Planning mode does not perform GitHub write actions and does not require approval.
          </p>
        ) : (
          <div className="execution-plan-summary">
            <p className="execution-note">
              Plan <code>{executionPlan.planId}</code> generated successfully.
            </p>
            <label className="approval-control">
              <input
                checked={approvalGranted}
                onChange={(event) => onApprovalChange(event.target.checked)}
                type="checkbox"
              />
              <span>
                {executionPlan.approval.confirmationText}
              </span>
            </label>
            {executionPlan.actions.some((action) => action.diffPreview) ? (
              <div className="execution-diff-previews">
                <p className="subsection-label">Patch previews</p>
                {executionPlan.actions
                  .filter((action) => action.diffPreview)
                  .map((action) => {
                    const preview = action.diffPreview!;

                    return (
                      <details
                        className="execution-diff-preview"
                        key={`diff:${action.id}`}
                      >
                        <summary>
                          <code>{action.title}</code>
                          <span className="execution-diff-meta">
                            {preview.synthesisError
                              ? "synthesis failed"
                              : `${preview.files.length} file${
                                  preview.files.length === 1 ? "" : "s"
                                }${preview.truncated ? " (truncated)" : ""}`}
                          </span>
                        </summary>
                        {preview.synthesisError ? (
                          <p className="form-message form-message-error">
                            {preview.synthesisError}
                          </p>
                        ) : (
                          preview.files.map((file) => (
                            <div
                              className="execution-diff-file"
                              key={`diff-file:${action.id}:${file.path}`}
                            >
                              <p className="subsection-label">
                                <code>{file.path}</code>
                                {file.diffTruncated ||
                                file.beforeTruncated ||
                                file.afterTruncated
                                  ? " (truncated)"
                                  : ""}
                              </p>
                              <pre className="execution-diff-pre">
                                <code>{file.unifiedDiff}</code>
                              </pre>
                            </div>
                          ))
                        )}
                      </details>
                    );
                  })}
              </div>
            ) : null}
          </div>
        )}

        {executionErrorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {executionErrorMessage}
          </p>
        ) : null}

        <div className="button-group" style={{ display: "flex", gap: "1rem" }}>
          <button
            className="submit-button execution-submit-button"
            disabled={isPlanDisabled}
            onClick={onRequestPlan}
            type="button"
          >
            {isSubmittingPlan ? "Generating plan..." : (executionPlan ? "Regenerate plan" : "Generate plan")}
          </button>
          
          {executionPlan ? (
            <button
              className="submit-button execution-submit-button"
              disabled={isExecuteDisabled}
              onClick={onRequestExecute}
              type="button"
            >
              {isSubmittingExecute ? "Executing..." : "Execute approved actions"}
            </button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
