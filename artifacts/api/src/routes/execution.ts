import { type Router as ExpressRouter, Router } from "express";
import crypto from "node:crypto";
import {
  createExecutionPlanResult,
  executeApprovedActions,
  type ExecutionLifecycleCallbacks,
  type ExecutionServiceDependencies
} from "@repo-guardian/execution";
import {
  type AnalysisRunRepository,
  type ClaimedExecutionPlan,
  type ExecutionPlanRepository,
  type TrackedPullRequestRepository,
  isPersistenceError
} from "@repo-guardian/persistence";
import {
  ExecutionExecuteRequestSchema,
  ExecutionPlanRequestSchema,
  ExecutionResultSchema,
  type ExecutionActionPlan,
  type ExecutionResult
} from "@repo-guardian/shared-types";
import {
  createInstallationReadClient,
  createInstallationWriteClient
} from "../lib/github-installations.js";
import {
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getTrackedPullRequestRepository
} from "../lib/persistence.js";
import { mintApprovalToken, verifyApprovalToken } from "../lib/token.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";

type RunRepositoryLike = Pick<
  AnalysisRunRepository,
  "getRun"
>;

type PlanRepositoryLike = Pick<
  ExecutionPlanRepository,
  | "claimExecution"
  | "finalizeExecution"
  | "getPlanDetail"
  | "getPlanEvents"
  | "markExecutionFailure"
  | "recordActionCompleted"
  | "recordActionStarted"
  | "savePlan"
>;

type TrackedPullRequestRepositoryLike = Pick<
  TrackedPullRequestRepository,
  "upsertOpenedPullRequest"
>;

function hashActions(actions: unknown[]): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(actions)).digest("hex")}`;
}

function buildExecutionSummary(actions: ExecutionActionPlan[], input: {
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}) {
  return {
    approvalRequiredActions: actions.length,
    blockedActions: actions.filter((action) => action.eligibility === "blocked").length,
    eligibleActions: actions.filter((action) => action.eligibility === "eligible").length,
    issueSelections: input.selectedIssueCandidateIds.length,
    prSelections: input.selectedPRCandidateIds.length,
    skippedActions: actions.filter((action) => action.eligibility === "ineligible").length,
    totalActions: actions.length,
    totalSelections:
      input.selectedIssueCandidateIds.length + input.selectedPRCandidateIds.length
  };
}

function buildExecutionWarnings(actions: ExecutionActionPlan[]): string[] {
  return [...new Set(actions.filter((action) => action.blocked).map((action) => action.reason))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function buildExecutionErrors(actions: ExecutionActionPlan[]): string[] {
  return [...new Set(actions.map((action) => action.errorMessage).filter((value): value is string => Boolean(value)))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function buildExecutionResponse(input: {
  actions: ExecutionActionPlan[];
  executionId: string;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
  startedAt: string;
}): ExecutionResult {
  const errors = buildExecutionErrors(input.actions);
  const warnings = buildExecutionWarnings(input.actions);

  return ExecutionResultSchema.parse({
    actions: input.actions,
    approvalNotes: ["Explicit approval verified via token."],
    approvalRequired: true,
    approvalStatus: "granted",
    completedAt: new Date().toISOString(),
    errors,
    executionId: input.executionId,
    mode: "execute_approved",
    startedAt: input.startedAt,
    status: errors.length > 0 ? "failed" : "completed",
    summary: buildExecutionSummary(input.actions, {
      selectedIssueCandidateIds: input.selectedIssueCandidateIds,
      selectedPRCandidateIds: input.selectedPRCandidateIds
    }),
    warnings
  });
}

function mapPersistenceError(error: unknown): { body: { error: string }; status: number } | null {
  if (!isPersistenceError(error)) {
    return null;
  }

  switch (error.code) {
    case "invalid_job_id":
    case "invalid_plan_id":
    case "invalid_run_id":
    case "invalid_tracked_repository_id":
      return { body: { error: error.message }, status: 400 };
    case "not_found":
      return { body: { error: error.message }, status: 404 };
    case "conflict":
      return { body: { error: error.message }, status: 409 };
  }

  return null;
}

function getSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function persistOpenedPullRequests(input: {
  executionId: string;
  planId: string;
  planRepository: PlanRepositoryLike;
  trackedPullRequestRepository: TrackedPullRequestRepositoryLike;
  workspaceId: string;
}): Promise<void> {
  const detail = await input.planRepository.getPlanDetail(input.planId, input.workspaceId);

  for (const action of detail.actions) {
    if (
      action.actionType !== "create_pr" ||
      !action.succeeded ||
      !action.branchName ||
      !action.pullRequestNumber ||
      !action.pullRequestUrl
    ) {
      continue;
    }

    await input.trackedPullRequestRepository.upsertOpenedPullRequest({
      branchName: action.branchName,
      executionId: input.executionId,
      owner: detail.repository.owner,
      planId: input.planId,
      pullRequestNumber: action.pullRequestNumber,
      pullRequestUrl: action.pullRequestUrl,
      repo: detail.repository.repo,
      title: action.title
    });
  }
}

function createLifecycleCallbacks(input: {
  actorUserId: string | null;
  claimedPlan: ClaimedExecutionPlan;
  planRepository: PlanRepositoryLike;
}): ExecutionLifecycleCallbacks {
  return {
    onActionCompleted: async (action) => {
      await input.planRepository.recordActionCompleted({
        action,
        actorUserId: input.actorUserId,
        executionId: input.claimedPlan.executionId,
        githubInstallationId: input.claimedPlan.githubInstallationId,
        planId: input.claimedPlan.planId,
        repositoryFullName: input.claimedPlan.repositoryFullName,
        workspaceId: input.claimedPlan.workspaceId
      });
    },
    onActionStarted: async (action) => {
      await input.planRepository.recordActionStarted({
        action,
        actorUserId: input.actorUserId,
        executionId: input.claimedPlan.executionId,
        githubInstallationId: input.claimedPlan.githubInstallationId,
        planId: input.claimedPlan.planId,
        repositoryFullName: input.claimedPlan.repositoryFullName,
        workspaceId: input.claimedPlan.workspaceId
      });
    }
  };
}

export function createExecutionRouter(
  dependencies: ExecutionServiceDependencies,
  stores: {
    planRepository?: PlanRepositoryLike;
    runRepository?: RunRepositoryLike;
    trackedPullRequestRepository?: TrackedPullRequestRepositoryLike;
  } = {}
): ExpressRouter {
  const executionRouter: ExpressRouter = Router();
  const runRepository = stores.runRepository ?? getAnalysisRunRepository();
  const planRepository = stores.planRepository ?? getExecutionPlanRepository();
  const trackedPullRequestRepository =
    stores.trackedPullRequestRepository ?? getTrackedPullRequestRepository();

  executionRouter.post(
    "/execution/plan",
    requireAuth,
    requireWorkspaceRole(["owner", "maintainer", "reviewer"]),
    async (request, response, next) => {
    const parsedRequest = ExecutionPlanRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const workspaceId =
        parsedRequest.data.workspaceId ?? request.authContext!.activeWorkspaceId;
      const run = await runRepository.getRun(parsedRequest.data.analysisRunId, workspaceId);
      const resolvedDependencies: ExecutionServiceDependencies = dependencies.readClient
        ? dependencies
        : {
            ...dependencies,
            readClient: await createInstallationReadClient({
              repositoryFullName: run.run.analysis.repository.fullName,
              workspaceId
            })
          };
      const planInput = {
        analysis: run.run.analysis,
        approvalGranted: false,
        mode: "dry_run" as const,
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds
      };
      const result = await createExecutionPlanResult(planInput, resolvedDependencies);
      const planHash = hashActions(result.actions);
      const planId = `plan_${crypto.randomBytes(8).toString("hex")}`;
      const token = mintApprovalToken(
        planId,
        planHash,
        request.authContext!.user.id,
        workspaceId,
        15
      );
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await planRepository.savePlan({
        actions: result.actions,
        actorUserId: request.authContext!.user.id,
        analysisRunId: parsedRequest.data.analysisRunId,
        approval: {
          confirmationText: "I approve this GitHub write-back plan.",
          required: true
        },
        githubInstallationId: run.run.githubInstallationId ?? null,
        createdAt,
        expiresAt,
        planHash,
        planId,
        repository: {
          defaultBranch: run.run.analysis.repository.defaultBranch,
          fullName: run.run.analysis.repository.fullName,
          owner: run.run.analysis.repository.owner,
          repo: run.run.analysis.repository.repo
        },
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds,
        summary: result.summary,
        workspaceId
      });

      response.json({
        actions: result.actions,
        approval: {
          confirmationText: "I approve this GitHub write-back plan.",
          required: true
        },
        approvalToken: token,
        expiresAt,
        planHash,
        planId,
        repository: {
          defaultBranch: run.run.analysis.repository.defaultBranch,
          owner: run.run.analysis.repository.owner,
          repo: run.run.analysis.repository.repo
        },
        summary: result.summary
      });
    } catch (error) {
      const mapped = mapPersistenceError(error);

      if (mapped) {
        response.status(mapped.status).json(mapped.body);
        return;
      }

      next(error);
    }
    }
  );

  executionRouter.post(
    "/execution/execute",
    requireAuth,
    requireWorkspaceRole(["owner", "maintainer"]),
    async (request, response, next) => {
    const parsedRequest = ExecutionExecuteRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    if (parsedRequest.data.confirmationText !== "I approve this GitHub write-back plan.") {
      response.status(400).json({ error: "Invalid confirmation text." });
      return;
    }

    try {
      const tokenPayload = verifyApprovalToken(parsedRequest.data.approvalToken);

      if (
        tokenPayload.planId !== parsedRequest.data.planId ||
        tokenPayload.planHash !== parsedRequest.data.planHash ||
        tokenPayload.workspaceId !==
          (parsedRequest.data.workspaceId ?? request.authContext!.activeWorkspaceId)
      ) {
        response.status(400).json({ error: "Token does not match plan details." });
        return;
      }

      const workspaceId =
        parsedRequest.data.workspaceId ?? request.authContext!.activeWorkspaceId;
      const detail = await planRepository.getPlanDetail(parsedRequest.data.planId, workspaceId);

      if (detail.planHash !== parsedRequest.data.planHash) {
        response.status(400).json({ error: "Token does not match plan details." });
        return;
      }

      if (detail.status === "expired") {
        response.status(400).json({ error: "Plan has expired." });
        return;
      }

      if (detail.status !== "planned") {
        response.status(409).json({ error: "Plan is already executing or no longer active." });
        return;
      }

      const claimedPlan = await planRepository.claimExecution({
        actorUserId: request.authContext!.user.id,
        planId: parsedRequest.data.planId,
        workspaceId
      });
      const run = await runRepository.getRun(claimedPlan.analysisRunId, workspaceId);
      const startedAt = new Date().toISOString();
      const callbacks = createLifecycleCallbacks({
        actorUserId: request.authContext!.user.id,
        claimedPlan,
        planRepository
      });
      const resolvedDependencies: ExecutionServiceDependencies = dependencies.writeClient
        ? dependencies
        : {
            ...dependencies,
            readClient: await createInstallationReadClient({
              repositoryFullName: claimedPlan.repositoryFullName,
              workspaceId
            }),
            writeClient: await createInstallationWriteClient({
              repositoryFullName: claimedPlan.repositoryFullName,
              workspaceId
            })
          };
      const executionInput = {
        analysis: run.run.analysis,
        approvalGranted: true,
        mode: "execute_approved" as const,
        selectedIssueCandidateIds: claimedPlan.selectedIssueCandidateIds,
        selectedPRCandidateIds: claimedPlan.selectedPRCandidateIds
      };

      try {
        await executeApprovedActions(
          executionInput,
          claimedPlan.actions,
          resolvedDependencies,
          callbacks
        );
        const result = buildExecutionResponse({
          actions: claimedPlan.actions,
          executionId: claimedPlan.executionId,
          selectedIssueCandidateIds: claimedPlan.selectedIssueCandidateIds,
          selectedPRCandidateIds: claimedPlan.selectedPRCandidateIds,
          startedAt
        });
        await planRepository.finalizeExecution({
          actorUserId: request.authContext!.user.id,
          executionId: claimedPlan.executionId,
          githubInstallationId: claimedPlan.githubInstallationId,
          planId: claimedPlan.planId,
          repositoryFullName: claimedPlan.repositoryFullName,
          result,
          workspaceId: claimedPlan.workspaceId
        });
        await persistOpenedPullRequests({
          executionId: claimedPlan.executionId,
          planId: claimedPlan.planId,
          planRepository,
          trackedPullRequestRepository,
          workspaceId: claimedPlan.workspaceId
        });
        response.json(result);
      } catch (error) {
        await planRepository.markExecutionFailure({
          actorUserId: request.authContext!.user.id,
          errorMessage: error instanceof Error ? error.message : "Unexpected execution failure",
          executionId: claimedPlan.executionId,
          githubInstallationId: claimedPlan.githubInstallationId,
          planId: claimedPlan.planId,
          repositoryFullName: claimedPlan.repositoryFullName,
          workspaceId: claimedPlan.workspaceId
        });
        next(error);
      }
    } catch (error) {
      const mapped = mapPersistenceError(error);

      if (mapped) {
        response.status(mapped.status).json(mapped.body);
        return;
      }

      if (error instanceof Error) {
        response.status(401).json({ error: error.message });
        return;
      }

      next(error);
    }
    }
  );

  executionRouter.get("/execution/plans/:planId", requireAuth, async (request, response, next) => {
    try {
      response.json(
        await planRepository.getPlanDetail(
          getSingleParam(request.params.planId),
          request.authContext!.activeWorkspaceId
        )
      );
    } catch (error) {
      const mapped = mapPersistenceError(error);

      if (mapped) {
        response.status(mapped.status).json(mapped.body);
        return;
      }

      next(error);
    }
  });

  executionRouter.get("/execution/plans/:planId/events", requireAuth, async (request, response, next) => {
    try {
      response.json(
        await planRepository.getPlanEvents(
          getSingleParam(request.params.planId),
          request.authContext!.activeWorkspaceId
        )
      );
    } catch (error) {
      const mapped = mapPersistenceError(error);

      if (mapped) {
        response.status(mapped.status).json(mapped.body);
        return;
      }

      next(error);
    }
  });

  return executionRouter;
}

function createDefaultExecutionRouter(): ExpressRouter {
  return createExecutionRouter({});
}

export default createDefaultExecutionRouter;
