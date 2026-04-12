import type {
  ExecutionActionPlan,
  ExecutionPlanRequest,
  ExecutionSummary
} from "@repo-guardian/shared-types";

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function createExecutionSummary(
  request: Pick<
    ExecutionPlanRequest,
    "selectedIssueCandidateIds" | "selectedPRCandidateIds"
  >,
  actions: ExecutionActionPlan[]
): ExecutionSummary {
  return {
    approvalRequiredActions: actions.filter((action) => action.approvalRequired).length,
    blockedActions: actions.filter((action) => action.eligibility === "blocked").length,
    eligibleActions: actions.filter((action) => action.eligibility === "eligible").length,
    issueSelections: request.selectedIssueCandidateIds.length,
    prSelections: request.selectedPRCandidateIds.length,
    skippedActions: actions.filter((action) => action.actionType === "skip").length,
    totalActions: actions.length,
    totalSelections:
      request.selectedIssueCandidateIds.length + request.selectedPRCandidateIds.length
  };
}
