import type {
  AsyncPlanSelectionStrategy,
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

export type EvaluateExecutionPlanPolicyInput = {
  selectionStrategy?: AsyncPlanSelectionStrategy;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
};

export type EvaluateAnalysisPolicyInput = {
  repositoryFullName: string;
};

export type EvaluateSweepSchedulePolicyInput = {
  cadence: string;
  selectionStrategy: string;
};

function isWriteAction(actionType: ExecutionActionPlan["actionType"]): boolean {
  return (
    actionType === "create_issue" ||
    actionType === "create_branch" ||
    actionType === "commit_patch" ||
    actionType === "create_pr"
  );
}

export function evaluateAnalysisPolicy(
  input: EvaluateAnalysisPolicyInput
): ExecutionWritePolicyDecision {
  return {
    decision: "allowed",
    details: {
      policyRecordId: "default:workspace:supervised-analysis",
      repositoryFullName: input.repositoryFullName
    },
    reason: "Supervised repository analysis may proceed."
  };
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

export function evaluateExecutionPlanPolicy(
  input: EvaluateExecutionPlanPolicyInput
): ExecutionWritePolicyDecision {
  const details = {
    issueSelections: input.selectedIssueCandidateIds.length,
    policyRecordId: "default:repository:deterministic-pr-candidates",
    prSelections: input.selectedPRCandidateIds.length,
    selectionStrategy: input.selectionStrategy ?? "provided_candidates",
    totalSelections:
      input.selectedIssueCandidateIds.length + input.selectedPRCandidateIds.length
  };

  if (input.selectionStrategy === "all_executable_prs") {
    return {
      decision: "allowed",
      details,
      reason: "Execution plan generation may proceed for executable PR candidates."
    };
  }

  if (details.totalSelections === 0) {
    return {
      decision: "denied",
      details,
      reason: "Execution plan generation is denied because no candidates were selected."
    };
  }

  return {
    decision: "allowed",
    details,
    reason: "Execution plan generation may proceed for selected candidates."
  };
}

export function evaluateSweepSchedulePolicy(
  input: EvaluateSweepSchedulePolicyInput
): ExecutionWritePolicyDecision {
  return {
    decision: "allowed",
    details: {
      cadence: input.cadence,
      policyRecordId: "default:workspace:plan-only-sweeps",
      selectionStrategy: input.selectionStrategy
    },
    reason: "Plan-only sweep scheduling may proceed."
  };
}
