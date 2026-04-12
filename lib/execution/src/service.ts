import { randomUUID } from "node:crypto";
import type {
  ExecutionActionPlan,
  ExecutionPlanningContext,
  ExecutionResult,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan
} from "@repo-guardian/shared-types";
import { ExecutionResultSchema } from "@repo-guardian/shared-types";
import { createExecutionApprovalSummary } from "./approvals.js";
import {
  buildApprovalBlockedActions,
  buildDryRunActions,
  buildExecutableActions
} from "./actions.js";
import { synthesizePRCandidatePatch } from "./patch-synthesis.js";
import { createExecutionSummary, uniqueSorted } from "./utils.js";

export type ExecutionPlanInput = {
  analysis: ExecutionPlanningContext;
  approvalGranted: boolean;
  mode: "dry_run" | "execute_approved";
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
};

export type ExecutionServiceDependencies = {
  readClient?: {
    fetchRepositoryFileText(request: {
      owner: string;
      path: string;
      ref: string;
      repo: string;
    }): Promise<string>;
  };
  writeClient?: {
    commitFileChanges(request: {
      branchName: string;
      commitMessage: string;
      fileChanges: Array<{
        content: string;
        path: string;
      }>;
      repository: Pick<ExecutionPlanningContext["repository"], "owner" | "repo">;
    }): Promise<{ branchName: string; commitSha: string }>;
    createBranchFromDefaultBranch(request: {
      branchName: string;
      repository: Pick<
        ExecutionPlanningContext["repository"],
        "defaultBranch" | "owner" | "repo"
      >;
    }): Promise<{ baseCommitSha: string; branchName: string }>;
    createIssue(request: {
      body: string;
      repository: Pick<ExecutionPlanningContext["repository"], "owner" | "repo">;
      title: string;
    }): Promise<{ issueNumber: number; issueUrl: string }>;
    openPullRequest(request: {
      baseBranch: string;
      body: string;
      headBranch: string;
      repository: Pick<ExecutionPlanningContext["repository"], "owner" | "repo">;
      title: string;
    }): Promise<{ pullRequestNumber: number; pullRequestUrl: string }>;
  };
};

function isWriteAction(actionType: ExecutionActionPlan["actionType"]): boolean {
  return (
    actionType === "create_issue" ||
    actionType === "create_branch" ||
    actionType === "commit_patch" ||
    actionType === "create_pr"
  );
}

function buildIssueBody(candidate: IssueCandidate): string {
  const linkedFindings =
    candidate.relatedFindingIds.length > 0
      ? candidate.relatedFindingIds.join(", ")
      : "none";

  return [
    candidate.suggestedBody,
    "",
    "Repo Guardian traceability:",
    `- Issue candidate: ${candidate.id}`,
    `- Related findings: ${linkedFindings}`,
    `- Approval requirement: explicit approval required and granted`
  ].join("\n");
}

function findAction(
  actions: ExecutionActionPlan[],
  actionId: string
): ExecutionActionPlan | undefined {
  return actions.find((action) => action.id === actionId);
}

function setBlocked(action: ExecutionActionPlan | undefined, reason: string): void {
  if (!action) {
    return;
  }

  action.blocked = true;
  action.eligibility = "blocked";
  action.reason = reason;
}

function markAttempt(
  action: ExecutionActionPlan | undefined
): asserts action is ExecutionActionPlan {
  if (!action) {
    throw new Error("Execution action was not planned.");
  }

  action.attempted = true;
  action.blocked = false;
}

function getExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected execution failure";
}

function buildExecutionWarnings(actions: ExecutionActionPlan[]): string[] {
  return uniqueSorted(
    actions
      .filter((action) => action.blocked)
      .map((action) => action.reason)
  );
}

function buildExecutionErrors(input: {
  actions: ExecutionActionPlan[];
  approvalGranted: boolean;
  mode: "dry_run" | "execute_approved";
}): string[] {
  const errors = uniqueSorted(
    input.actions
      .map((action) => action.errorMessage)
      .filter((message): message is string => Boolean(message))
  );

  if (input.mode === "execute_approved" && !input.approvalGranted) {
    return uniqueSorted([
      ...errors,
      "Execution is blocked because approvalGranted was not explicitly set to true."
    ]);
  }

  return errors;
}

function determineStatus(input: {
  actions: ExecutionActionPlan[];
  approvalGranted: boolean;
  mode: "dry_run" | "execute_approved";
  summary: ExecutionResult["summary"];
}): ExecutionResult["status"] {
  if (input.mode === "dry_run") {
    return input.summary.eligibleActions === 0 ? "blocked" : "planned";
  }

  if (!input.approvalGranted) {
    return "blocked";
  }

  if (input.actions.some((action) => action.attempted && !action.succeeded)) {
    return "failed";
  }

  if (
    input.actions.some(
      (action) => isWriteAction(action.actionType) && action.succeeded
    )
  ) {
    return "completed";
  }

  return "blocked";
}

function getIssueCandidateMap(
  analysis: ExecutionPlanningContext
): Map<string, IssueCandidate> {
  return new Map(analysis.issueCandidates.map((candidate) => [candidate.id, candidate]));
}

function getPRCandidateMap(analysis: ExecutionPlanningContext): Map<string, PRCandidate> {
  return new Map(analysis.prCandidates.map((candidate) => [candidate.id, candidate]));
}

function getPatchPlanMap(analysis: ExecutionPlanningContext): Map<string, PRPatchPlan> {
  return new Map(analysis.prPatchPlans.map((plan) => [plan.prCandidateId, plan]));
}

async function executeIssueActions(input: {
  actions: ExecutionActionPlan[];
  analysis: ExecutionPlanningContext;
  selectedIssueCandidateIds: string[];
  writeClient: NonNullable<ExecutionServiceDependencies["writeClient"]>;
}): Promise<void> {
  const issueCandidates = getIssueCandidateMap(input.analysis);

  for (const candidateId of input.selectedIssueCandidateIds) {
    const action = findAction(input.actions, `execution:create_issue:${candidateId}`);
    const candidate = issueCandidates.get(candidateId);

    if (!action || !candidate || action.eligibility !== "eligible") {
      continue;
    }

    try {
      markAttempt(action);
      const result = await input.writeClient.createIssue({
        body: buildIssueBody(candidate),
        repository: input.analysis.repository,
        title: candidate.title
      });

      action.issueNumber = result.issueNumber;
      action.issueUrl = result.issueUrl;
      action.succeeded = true;
    } catch (error) {
      action.errorMessage = getExecutionErrorMessage(error);
      action.reason = action.errorMessage;
    }
  }
}

async function executePRActions(input: {
  actions: ExecutionActionPlan[];
  analysis: ExecutionPlanningContext;
  readClient: NonNullable<ExecutionServiceDependencies["readClient"]>;
  selectedPRCandidateIds: string[];
  writeClient: NonNullable<ExecutionServiceDependencies["writeClient"]>;
}): Promise<void> {
  const prCandidates = getPRCandidateMap(input.analysis);
  const patchPlans = getPatchPlanMap(input.analysis);

  for (const candidateId of input.selectedPRCandidateIds) {
    const candidate = prCandidates.get(candidateId);
    const patchPlan = patchPlans.get(candidateId);
    const prepareAction = findAction(
      input.actions,
      `execution:prepare_patch:${candidateId}`
    );
    const branchAction = findAction(
      input.actions,
      `execution:create_branch:${candidateId}`
    );
    const commitAction = findAction(
      input.actions,
      `execution:commit_patch:${candidateId}`
    );
    const prAction = findAction(input.actions, `execution:create_pr:${candidateId}`);

    if (
      !candidate ||
      !patchPlan ||
      !prepareAction ||
      !branchAction ||
      !commitAction ||
      !prAction ||
      prepareAction.eligibility !== "eligible" ||
      branchAction.eligibility !== "eligible" ||
      commitAction.eligibility !== "eligible" ||
      prAction.eligibility !== "eligible"
    ) {
      continue;
    }

    let synthesizedPatch: Awaited<ReturnType<typeof synthesizePRCandidatePatch>>;
    let branchName = "";

    try {
      markAttempt(prepareAction);
      synthesizedPatch = await synthesizePRCandidatePatch({
        analysis: input.analysis,
        candidate,
        patchPlan,
        readClient: input.readClient
      });
      branchName = synthesizedPatch.branchName;
      prepareAction.branchName = branchName;
      prepareAction.succeeded = true;
    } catch (error) {
      const message = getExecutionErrorMessage(error);

      prepareAction.errorMessage = message;
      prepareAction.reason = message;
      setBlocked(branchAction, `Patch synthesis failed: ${message}`);
      setBlocked(commitAction, `Patch synthesis failed: ${message}`);
      setBlocked(prAction, `Patch synthesis failed: ${message}`);
      continue;
    }

    try {
      markAttempt(branchAction);
      const branchResult = await input.writeClient.createBranchFromDefaultBranch({
        branchName,
        repository: input.analysis.repository
      });
      branchName = branchResult.branchName;
      branchAction.branchName = branchName;
      branchAction.commitSha = branchResult.baseCommitSha;
      branchAction.succeeded = true;
    } catch (error) {
      const message = getExecutionErrorMessage(error);

      branchAction.branchName = branchName;
      branchAction.errorMessage = message;
      branchAction.reason = message;
      setBlocked(commitAction, `Branch creation failed: ${message}`);
      setBlocked(prAction, `Branch creation failed: ${message}`);
      continue;
    }

    try {
      markAttempt(commitAction);
      const commitResult = await input.writeClient.commitFileChanges({
        branchName,
        commitMessage: synthesizedPatch.commitMessage,
        fileChanges: synthesizedPatch.fileChanges,
        repository: input.analysis.repository
      });
      branchName = commitResult.branchName;
      commitAction.branchName = branchName;
      commitAction.commitSha = commitResult.commitSha;
      commitAction.succeeded = true;
    } catch (error) {
      const message = getExecutionErrorMessage(error);

      commitAction.branchName = branchName;
      commitAction.errorMessage = message;
      commitAction.reason = message;
      setBlocked(prAction, `Patch commit failed: ${message}`);
      continue;
    }

    try {
      markAttempt(prAction);
      const pullRequestResult = await input.writeClient.openPullRequest({
        baseBranch: input.analysis.repository.defaultBranch,
        body: synthesizedPatch.pullRequestBody,
        headBranch: branchName,
        repository: input.analysis.repository,
        title: candidate.title
      });
      prAction.branchName = branchName;
      prAction.pullRequestNumber = pullRequestResult.pullRequestNumber;
      prAction.pullRequestUrl = pullRequestResult.pullRequestUrl;
      prAction.succeeded = true;
    } catch (error) {
      const message = getExecutionErrorMessage(error);

      prAction.branchName = branchName;
      prAction.errorMessage = message;
      prAction.reason = message;
    }
  }
}

export async function executeApprovedActions(
  input: ExecutionPlanInput,
  actions: ExecutionActionPlan[],
  dependencies: ExecutionServiceDependencies
): Promise<void> {
  if (!dependencies.writeClient) {
    throw new Error("GitHub write client is required for execute_approved mode.");
  }

  await executeIssueActions({
    actions,
    analysis: input.analysis,
    selectedIssueCandidateIds: input.selectedIssueCandidateIds,
    writeClient: dependencies.writeClient
  });

  if (input.selectedPRCandidateIds.length === 0) {
    return;
  }

  if (!dependencies.readClient) {
    throw new Error("GitHub read client is required for PR execution.");
  }

  await executePRActions({
    actions,
    analysis: input.analysis,
    readClient: dependencies.readClient,
    selectedPRCandidateIds: input.selectedPRCandidateIds,
    writeClient: dependencies.writeClient
  });
}

export async function createExecutionPlanResult(
  input: ExecutionPlanInput,
  dependencies: ExecutionServiceDependencies = {}
): Promise<ExecutionResult> {
  const startedAt = new Date().toISOString();
  const actions =
    input.mode === "dry_run"
      ? buildDryRunActions(input)
      : input.approvalGranted
        ? buildExecutableActions(input)
        : buildApprovalBlockedActions(input);

  if (input.mode === "execute_approved" && input.approvalGranted) {
    try {
      await executeApprovedActions(input, actions, dependencies);
    } catch (error) {
      const firstEligibleAction = actions.find((action) => action.eligibility === "eligible");

      if (firstEligibleAction) {
        const message = getExecutionErrorMessage(error);

        firstEligibleAction.errorMessage = message;
        firstEligibleAction.reason = message;
      }
    }
  }

  const approval = createExecutionApprovalSummary({
    actions,
    approvalGranted: input.approvalGranted,
    mode: input.mode
  });
  const warnings = buildExecutionWarnings(actions);
  const errors = buildExecutionErrors({
    actions,
    approvalGranted: input.approvalGranted,
    mode: input.mode
  });
  const summary = createExecutionSummary(
    {
      selectedIssueCandidateIds: input.selectedIssueCandidateIds,
      selectedPRCandidateIds: input.selectedPRCandidateIds
    },
    actions
  );
  const status = determineStatus({
    actions,
    approvalGranted: input.approvalGranted,
    mode: input.mode,
    summary
  });
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
