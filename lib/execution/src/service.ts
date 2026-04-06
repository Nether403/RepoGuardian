import { randomUUID } from "node:crypto";
import type { ExecutionPlanningContext, ExecutionRequest, ExecutionResult } from "@repo-guardian/shared-types";
import { ExecutionResultSchema } from "@repo-guardian/shared-types";
import { createExecutionApprovalSummary } from "./approvals.js";
import {
  buildDryRunActions,
  buildUnsupportedExecutionActions
} from "./actions.js";
import { createExecutionSummary, uniqueSorted } from "./utils.js";

export type ExecutionPlanInput = {
  analysis: ExecutionPlanningContext;
  mode: ExecutionRequest["mode"];
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
};

function buildExecutionWarnings(actions: ExecutionResult["actions"]): string[] {
  return uniqueSorted(
    actions
      .filter((action) => action.eligibility !== "eligible")
      .map((action) => action.reason)
  );
}

function buildExecutionErrors(input: {
  mode: ExecutionRequest["mode"];
}): string[] {
  if (input.mode === "execute_approved") {
    return ["Execution mode execute_approved is not supported in Milestone 5A."];
  }

  return [];
}

export function createExecutionPlanResult(
  input: ExecutionPlanInput
): ExecutionResult {
  const startedAt = new Date().toISOString();
  const actions =
    input.mode === "dry_run"
      ? buildDryRunActions(input)
      : buildUnsupportedExecutionActions(input);
  const approval = createExecutionApprovalSummary({
    actions,
    mode: input.mode
  });
  const warnings = buildExecutionWarnings(actions);
  const errors = buildExecutionErrors({ mode: input.mode });
  const summary = createExecutionSummary(
    {
      selectedIssueCandidateIds: input.selectedIssueCandidateIds,
      selectedPRCandidateIds: input.selectedPRCandidateIds
    },
    actions
  );
  const status =
    input.mode === "execute_approved" || summary.eligibleActions === 0
      ? "blocked"
      : "planned";
  const completedAt = new Date().toISOString();

  return ExecutionResultSchema.parse({
    actions,
    approvalNotes: approval.approvalNotes,
    approvalRequired: approval.approvalRequired,
    approvalStatus: approval.approvalStatus,
    completedAt,
    errors,
    executionId: randomUUID(),
    mode: input.mode,
    startedAt,
    status,
    summary,
    warnings
  });
}
