import type {
  ExecutionActionPlan,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import { createApprovalGate } from "./approvals.js";
import { evaluatePRExecutionSupport } from "./patch-synthesis.js";

type ActionBuildContext = {
  approvalGranted: boolean;
  mode: "dry_run" | "execute_approved";
};

function createAction(
  context: ActionBuildContext,
  input: Omit<
    ExecutionActionPlan,
    | "approvalNotes"
    | "approvalRequired"
    | "approvalStatus"
    | "attempted"
    | "blocked"
    | "branchName"
    | "commitSha"
    | "diffPreview"
    | "errorMessage"
    | "issueNumber"
    | "issueUrl"
    | "pullRequestNumber"
    | "pullRequestUrl"
    | "succeeded"
  >
): ExecutionActionPlan {
  const approval = createApprovalGate({
    actionType: input.actionType,
    approvalGranted: context.approvalGranted,
    mode: context.mode
  });

  return {
    ...input,
    approvalNotes: approval.approvalNotes,
    approvalRequired: approval.approvalRequired,
    approvalStatus: approval.approvalStatus,
    attempted: false,
    blocked: input.eligibility === "blocked",
    branchName: null,
    commitSha: null,
    diffPreview: null,
    errorMessage: null,
    issueNumber: null,
    issueUrl: null,
    pullRequestNumber: null,
    pullRequestUrl: null,
    succeeded: false
  };
}

function buildIssueAction(
  context: ActionBuildContext,
  candidate: ExecutionPlanningContext["issueCandidates"][number]
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "create_issue",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "eligible",
    id: `execution:create_issue:${candidate.id}`,
    linkedIssueCandidateIds: [candidate.id],
    linkedPRCandidateIds: [],
    plannedSteps: [
      "Review the candidate title, summary, and acceptance criteria.",
      "Confirm the issue scope still matches the current repository state.",
      "Create the GitHub issue only after explicit approval is present."
    ],
    reason:
      "The selected issue candidate exists in the provided analysis context and is concrete enough to create directly as a GitHub issue.",
    targetId: candidate.id,
    targetType: "issue_candidate",
    title: candidate.title
  });
}

function buildUnknownIssueAction(
  context: ActionBuildContext,
  id: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "skip",
    affectedPackages: [],
    affectedPaths: [],
    eligibility: "blocked",
    id: `execution:skip:issue:${id}`,
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Remove or correct the unknown issue candidate ID before trying execution again."],
    reason: "The selected issue candidate ID does not exist in the provided analysis context.",
    targetId: id,
    targetType: "issue_candidate",
    title: `Skip unknown issue candidate ${id}`
  });
}

function buildUnknownPRAction(
  context: ActionBuildContext,
  id: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "skip",
    affectedPackages: [],
    affectedPaths: [],
    eligibility: "blocked",
    id: `execution:skip:pr:${id}`,
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Remove or correct the unknown PR candidate ID before trying execution again."],
    reason: "The selected PR candidate ID does not exist in the provided analysis context.",
    targetId: id,
    targetType: "pr_candidate",
    title: `Skip unknown PR candidate ${id}`
  });
}

function buildMissingPatchPlanAction(
  context: ActionBuildContext,
  candidate: PRCandidate
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "skip",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility: "blocked",
    id: `execution:skip:patch-plan:${candidate.id}`,
    linkedIssueCandidateIds: candidate.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Generate or recover a linked patch plan before attempting PR execution."
    ],
    reason: "The selected PR candidate has no linked patch plan in the provided analysis context.",
    targetId: candidate.id,
    targetType: "pr_candidate",
    title: `Skip ${candidate.title}`
  });
}

function buildNonPatchableAction(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  return createAction(context, {
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
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan,
  eligibility: ExecutionActionPlan["eligibility"],
  reason: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "prepare_patch",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility,
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
    reason,
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Prepare patch for ${candidate.title}`
  });
}

function buildValidatePatchAction(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan {
  const steps =
    patchPlan.patchPlan?.requiredValidationSteps.length
      ? patchPlan.patchPlan.requiredValidationSteps
      : ["Run the focused validation steps defined for the candidate once a patch draft exists."];

  return createAction(context, {
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
        : "Validation steps are defined for the linked patch plan and remain manual in Milestone 5B.",
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Validate patch for ${candidate.title}`
  });
}

function buildCreateBranchAction(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan,
  eligibility: ExecutionActionPlan["eligibility"],
  reason: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "create_branch",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility,
    id: `execution:create_branch:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      `Create a branch from ${context.mode === "dry_run" ? "the repository default branch" : "the latest default-branch head"}.`,
      "Keep the branch scoped to the selected PR candidate only."
    ],
    reason,
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Create branch for ${candidate.title}`
  });
}

function buildCommitPatchAction(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan,
  eligibility: ExecutionActionPlan["eligibility"],
  reason: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "commit_patch",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility,
    id: `execution:commit_patch:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Apply only the bounded file updates justified by the linked patch plan.",
      "Create a single commit that preserves traceability back to the selected PR candidate."
    ],
    reason,
    targetId: patchPlan.prCandidateId,
    targetType: "patch_plan",
    title: `Commit patch for ${candidate.title}`
  });
}

function buildCreatePRAction(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan,
  eligibility: ExecutionActionPlan["eligibility"],
  reason: string
): ExecutionActionPlan {
  return createAction(context, {
    actionType: "create_pr",
    affectedPackages: candidate.affectedPackages,
    affectedPaths: candidate.affectedPaths,
    eligibility,
    id: `execution:create_pr:${candidate.id}`,
    linkedIssueCandidateIds: patchPlan.linkedIssueCandidateIds,
    linkedPRCandidateIds: [candidate.id],
    plannedSteps: [
      "Review the linked patch plan and validation notes.",
      "Open a pull request from the generated branch only after explicit approval is present."
    ],
    reason,
    targetId: candidate.id,
    targetType: "pr_candidate",
    title: `Create PR for ${candidate.title}`
  });
}

function buildPatchPlanOnlyActions(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan[] {
  const blockedReason =
    patchPlan.patchWarnings[0] ??
    "The linked patch plan is planning-only and does not justify real write-back yet.";

  return [
    buildPreparePatchAction(
      context,
      candidate,
      patchPlan,
      "eligible",
      "The linked patch plan is concrete enough to review, but not concrete enough for real GitHub writes."
    ),
    buildValidatePatchAction(context, candidate, patchPlan),
    buildCreateBranchAction(context, candidate, patchPlan, "blocked", blockedReason),
    buildCommitPatchAction(context, candidate, patchPlan, "blocked", blockedReason),
    buildCreatePRAction(context, candidate, patchPlan, "blocked", blockedReason)
  ];
}

function buildUnsupportedPRExecutionActions(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan,
  reason: string
): ExecutionActionPlan[] {
  return [
    buildPreparePatchAction(context, candidate, patchPlan, "blocked", reason),
    buildValidatePatchAction(context, candidate, patchPlan),
    buildCreateBranchAction(context, candidate, patchPlan, "blocked", reason),
    buildCommitPatchAction(context, candidate, patchPlan, "blocked", reason),
    buildCreatePRAction(context, candidate, patchPlan, "blocked", reason)
  ];
}

function buildSupportedPRExecutionActions(
  context: ActionBuildContext,
  candidate: PRCandidate,
  patchPlan: PRPatchPlan
): ExecutionActionPlan[] {
  const validationBlocked = patchPlan.validationStatus === "blocked";
  const validationReason =
    patchPlan.validationNotes[0] ??
    "Validation remains blocked for the linked patch plan.";

  return [
    buildPreparePatchAction(
      context,
      candidate,
      patchPlan,
      "eligible",
      "The linked patch plan is concrete enough for bounded patch synthesis."
    ),
    buildValidatePatchAction(context, candidate, patchPlan),
    buildCreateBranchAction(
      context,
      candidate,
      patchPlan,
      validationBlocked ? "blocked" : "eligible",
      validationBlocked
        ? validationReason
        : "The selected PR candidate is eligible for a scoped branch creation step."
    ),
    buildCommitPatchAction(
      context,
      candidate,
      patchPlan,
      validationBlocked ? "blocked" : "eligible",
      validationBlocked
        ? validationReason
        : "The selected PR candidate is eligible for a bounded commit once patch synthesis succeeds."
    ),
    buildCreatePRAction(
      context,
      candidate,
      patchPlan,
      validationBlocked ? "blocked" : "eligible",
      validationBlocked
        ? validationReason
        : "The selected PR candidate can open a pull request after the branch and commit steps succeed."
    )
  ];
}

function buildEmptySelectionAction(context: ActionBuildContext): ExecutionActionPlan {
  return createAction(context, {
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

function buildPlannedActions(input: {
  analysis: ExecutionPlanningContext;
  approvalGranted: boolean;
  mode: "dry_run" | "execute_approved";
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  const context: ActionBuildContext = {
    approvalGranted: input.approvalGranted,
    mode: input.mode
  };
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
    return [buildEmptySelectionAction(context)];
  }

  for (const id of input.selectedIssueCandidateIds) {
    const candidate = issueMap.get(id);
    actions.push(candidate ? buildIssueAction(context, candidate) : buildUnknownIssueAction(context, id));
  }

  for (const id of input.selectedPRCandidateIds) {
    const candidate = prMap.get(id);

    if (!candidate) {
      actions.push(buildUnknownPRAction(context, id));
      continue;
    }

    const patchPlan = patchPlanMap.get(candidate.id);

    if (!patchPlan) {
      actions.push(buildMissingPatchPlanAction(context, candidate));
      continue;
    }

    if (patchPlan.patchability === "not_patchable") {
      actions.push(buildNonPatchableAction(context, candidate, patchPlan));
      continue;
    }

    if (patchPlan.patchability === "patch_plan_only") {
      actions.push(...buildPatchPlanOnlyActions(context, candidate, patchPlan));
      continue;
    }

    const support = evaluatePRExecutionSupport({
      analysis: input.analysis,
      candidate,
      patchPlan
    });

    if (!support.supported) {
      actions.push(
        ...buildUnsupportedPRExecutionActions(
          context,
          candidate,
          patchPlan,
          support.reason
        )
      );
      continue;
    }

    actions.push(...buildSupportedPRExecutionActions(context, candidate, patchPlan));
  }

  return actions;
}

export function buildDryRunActions(input: {
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  return buildPlannedActions({
    ...input,
    approvalGranted: false,
    mode: "dry_run"
  });
}

export function buildApprovalBlockedActions(input: {
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  const context: ActionBuildContext = {
    approvalGranted: false,
    mode: "execute_approved"
  };
  const issueMap = new Map(
    input.analysis.issueCandidates.map((candidate) => [candidate.id, candidate])
  );
  const prMap = new Map(
    input.analysis.prCandidates.map((candidate) => [candidate.id, candidate])
  );
  const actions: ExecutionActionPlan[] = [];

  for (const id of input.selectedIssueCandidateIds) {
    const candidate = issueMap.get(id);

    actions.push(
      createAction(context, {
        actionType: "create_issue",
        affectedPackages: candidate?.affectedPackages ?? [],
        affectedPaths: candidate?.affectedPaths ?? [],
        eligibility: "blocked",
        id: `execution:blocked:issue:${id}`,
        linkedIssueCandidateIds: candidate ? [candidate.id] : [],
        linkedPRCandidateIds: [],
        plannedSteps: [
          "Switch to dry_run mode to inspect the plan without remote execution."
        ],
        reason: "Execution is blocked because explicit approval was not granted.",
        targetId: id,
        targetType: "issue_candidate",
        title: candidate?.title ?? `Blocked issue execution for ${id}`
      })
    );
  }

  for (const id of input.selectedPRCandidateIds) {
    const candidate = prMap.get(id);

    actions.push(
      createAction(context, {
        actionType: "create_pr",
        affectedPackages: candidate?.affectedPackages ?? [],
        affectedPaths: candidate?.affectedPaths ?? [],
        eligibility: "blocked",
        id: `execution:blocked:pr:${id}`,
        linkedIssueCandidateIds: candidate?.linkedIssueCandidateIds ?? [],
        linkedPRCandidateIds: candidate ? [candidate.id] : [],
        plannedSteps: [
          "Switch to dry_run mode to inspect the plan without remote execution."
        ],
        reason: "Execution is blocked because explicit approval was not granted.",
        targetId: id,
        targetType: "pr_candidate",
        title: candidate?.title ?? `Blocked PR execution for ${id}`
      })
    );
  }

  if (actions.length > 0) {
    return actions;
  }

  return [buildEmptySelectionAction(context)];
}

export function buildExecutableActions(input: {
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): ExecutionActionPlan[] {
  return buildPlannedActions({
    ...input,
    approvalGranted: true,
    mode: "execute_approved"
  });
}
