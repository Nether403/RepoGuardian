import type {
  ApprovalStatus,
  ExecutionActionPlan,
  ExecutionMode
} from "@repo-guardian/shared-types";

type ApprovalGate = {
  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
  approvalNotes: string[];
};

export function createApprovalGate(actionType: ExecutionActionPlan["actionType"]): ApprovalGate {
  const writeOriented = actionType === "create_issue" || actionType === "create_pr";

  if (writeOriented) {
    return {
      approvalNotes: [
        "Dry-run planning does not perform remote writes.",
        "Explicit user approval is required before this action can run in a later milestone."
      ],
      approvalRequired: true,
      approvalStatus: "required"
    };
  }

  return {
    approvalNotes: [
      "This step is planned only; no remote write is performed in Milestone 5A."
    ],
    approvalRequired: false,
    approvalStatus: "not_required"
  };
}

export function createExecutionApprovalSummary(input: {
  actions: ExecutionActionPlan[];
  mode: ExecutionMode;
}): ApprovalGate {
  if (input.mode === "execute_approved") {
    return {
      approvalNotes: [
        "Real execution is not supported in Milestone 5A.",
        "Dry-run planning is the only supported execution mode in this milestone."
      ],
      approvalRequired: true,
      approvalStatus: "required"
    };
  }

  if (input.actions.some((action) => action.approvalRequired)) {
    return {
      approvalNotes: [
        "Approval is not needed to generate a dry-run plan.",
        "Any later write-oriented action remains approval-gated."
      ],
      approvalRequired: true,
      approvalStatus: "required"
    };
  }

  return {
    approvalNotes: ["No write-oriented actions were included in this dry-run plan."],
    approvalRequired: false,
    approvalStatus: "not_required"
  };
}
