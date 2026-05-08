import type {
  ExecutionBatchExecuteResponse,
  ExecutionBatchPlanResponse
} from "@repo-guardian/shared-types";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { Button, EmptyState } from "./ui";

export type BatchExecutionPlanOption = {
  eligibleActions: number;
  planId: string;
  repositoryFullName: string;
  totalActions: number;
};

type BatchExecutionPanelProps = {
  approvalGranted: boolean;
  errorMessage: string | null;
  executeResult: ExecutionBatchExecuteResponse | null;
  isExecuting: boolean;
  isPreviewLoading: boolean;
  onApprovalChange: (approvalGranted: boolean) => void;
  onRequestExecute: () => void;
  onRequestPreview: () => void;
  onTogglePlan: (planId: string) => void;
  planOptions: BatchExecutionPlanOption[];
  preview: ExecutionBatchPlanResponse | null;
  selectedPlanIds: string[];
};

export function BatchExecutionPanel({
  approvalGranted,
  errorMessage,
  executeResult,
  isExecuting,
  isPreviewLoading,
  onApprovalChange,
  onRequestExecute,
  onRequestPreview,
  onTogglePlan,
  planOptions,
  preview,
  selectedPlanIds
}: BatchExecutionPanelProps) {
  const selectedCount = selectedPlanIds.length;
  const isPreviewDisabled = isPreviewLoading || selectedCount === 0;
  const isExecuteDisabled = isExecuting || !approvalGranted || !preview;

  return (
    <Panel
      className="panel-wide"
      eyebrow="Batch Execution"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={`${selectedCount} selected`}
            tone={selectedCount > 0 ? "active" : "muted"}
          />
          <StatusBadge label="Max 5 plans" tone="up-next" />
        </div>
      }
      title="Supervised batch queue"
    >
      <div className="batch-execution-panel">
        <EmptyState>Select existing planned execution records, preview the bounded
          batch, then approve the batch before any GitHub write actions run.</EmptyState>

        {planOptions.length > 0 ? (
          <div className="batch-plan-list" role="list">
            {planOptions.map((plan) => (
              <label className="batch-plan-row" key={plan.planId}>
                <input
                  checked={selectedPlanIds.includes(plan.planId)}
                  disabled={
                    !selectedPlanIds.includes(plan.planId) &&
                    selectedPlanIds.length >= 5
                  }
                  onChange={() => onTogglePlan(plan.planId)}
                  type="checkbox"
                />
                <span>
                  <strong>{plan.repositoryFullName}</strong>
                  <code>{plan.planId}</code>
                </span>
                <span className="batch-plan-row-meta">
                  {plan.eligibleActions} eligible / {plan.totalActions} actions
                </span>
              </label>
            ))}
          </div>
        ) : (
          <EmptyState>No executable planned records are available in the current fleet snapshot.</EmptyState>
        )}

        {preview ? (
          <div className="batch-preview">
            <p className="execution-note">
              Batch <code>{preview.batchId}</code> covers{" "}
              {preview.summary.planCount} plans across {preview.summary.repositories} repositories.
            </p>
            <label className="approval-control">
              <input
                checked={approvalGranted}
                onChange={(event) => onApprovalChange(event.target.checked)}
                type="checkbox"
              />
              <span>{preview.approval.confirmationText}</span>
            </label>
          </div>
        ) : null}

        {executeResult ? (
          <div className="batch-preview">
            <p className="execution-note">
              Batch finished as <strong>{executeResult.status}</strong>:{" "}
              {executeResult.summary.completedPlans} completed,{" "}
              {executeResult.summary.failedPlans} failed.
            </p>
            {executeResult.retry.retryablePlanIds.length > 0 ? (
              <p className="execution-note">{executeResult.retry.guidance}</p>
            ) : null}
          </div>
        ) : null}

        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="fleet-inline-actions">
          <Button
            disabled={isPreviewDisabled}
            icon={isPreviewLoading ? undefined : "spark"}
            loading={isPreviewLoading}
            onClick={onRequestPreview}
            variant="primary"
          >
            {isPreviewLoading ? "Creating preview..." : "Create batch preview"}
          </Button>
          <Button
            disabled={isExecuteDisabled}
            icon={isExecuting ? undefined : "play"}
            loading={isExecuting}
            onClick={onRequestExecute}
            variant="primary"
          >
            {isExecuting ? "Executing batch..." : "Execute approved batch"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
