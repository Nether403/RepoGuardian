import { type Router as ExpressRouter, Router } from "express";
import crypto from "node:crypto";
import { join } from "node:path";
import {
  createExecutionPlanResult,
  executeApprovedActions,
  type ExecutionServiceDependencies
} from "@repo-guardian/execution";
import {
  GitHubReadClient,
  GitHubWriteClient
} from "@repo-guardian/github";
import {
  ExecutionPlanRequestSchema,
  ExecutionExecuteRequestSchema,
  type ExecutionPlanResponse,
  type ExecutionResult
} from "@repo-guardian/shared-types";
import { FileAnalysisRunStore } from "@repo-guardian/runs";
import { env } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";
import { defaultPlanStore, type FilePlanStore } from "../lib/plan-store.js";
import { mintApprovalToken, verifyApprovalToken } from "../lib/token.js";

function getRunStore() {
  return new FileAnalysisRunStore({
    rootDir:
      env.REPO_GUARDIAN_RUN_STORE_DIR ??
      join(process.cwd(), ".repo-guardian", "runs")
  });
}

function hashActions(actions: unknown[]) {
  return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(actions)).digest("hex");
}

export function createExecutionRouter(
  dependencies: ExecutionServiceDependencies,
  stores: {
    runStore?: FileAnalysisRunStore;
    planStore?: FilePlanStore;
  } = {}
): ExpressRouter {
  const executionRouter: ExpressRouter = Router();
  const runStore = stores.runStore ?? getRunStore();
  const planStore = stores.planStore ?? defaultPlanStore;

  executionRouter.post("/execution/plan", requireAuth, async (request, response, next) => {
    const parsedRequest = ExecutionPlanRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const run = await runStore.getRun(parsedRequest.data.analysisRunId);
      if (!run) {
        response.status(404).json({ error: "Analysis run not found" });
        return;
      }

      const planInput = {
        analysis: run.run.analysis,
        approvalGranted: false,
        mode: "dry_run" as const,
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds
      };

      const result = await createExecutionPlanResult(planInput, dependencies);
      const planHash = hashActions(result.actions);
      const planId = `plan_${crypto.randomBytes(8).toString("hex")}`;
      const token = mintApprovalToken(planId, planHash, "usr_authenticated", 15);
      
      const storedPlan = {
        planId,
        planHash,
        actorUserId: "usr_authenticated", // Left for backward compatibility if PlanStore schema expects it
        analysisRunId: parsedRequest.data.analysisRunId,
        repositoryFullName: run.run.analysis.repository.fullName,
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds,
        normalizedExecutionPayload: {
          actions: result.actions
        },
        status: "planned" as const,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };

      await planStore.savePlan(storedPlan);

      const planResponse: ExecutionPlanResponse = {
        planId,
        planHash,
        approvalToken: token,
        expiresAt: storedPlan.expiresAt,
        repository: {
          owner: run.run.analysis.repository.owner,
          repo: run.run.analysis.repository.repo,
          defaultBranch: run.run.analysis.repository.defaultBranch
        },
        summary: result.summary,
        actions: result.actions,
        approval: {
          required: true,
          confirmationText: "I approve this GitHub write-back plan."
        }
      };

      response.json(planResponse);
    } catch (error) {
      next(error);
    }
  });

  executionRouter.post("/execution/execute", requireAuth, async (request, response, next) => {
    const parsedRequest = ExecutionExecuteRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      if (parsedRequest.data.confirmationText !== "I approve this GitHub write-back plan.") {
        response.status(400).json({ error: "Invalid confirmation text." });
        return;
      }

      let payload;
      try {
        payload = verifyApprovalToken(parsedRequest.data.approvalToken);
      } catch (e: unknown) {
        response.status(401).json({ error: e instanceof Error ? e.message : "Invalid token" });
        return;
      }

      if (payload.planId !== parsedRequest.data.planId || payload.planHash !== parsedRequest.data.planHash) {
        response.status(400).json({ error: "Token does not match plan details." });
        return;
      }

      const plan = await planStore.getPlan(parsedRequest.data.planId);
      if (!plan) {
        response.status(404).json({ error: "Plan not found." });
        return;
      }

      if (plan.status !== "planned") {
        response.status(409).json({ error: "Plan is already executing or no longer active." });
        return;
      }

      const now = new Date();
      if (new Date(plan.expiresAt) < now) {
        response.status(400).json({ error: "Plan has expired." });
        return;
      }

      const run = await runStore.getRun(plan.analysisRunId);
      if (!run) {
        response.status(404).json({ error: "Original analysis run not found." });
        return;
      }

      const transitioned = await planStore.transitionPlanStatus(plan.planId, "planned", "executing");
      if (!transitioned) {
         response.status(409).json({ error: "Plan is already executing or no longer active." });
         return;
      }
      
      const startedAt = new Date().toISOString();
      const actions = plan.normalizedExecutionPayload.actions;

      const planInput = {
        analysis: run.run.analysis,
        approvalGranted: true,
        mode: "execute_approved" as const,
        selectedIssueCandidateIds: plan.selectedIssueCandidateIds,
        selectedPRCandidateIds: plan.selectedPRCandidateIds
      };

      try {
        await executeApprovedActions(planInput, actions, dependencies);
        await planStore.transitionPlanStatus(plan.planId, "executing", "completed");
      } catch (executionError) {
        await planStore.transitionPlanStatus(plan.planId, "executing", "failed");
        next(executionError);
        return;
      }

      const summary = {
        totalSelections: plan.selectedIssueCandidateIds.length + plan.selectedPRCandidateIds.length,
        issueSelections: plan.selectedIssueCandidateIds.length,
        prSelections: plan.selectedPRCandidateIds.length,
        totalActions: actions.length,
        eligibleActions: actions.filter(a => a.eligibility === "eligible").length,
        blockedActions: actions.filter(a => a.eligibility === "blocked").length,
        skippedActions: actions.filter(a => a.eligibility !== "eligible" && a.eligibility !== "blocked").length,
        approvalRequiredActions: actions.length
      };

      const result: ExecutionResult = {
        executionId: `exec_${crypto.randomBytes(8).toString("hex")}`,
        mode: "execute_approved",
        startedAt,
        completedAt: new Date().toISOString(),
        status: actions.some(a => a.attempted && !a.succeeded) ? "failed" : "completed",
        approvalRequired: true,
        approvalStatus: "granted",
        approvalNotes: ["Explicit approval verified via token."],
        actions,
        warnings: [],
        errors: [],
        summary
      };

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return executionRouter;
}

const readClient = new GitHubReadClient({ token: env.GITHUB_TOKEN });
const writeClient = new GitHubWriteClient({ token: env.GITHUB_TOKEN });

export default createExecutionRouter({
  readClient,
  writeClient
});
