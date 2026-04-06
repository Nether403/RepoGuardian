import type {
  ApprovalStatus,
  ExecutionActionPlan,
  ExecutionMode
} from "@repo-guardian/shared-types";

type ApprovalGate = {
  approvalNotes: string[];
  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
};

function isWriteAction(actionType: ExecutionActionPlan["actionType"]): boolean {
  return (
    actionType === "create_issue" ||
    actionType === "create_branch" ||
    actionType === "commit_patch" ||
    actionType === "create_pr"
  );
}

export function createApprovalGate(input: {
  actionType: ExecutionActionPlan["actionType"];
  approvalGranted: boolean;
  mode: ExecutionMode;
}): ApprovalGate {
  if (!isWriteAction(input.actionType)) {
    return {
      approvalNotes: [
        input.mode === "dry_run"
          ? "This is a planning-only step; no remote write is performed."
          : "This step does not perform a remote write."
      ],
      approvalRequired: false,
      approvalStatus: "not_required"
    };
  }

  if (input.mode === "dry_run") {
    return {
      approvalNotes: [
        "Dry-run planning does not perform remote writes.",
        "Explicit user approval would be required before this action could execute."
      ],
      approvalRequired: true,
      approvalStatus: "required"
    };
  }

  if (input.approvalGranted) {
    return {
      approvalNotes: [
        "Explicit user approval was required for this write action.",
        "Explicit user approval was granted for this execution request."
      ],
      approvalRequired: true,
      approvalStatus: "granted"
    };
  }

  return {
    approvalNotes: [
      "Explicit user approval is required before this write action can run.",
      "Approval was not granted in the execution request, so the write action remains blocked."
    ],
    approvalRequired: true,
    approvalStatus: "denied"
  };
}

export function createExecutionApprovalSummary(input: {
  actions: ExecutionActionPlan[];
  approvalGranted: boolean;
  mode: ExecutionMode;
}): ApprovalGate {
  const hasWriteActions = input.actions.some((action) => action.approvalRequired);

  if (!hasWriteActions) {
    return {
      approvalNotes: ["No write-oriented actions were included in this execution result."],
      approvalRequired: false,
      approvalStatus: "not_required"
    };
  }

  if (input.mode === "dry_run") {
    return {
      approvalNotes: [
        "Approval is not needed to generate a dry-run plan.",
        "Any later write-oriented action remains approval-gated."
      ],
      approvalRequired: true,
      approvalStatus: "required"
    };
  }

  if (input.approvalGranted) {
    return {
      approvalNotes: [
        "Write-oriented actions required explicit approval.",
        "Approval was granted for this execution request."
      ],
      approvalRequired: true,
      approvalStatus: "granted"
    };
  }

  return {
    approvalNotes: [
      "Write-oriented actions required explicit approval.",
      "Approval was not granted, so no write-oriented action was executed."
    ],
    approvalRequired: true,
    approvalStatus: "denied"
  };
}
