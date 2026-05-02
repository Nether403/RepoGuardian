import { useState } from "react";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import type { DiffPreviewFile, ExecutionPlanResponse } from "@repo-guardian/shared-types";

export type ExecutionValidationFailure = {
  kind: "drift" | "synthesis_error" | "missing_preview";
  message: string;
  filePaths: string[];
  candidateIds: string[];
  failedPlanId?: string | null;
};

const VALIDATION_KIND_LABELS: Record<ExecutionValidationFailure["kind"], string> = {
  drift: "Repository drift",
  synthesis_error: "Patch synthesis failed",
  missing_preview: "Approved preview missing"
};

type DiffViewMode = "unified" | "before-after";

function ExecutionDiffFileView({ file }: { file: DiffPreviewFile }) {
  const [mode, setMode] = useState<DiffViewMode>("unified");
  const isTruncated =
    file.diffTruncated || file.beforeTruncated || file.afterTruncated;

  return (
    <div className="execution-diff-file">
      <div className="execution-diff-file-header">
        <p className="subsection-label">
          <code>{file.path}</code>
          {isTruncated ? " (truncated)" : ""}
        </p>
        <div className="execution-diff-toggle" role="group" aria-label="Diff view mode">
          <button
            aria-pressed={mode === "unified"}
            className={
              mode === "unified"
                ? "execution-diff-toggle-button is-active"
                : "execution-diff-toggle-button"
            }
            onClick={() => setMode("unified")}
            type="button"
          >
            Unified
          </button>
          <button
            aria-pressed={mode === "before-after"}
            className={
              mode === "before-after"
                ? "execution-diff-toggle-button is-active"
                : "execution-diff-toggle-button"
            }
            onClick={() => setMode("before-after")}
            type="button"
          >
            Before / after
          </button>
        </div>
      </div>
      {mode === "unified" ? (
        <pre className="execution-diff-pre">
          <code>{file.unifiedDiff}</code>
        </pre>
      ) : (
        <div className="execution-diff-before-after">
          <div className="execution-diff-side">
            <p className="subsection-label">
              Before{file.beforeTruncated ? " (truncated)" : ""}
            </p>
            <pre className="execution-diff-pre">
              <code>{file.before.length > 0 ? file.before : "(empty)"}</code>
            </pre>
          </div>
          <div className="execution-diff-side">
            <p className="subsection-label">
              After{file.afterTruncated ? " (truncated)" : ""}
            </p>
            <pre className="execution-diff-pre">
              <code>{file.after.length > 0 ? file.after : "(empty)"}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

type ExecutionPlannerPanelProps = {
  approvalGranted: boolean;
  executionErrorMessage: string | null;
  executionPlan: ExecutionPlanResponse | null;
  isSubmittingPlan: boolean;
  isSubmittingExecute: boolean;
  onApprovalChange: (approvalGranted: boolean) => void;
  onRequestPlan: () => void;
  onRegeneratePlanFromValidationFailure?: (
    failure: ExecutionValidationFailure
  ) => void;
  onRequestExecute: () => void;
  selectedIssueCount: number;
  selectedPRCount: number;
  validationFailure?: ExecutionValidationFailure | null;
};

export function ExecutionPlannerPanel({
  approvalGranted,
  executionErrorMessage,
  executionPlan,
  isSubmittingPlan,
  isSubmittingExecute,
  onApprovalChange,
  onRequestPlan,
  onRegeneratePlanFromValidationFailure,
  onRequestExecute,
  selectedIssueCount,
  selectedPRCount,
  validationFailure
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
            {executionPlan.actions.length > 0 ? (
              <div className="execution-diff-previews">
                <p className="subsection-label">Patch previews</p>
                {executionPlan.actions.map((action) => {
                  const preview = action.diffPreview;
                  const isEligible = action.eligibility === "eligible";

                  if (!preview) {
                    return (
                      <div
                        className="execution-diff-preview execution-diff-preview-empty"
                        key={`diff:${action.id}`}
                      >
                        <p className="subsection-label">
                          <code>{action.title}</code>
                        </p>
                        <p className="execution-diff-empty-hint">
                          {isEligible
                            ? "No diff available — preview will be generated at execute time."
                            : "No diff available for this action."}
                        </p>
                      </div>
                    );
                  }

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
                      ) : preview.files.length === 0 ? (
                        <p className="execution-diff-empty-hint">
                          No file changes were synthesised for this action.
                        </p>
                      ) : (
                        preview.files.map((file) => (
                          <ExecutionDiffFileView
                            file={file}
                            key={`diff-file:${action.id}:${file.path}`}
                          />
                        ))
                      )}
                    </details>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {validationFailure ? (
          <div
            className="form-message form-message-error execution-validation-banner"
            data-testid="execution-validation-banner"
            role="alert"
          >
            <p>
              <strong>{VALIDATION_KIND_LABELS[validationFailure.kind]}:</strong>{" "}
              {validationFailure.message}
            </p>
            {validationFailure.filePaths.length > 0 ? (
              <>
                <p className="subsection-label">Affected files</p>
                <ul
                  className="simple-list execution-validation-paths"
                  data-testid="execution-validation-paths"
                >
                  {validationFailure.filePaths.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {onRegeneratePlanFromValidationFailure ? (
              <button
                className="submit-button execution-submit-button"
                data-testid="execution-validation-regenerate"
                disabled={isSubmittingPlan}
                onClick={() =>
                  onRegeneratePlanFromValidationFailure(validationFailure)
                }
                type="button"
              >
                {isSubmittingPlan ? "Regenerating plan..." : "Regenerate plan"}
              </button>
            ) : null}
          </div>
        ) : null}

        {executionErrorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {executionErrorMessage}
          </p>
        ) : null}

        <div className="fleet-inline-actions">
          <button
            className="submit-button execution-submit-button"
            disabled={isPlanDisabled}
            onClick={onRequestPlan}
            type="button"
          >
            {isSubmittingPlan
              ? "Generating plan..."
              : executionPlan
                ? "Regenerate plan"
                : "Generate plan"}
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
