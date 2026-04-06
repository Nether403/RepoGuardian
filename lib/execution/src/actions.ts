import type {
  ExecutionActionPlan,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import { createApprovalGate } from "./approvals.js";

function createAction(
  input: Omit<
    ExecutionActionPlan,
    "approvalNotes" | "approvalRequired" | "approvalStatus"
  >
): ExecutionActionPlan {
  const approval = createApprovalGate(input.actionType);

  return {
    ...input,
    approvalNotes: approval.approvalNotes,
    approvalRequired: approval.approvalRequired,
    approvalStatus: approval.approvalStatus
  };
}

function buildIssueAction(
  candidate: ExecutionPlanningContext["issueCandidates"][number]
): ExecutionActionPlan {
  return createAction({
    actionType: "create_issue",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "eligible",
    id: `execution:create_issue:${candidate.id}`,
    linkedIssueCandidateIds: [candidate.id],
    linkedPRCandidateIds: [],
    plannedSteps: [
      "Review the candidate title, summary, labels, and acceptance criteria.",
      "Confirm the issue scope is still the preferred tracking unit for the current repository state.",
      "Create the GitHub issue only after explicit approval in a later write-enabled milestone."
    ],
    reason:
      "The selected issue candidate exists in the provided analysis context and is concrete enough to become a tracked issue later.",
    targetId: candidate.id,
    targetType: "issue_candidate",
    title: candidate.title
  });
}

function buildUnknownIssueAction(id: string): ExecutionActionPlan {
  return createAction({
    actionType: "skip",
    affectedPackages: [],
    affectedPaths: [],
    eligibility: "blocked",
    id: `execution:skip:issue:${id}`,
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Remove or correct the unknown issue candidate ID before planning execution again."],
    reason: "The selected issue candidate ID does not exist in the provided analysis context.",
    targetId: id,
    targetType: "issue_candidate",
    title: `Skip unknown issue candidate ${id}`
  });
}

function buildUnknownPRAction(id: string): ExecutionActionPlan {
  return createAction({
    actionType: "skip",
    affectedPackages: [],
    affectedPaths: [],
    eligibility: "blocked",
    id: `execution:skip:pr:${id}`,
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Remove or correct the unknown PR candidate ID before planning execution again."],
    reason: "The selected PR candidate ID does not exist in the provided analysis context.",
    targetId: id,
    targetType: "pr_candidate",
    title: `Skip unknown PR candidate ${id}`
  });
}

function buildMissingPatchPlanAction(candidate: PRCandidate): ExecutionActionPlan {
  return createAction({
    actionType: "skip",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "blocked",
    id: `execution:skip:patch-plan:${candidate.id}`,
    linkedIssueCandidateIds: candidate.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Generate or recover a linked patch plan before attempting PR execution planning."
    ],
    reason: "The selected PR candidate has no linked patch plan in the provided analysis context.",
    targetId: candidate.id,
    targetType: "pr_candidate",
    title: `Skip ${candidate.title}`
  });
}

function buildNonPatchableAction(
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  return createAction({
    actionType: "skip",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "blocked",
    id: `execution:skip:not-patchable:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Keep the candidate as a planning artifact until the remediation path is narrowed or human design input is added."
    ],
    reason:
      patchPlan.patchWarnings[0] ??
      "The linked patch plan marks this PR candidate as not patchable in the current milestone.",
    targetId: candidate.id,
    targetType: "pr_candidate",
    title: `Skip ${candidate.title}`
  });
}

function buildPreparePatchAction(
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  return createAction({
    actionType: "prepare_patch",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "eligible",
    id: `execution:prepare_patch:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps:
      patchPlan.patchPlan?.requiredHumanReview.length
        ? [
            `Apply the planned patch strategy: ${patchPlan.patchPlan.patchStrategy}`,
            ...patchPlan.patchPlan.requiredHumanReview
          ]
        : ["Prepare the bounded patch draft from the linked patch plan."],
    reason:
      patchPlan.patchability === "patch_candidate"
        ? "The linked patch plan is concrete enough for later patch preparation."
        : "The linked patch plan is bounded, but human review is still needed before later patch synthesis.",
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Prepare patch for ${candidate.title}`
  });
}

function buildValidatePatchAction(
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  const steps =
    patchPlan.patchPlan?.requiredValidationSteps.length
      ? patchPlan.patchPlan.requiredValidationSteps
      : ["Run the focused validation steps defined for the candidate once a patch draft exists."];

  return createAction({
    actionType: "validate_patch",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: patchPlan.validationStatus === "blocked" ? "blocked" : "eligible",
    id: `execution:validate_patch:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: steps,
    reason:
      patchPlan.validationStatus === "blocked"
        ? patchPlan.validationNotes[0] ?? "Validation is blocked for the linked patch plan."
        : "Validation steps are defined for the linked patch plan and can run after patch preparation.",
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Validate patch for ${candidate.title}`
  });
}

function buildCreatePRAction(
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  const eligible =
    patchPlan.patchability === "patch_candidate" &&
    patchPlan.validationStatus !== "blocked";

  return createAction({
    actionType: "create_pr",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: eligible ? "eligible" : "blocked",
    id: `execution:create_pr:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Review the linked patch plan and validation notes.",
      "Require explicit approval before any pull request write action runs.",
      eligible
        ? "Create the pull request in a later write-enabled milestone once patch preparation and validation are complete."
        : "Keep PR creation blocked until the linked patch plan becomes patch-capable."
    ],
    reason: eligible
      ? "The selected PR candidate has a usable patch plan and can progress to pull request creation later."
      : "The selected PR candidate does not yet have a patch-capable plan that justifies later pull request creation.",
    targetId: candidate.id,
    targetType: "pr_candidate",
    title: `Create PR for ${candidate.title}`
  });
}

function buildUnsupportedModeActions(
  context: ExecutionPlanningContext,
  selectedIssueCandidateIds: string[],
  selectedPRCandidateIds: string[]
): ExecutionActionPlan[] {
  const issueMap = new Map(context.issueCandidates.map((candidate) => [candidate.id, candidate]));
  const prMap = new Map(context.prCandidates.map((candidate) => [candidate.id, candidate]));
  const actions: ExecutionActionPlan[] = [];

  for (const id of selectedIssueCandidateIds) {
    const candidate = issueMap.get(id);
    const approval = createApprovalGate("create_issue");

    actions.push({
      actionType: "create_issue",
      affectedPackages: candidate?.affectedPackages ?? [],
      affectedPaths: candidate?.affectedPaths ?? [],
      approvalNotes: [
        ...approval.approvalNotes,
        "The requested execution mode is not yet supported in Milestone 5A."
      ],
      approvalRequired: approval.approvalRequired,
      approvalStatus: approval.approvalStatus,
      eligibility: "blocked",
      id: `execution:blocked:issue:${id}`,
      linkedIssueCandidateIds: candidate ? [candidate.id] : [],
      linkedPRCandidateIds: [],
      plannedSteps: [
        "Switch to dry_run mode to inspect the plan without remote execution."
      ],
      reason: "execute_approved is not supported in Milestone 5A.",
      targetId: id,
      targetType: "issue_candidate",
      title: candidate?.title ?? `Blocked issue execution for ${id}`
    });
  }

  for (const id of selectedPRCandidateIds) {
    const candidate = prMap.get(id);
    const approval = createApprovalGate("create_pr");

    actions.push({
      actionType: "create_pr",
      affectedPackages: candidate?.affectedPackages ?? [],
      affectedPaths: candidate?.affectedPaths ?? [],
      approvalNotes: [
        ...approval.approvalNotes,
        "The requested execution mode is not yet supported in Milestone 5A."
      ],
      approvalRequired: approval.approvalRequired,
      approvalStatus: approval.approvalStatus,
      eligibility: "blocked",
      id: `execution:blocked:pr:${id}`,
      linkedIssueCandidateIds: candidate?.linkedIssueCandidateIds ?? [],
      linkedPRCandidateIds: candidate ? [candidate.id] : [],
      plannedSteps: [
        "Switch to dry_run mode to inspect the plan without remote execution."
      ],
      reason: "execute_approved is not supported in Milestone 5A.",
      targetId: id,
      targetType: "pr_candidate",
      title: candidate?.title ?? `Blocked PR execution for ${id}`
    });
  }

  if (actions.length > 0) {
    return actions;
  }

  return [
    createAction({
      actionType: "skip",
      affectedPackages: [],
      affectedPaths: [],
      eligibility: "blocked",
      id: "execution:blocked:request:execute_approved",
      linkedIssueCandidateIds: [],
      linkedPRCandidateIds: [],
      plannedSteps: ["Use dry_run mode to generate an execution plan in this milestone."],
      reason: "execute_approved is not supported in Milestone 5A.",
      targetId: "execute_approved",
      targetType: "request",
      title: "Blocked execute_approved request"
    })
  ];
}

function buildEmptySelectionAction(): ExecutionActionPlan {
  return createAction({
    actionType: "skip",
    affectedPackages: [],
    affectedPaths: [],
    eligibility: "blocked",
    id: "execution:skip:request:no-selections",
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Select at least one issue candidate or PR candidate before planning execution."],
    reason: "No issue or PR candidates were selected for execution planning.",
    targetId: "selection",
    targetType: "request",
    title: "Skip empty execution request"
  });
}

export function buildDryRunActions(input: {
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  const issueMap = new Map(
    input.analysis.issueCandidates.map((candidate) => [candidate.id, candidate])
  );
  const prMap = new Map(
    input.analysis.prCandidates.map((candidate) => [candidate.id, candidate])
  );
  const patchPlanMap = new Map(
    input.analysis.prPatchPlans.map((plan) => [plan.prCandidateId, plan])
  );

  const actions: ExecutionActionPlan[] = [];

  if (
    input.selectedIssueCandidateIds.length === 0 &&
    input.selectedPRCandidateIds.length === 0
  ) {
    return [buildEmptySelectionAction()];
  }

  for (const id of input.selectedIssueCandidateIds) {
    const candidate = issueMap.get(id);
    actions.push(candidate ? buildIssueAction(candidate) : buildUnknownIssueAction(id));
  }

  for (const id of input.selectedPRCandidateIds) {
    const candidate = prMap.get(id);

    if (!candidate) {
      actions.push(buildUnknownPRAction(id));
      continue;
    }

    const patchPlan = patchPlanMap.get(candidate.id);

    if (!patchPlan) {
      actions.push(buildMissingPatchPlanAction(candidate));
      continue;
    }

    if (patchPlan.patchability === "not_patchable") {
      actions.push(buildNonPatchableAction(candidate, patchPlan));
      continue;
    }

    actions.push(buildPreparePatchAction(candidate, patchPlan));
    actions.push(buildValidatePatchAction(candidate, patchPlan));
    actions.push(buildCreatePRAction(candidate, patchPlan));
  }

  return actions;
}

export function buildUnsupportedExecutionActions(input: {
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  return buildUnsupportedModeActions(
    input.analysis,
    input.selectedIssueCandidateIds,
    input.selectedPRCandidateIds
  );
}
