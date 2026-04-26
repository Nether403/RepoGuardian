import type {
  ExecutionActionPlan,
  ExecutionPlanLifecycleStatus,
  PolicyDecision
} from "@repo-guardian/shared-types";

type ExecutionWritePolicyAction = Pick<
  ExecutionActionPlan,
  "actionType" | "eligibility"
>;

export type ExecutionWritePolicyDecision = {
  decision: PolicyDecision;
  details: Record<string, unknown>;
  reason: string;
};

export type EvaluateExecutionWritePolicyInput = {
  actions: ExecutionWritePolicyAction[];
  planHashMatches: boolean;
  planStatus: ExecutionPlanLifecycleStatus;
};

function isWriteAction(actionType: ExecutionActionPlan["actionType"]): boolean {
  return (
    actionType === "create_issue" ||
    actionType === "create_branch" ||
    actionType === "commit_patch" ||
    actionType === "create_pr"
  );
}

export function evaluateExecutionWritePolicy(
  input: EvaluateExecutionWritePolicyInput
): ExecutionWritePolicyDecision {
  const writeActions = input.actions.filter((action) => isWriteAction(action.actionType));
  const eligibleWriteActions = writeActions.filter(
    (action) => action.eligibility === "eligible"
  );
  const details = {
    eligibleWriteActions: eligibleWriteActions.length,
    planHashMatches: input.planHashMatches,
    planStatus: input.planStatus,
    totalActions: input.actions.length,
    writeActions: writeActions.length
  };

  if (!input.planHashMatches) {
    return {
      decision: "denied",
      details,
      reason:
        "Execution is denied because the approved plan hash does not match the persisted plan."
    };
  }

  if (input.planStatus !== "planned") {
    return {
      decision: "denied",
      details,
      reason: `Execution is denied because the plan status is ${input.planStatus}.`
    };
  }

  return {
    decision: "allowed",
    details,
    reason: "Approved write execution may proceed."
  };
}
