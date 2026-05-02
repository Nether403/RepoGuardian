import { type Router as ExpressRouter, Router } from "express";
import crypto from "node:crypto";
import {
  createExecutionPlanResult,
  evaluateExecutionPlanPolicy,
  evaluateExecutionWritePolicy,
  executeApprovedActions,
  validateApprovedPlan,
  type ApprovedPlanValidationResult,
  type ExecutionLifecycleCallbacks,
  type ExecutionWritePolicyDecision,
  type ExecutionServiceDependencies
} from "@repo-guardian/execution";
import {
  type AnalysisRunRepository,
  type ClaimedExecutionPlan,
  type ExecutionPlanRepository,
  type PolicyDecisionRepository,
  type TrackedPullRequestRepository,
  isPersistenceError
} from "@repo-guardian/persistence";
import {
  ExecutionExecuteRequestSchema,
  ExecutionPlanRequestSchema,
  ExecutionResultSchema,
  type ExecutionActionPlan,
  type ExecutionPlanRegenerationContext,
  type ExecutionResult
} from "@repo-guardian/shared-types";
import {
  createInstallationReadClient,
  createInstallationWriteClient
} from "../lib/github-installations.js";
import {
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getPolicyDecisionRepository,
  getTrackedPullRequestRepository
} from "../lib/persistence.js";
import {
  getExecutionNotificationBus,
  type ExecutionNotificationBus,
  type ExecutionPlanNotification,
  type ExecutionPlanNotificationType
} from "../lib/notifications.js";
import { mintApprovalToken, verifyApprovalToken } from "../lib/token.js";
import { requireAuth, requireSseAuth, requireWorkspaceRole } from "../middleware/auth.js";

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

type PolicyDecisionRepositoryLike = Pick<
  PolicyDecisionRepository,
  "recordDecision"
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

async function recordExecutionPolicyDecision(input: {
  actorUserId: string;
  decision: ExecutionWritePolicyDecision;
  detail: Awaited<ReturnType<PlanRepositoryLike["getPlanDetail"]>>;
  policyDecisionRepository: PolicyDecisionRepositoryLike;
  workspaceId: string;
}): Promise<void> {
  await input.policyDecisionRepository.recordDecision({
    actionType: "execute_write",
    actorUserId: input.actorUserId,
    decision: input.decision.decision,
    details: input.decision.details,
    githubInstallationId: input.detail.githubInstallationId ?? null,
    planId: input.detail.planId,
    reason: input.decision.reason,
    repositoryFullName: input.detail.repository.fullName,
    runId: input.detail.analysisRunId,
    scopeType: "repository",
    workspaceId: input.workspaceId
  });
}

async function recordExecutionPlanPolicyDecision(input: {
  actorUserId: string;
  decision: ExecutionWritePolicyDecision;
  githubInstallationId: string | null;
  policyDecisionRepository: PolicyDecisionRepositoryLike;
  regenerationContext?: ExecutionPlanRegenerationContext;
  repositoryFullName: string;
  runId: string;
  workspaceId: string;
}): Promise<void> {
  const baseDetails = input.decision.details ?? {};
  const details: Record<string, unknown> = input.regenerationContext
    ? { ...baseDetails, regenerationContext: input.regenerationContext }
    : baseDetails;
  const reason = input.regenerationContext
    ? `${input.decision.reason} (regeneration triggered by ${input.regenerationContext.trigger}: ${input.regenerationContext.validationKind})`
    : input.decision.reason;

  await input.policyDecisionRepository.recordDecision({
    actionType: "generate_pr_candidates",
    actorUserId: input.actorUserId,
    decision: input.decision.decision,
    details,
    githubInstallationId: input.githubInstallationId,
    reason,
    repositoryFullName: input.repositoryFullName,
    runId: input.runId,
    scopeType: "repository",
    workspaceId: input.workspaceId
  });
}

function mapValidationToPolicyDecision(
  validation: Exclude<ApprovedPlanValidationResult, { kind: "match" }>
): ExecutionWritePolicyDecision {
  const reason = validation.message;
  let detailsPayload: Record<string, unknown>;

  if (validation.kind === "drift") {
    detailsPayload = {
      driftPaths: validation.details.flatMap((entry) =>
        entry.driftPaths.map((path) => ({ candidateId: entry.candidateId, path }))
      ),
      kind: validation.kind
    };
  } else if (validation.kind === "synthesis_error") {
    detailsPayload = {
      kind: validation.kind,
      synthesisErrors: validation.details
    };
  } else {
    detailsPayload = {
      kind: validation.kind,
      missingPreview: validation.details
    };
  }

  return {
    decision: "denied",
    details: detailsPayload,
    reason
  };
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
    notificationBus?: ExecutionNotificationBus;
    planRepository?: PlanRepositoryLike;
    policyDecisionRepository?: PolicyDecisionRepositoryLike;
    runRepository?: RunRepositoryLike;
    trackedPullRequestRepository?: TrackedPullRequestRepositoryLike;
  } = {}
): ExpressRouter {
  const executionRouter: ExpressRouter = Router();
  const runRepository = stores.runRepository ?? getAnalysisRunRepository();
  const planRepository = stores.planRepository ?? getExecutionPlanRepository();
  const policyDecisionRepository =
    stores.policyDecisionRepository ?? getPolicyDecisionRepository();
  const trackedPullRequestRepository =
    stores.trackedPullRequestRepository ?? getTrackedPullRequestRepository();
  const notificationBus = stores.notificationBus ?? getExecutionNotificationBus();

  function publishPlanNotification(input: {
    executionId?: string | null;
    planId: string;
    reason?: string | null;
    repositoryFullName: string;
    status: ExecutionPlanNotificationType;
    workspaceId: string;
  }): void {
    const notification: ExecutionPlanNotification = {
      createdAt: new Date().toISOString(),
      executionId: input.executionId ?? null,
      planId: input.planId,
      reason: input.reason ?? null,
      repositoryFullName: input.repositoryFullName,
      status: input.status,
      workspaceId: input.workspaceId
    };

    try {
      notificationBus.publish(notification);
    } catch (error) {
      console.error("Failed to publish execution plan notification", error);
    }
  }

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
      const policyDecision = evaluateExecutionPlanPolicy({
        selectionStrategy: "provided_candidates",
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds
      });

      await recordExecutionPlanPolicyDecision({
        actorUserId: request.authContext!.user.id,
        decision: policyDecision,
        githubInstallationId: run.run.githubInstallationId ?? null,
        policyDecisionRepository,
        regenerationContext: parsedRequest.data.regenerationContext,
        repositoryFullName: run.run.analysis.repository.fullName,
        runId: parsedRequest.data.analysisRunId,
        workspaceId
      });

      if (policyDecision.decision !== "allowed") {
        response.status(403).json({ error: policyDecision.reason });
        return;
      }

      // Dry-run diff previews are produced inside createExecutionPlanResult via
      // attachDryRunDiffPreviews, which requires either a readClient or a
      // fileContentsByPath cache. We don't persist analysis-time file contents
      // across runs, so the GitHub installation read client is the canonical
      // wiring; planRepository itself does not store file blobs.
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

      publishPlanNotification({
        planId,
        repositoryFullName: run.run.analysis.repository.fullName,
        status: "plan.created",
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
      const planHashMatches = detail.planHash === parsedRequest.data.planHash;
      const policyDecision = evaluateExecutionWritePolicy({
        actions: detail.actions,
        planHashMatches,
        planStatus: detail.status
      });

      await recordExecutionPolicyDecision({
        actorUserId: request.authContext!.user.id,
        decision: policyDecision,
        detail,
        policyDecisionRepository,
        workspaceId
      });

      if (!planHashMatches) {
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

      // Pre-execution patch validation: re-synthesize each prepared patch
      // against the latest fetched file contents and refuse to claim if the
      // result drifts from the approved diff preview or synthesis fails.
      const validationReadClient =
        dependencies.readClient ??
        (await createInstallationReadClient({
          repositoryFullName: detail.repository.fullName,
          workspaceId
        }));
      const preExecRun = await runRepository.getRun(detail.analysisRunId, workspaceId);
      const validation = await validateApprovedPlan({
        actions: detail.actions,
        analysis: preExecRun.run.analysis,
        readClient: validationReadClient,
        selectedPRCandidateIds: detail.selectedPRCandidateIds
      });

      if (validation.kind !== "match") {
        const decision = mapValidationToPolicyDecision(validation);
        await recordExecutionPolicyDecision({
          actorUserId: request.authContext!.user.id,
          decision,
          detail,
          policyDecisionRepository,
          workspaceId
        });
        publishPlanNotification({
          planId: detail.planId,
          reason: validation.message,
          repositoryFullName: detail.repository.fullName,
          status: "plan.failed",
          workspaceId
        });
        const status = validation.kind === "drift" ? 409 : 422;
        response.status(status).json({
          error: validation.message,
          kind: validation.kind,
          ...(validation.kind === "drift"
            ? { driftDetails: validation.details }
            : {}),
          ...(validation.kind === "synthesis_error"
            ? { synthesisErrors: validation.details }
            : {}),
          ...(validation.kind === "missing_preview"
            ? { missingPreview: validation.details }
            : {})
        });
        return;
      }

      const claimedPlan = await planRepository.claimExecution({
        actorUserId: request.authContext!.user.id,
        planId: parsedRequest.data.planId,
        workspaceId
      });
      publishPlanNotification({
        executionId: claimedPlan.executionId,
        planId: claimedPlan.planId,
        repositoryFullName: claimedPlan.repositoryFullName,
        status: "plan.claimed",
        workspaceId: claimedPlan.workspaceId
      });
      const run = await runRepository.getRun(claimedPlan.analysisRunId, workspaceId);
      const startedAt = new Date().toISOString();
      const callbacks = createLifecycleCallbacks({
        actorUserId: request.authContext!.user.id,
        claimedPlan,
        planRepository
      });
      const resolvedDependencies: ExecutionServiceDependencies = dependencies.writeClient
        ? {
            ...dependencies,
            readClient: dependencies.readClient ?? validationReadClient
          }
        : {
            ...dependencies,
            readClient: validationReadClient,
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
        publishPlanNotification({
          executionId: claimedPlan.executionId,
          planId: claimedPlan.planId,
          repositoryFullName: claimedPlan.repositoryFullName,
          status: result.status === "completed" ? "plan.completed" : "plan.failed",
          reason: result.status === "completed" ? null : result.errors[0] ?? null,
          workspaceId: claimedPlan.workspaceId
        });
        response.json(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unexpected execution failure";
        await planRepository.markExecutionFailure({
          actorUserId: request.authContext!.user.id,
          errorMessage,
          executionId: claimedPlan.executionId,
          githubInstallationId: claimedPlan.githubInstallationId,
          planId: claimedPlan.planId,
          repositoryFullName: claimedPlan.repositoryFullName,
          workspaceId: claimedPlan.workspaceId
        });
        publishPlanNotification({
          executionId: claimedPlan.executionId,
          planId: claimedPlan.planId,
          reason: errorMessage,
          repositoryFullName: claimedPlan.repositoryFullName,
          status: "plan.failed",
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

  executionRouter.get(
    "/execution/notifications/stream",
    requireSseAuth,
    async (request, response) => {
      const requestedWorkspaceIdRaw =
        typeof request.query.workspaceId === "string"
          ? request.query.workspaceId
          : Array.isArray(request.query.workspaceId)
            ? request.query.workspaceId[0]
            : undefined;
      const requestedWorkspaceId =
        typeof requestedWorkspaceIdRaw === "string"
          ? requestedWorkspaceIdRaw
          : undefined;
      const activeWorkspaceId = request.authContext!.activeWorkspaceId;

      if (
        requestedWorkspaceId &&
        requestedWorkspaceId !== activeWorkspaceId
      ) {
        response.status(403).json({
          error: "Workspace id does not match the authenticated session."
        });
        return;
      }

      const workspaceId = activeWorkspaceId;
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders?.();

      response.write(
        `event: ready\ndata: ${JSON.stringify({
          workspaceId,
          serverTime: new Date().toISOString()
        })}\n\n`
      );

      let unsubscribe: (() => void) | null = null;

      try {
        unsubscribe = notificationBus.subscribe(workspaceId, (notification) => {
          response.write(
            `event: ${notification.status}\ndata: ${JSON.stringify(notification)}\n\n`
          );
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to subscribe to notifications.";
        response.write(
          `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
        );
        response.end();
        return;
      }

      const heartbeat = setInterval(() => {
        response.write(`: heartbeat ${Date.now()}\n\n`);
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe?.();
        unsubscribe = null;
      };

      request.on("close", cleanup);
      request.on("aborted", cleanup);
      response.on("close", cleanup);
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
