import { type Router as ExpressRouter, Router } from "express";
import { evaluateAnalysisPolicy } from "@repo-guardian/execution";
import {
  type GitHubReadErrorCode,
  isGitHubReadError,
  normalizeRepoInput
} from "@repo-guardian/github";
import type { PolicyDecisionRepository } from "@repo-guardian/persistence";
import { AnalyzeRepoRequestSchema } from "@repo-guardian/shared-types";
import { analyzeRepository } from "../lib/analyze-repository.js";
import { createInstallationReadClient } from "../lib/github-installations.js";
import { getPolicyDecisionRepository } from "../lib/persistence.js";
import { requireAuth } from "../middleware/auth.js";

type AnalyzeRepository = typeof analyzeRepository;
type CreateReadClient = typeof createInstallationReadClient;
type PolicyDecisionRepositoryLike = Pick<PolicyDecisionRepository, "recordDecision">;

function mapErrorCodeToStatus(code: GitHubReadErrorCode): number {
  switch (code) {
    case "invalid_repo_input":
      return 400;
    case "not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "network_error":
    case "upstream_error":
    case "upstream_invalid_response":
      return 502;
  }
}

function normalizeRepositoryFullName(repoInput: string): string {
  return normalizeRepoInput(repoInput).fullName;
}

async function recordPolicyDecision(input: {
  policyDecisionRepository?: PolicyDecisionRepositoryLike;
  record: Parameters<PolicyDecisionRepositoryLike["recordDecision"]>[0];
}): Promise<void> {
  try {
    await (input.policyDecisionRepository ?? getPolicyDecisionRepository()).recordDecision(
      input.record
    );
  } catch (error) {
    if (
      !input.policyDecisionRepository &&
      error instanceof Error &&
      error.message === "DATABASE_URL must be configured before using durable persistence."
    ) {
      return;
    }

    throw error;
  }
}

export function createAnalyzeRouter(input: {
  analyzeRepository?: AnalyzeRepository;
  createReadClient?: CreateReadClient;
  policyDecisionRepository?: PolicyDecisionRepositoryLike;
} = {}): ExpressRouter {
  const analyzeRouter: ExpressRouter = Router();
  const analyze = input.analyzeRepository ?? analyzeRepository;
  const createReadClient = input.createReadClient ?? createInstallationReadClient;
  const policyDecisionRepository = input.policyDecisionRepository;

  analyzeRouter.post("/analyze", requireAuth, async (request, response, next) => {
    const parsedRequest = AnalyzeRepoRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const workspaceId =
        parsedRequest.data.workspaceId ?? request.authContext!.activeWorkspaceId;

      if (workspaceId !== request.authContext!.activeWorkspaceId) {
        response.status(403).json({
          error: "Forbidden: workspace mismatch."
        });
        return;
      }

      const repositoryFullName = normalizeRepositoryFullName(parsedRequest.data.repoInput);
      const policyDecision = evaluateAnalysisPolicy({ repositoryFullName });

      await recordPolicyDecision({
        policyDecisionRepository,
        record: {
          actionType: "analyze_repository",
          actorUserId: request.authContext!.user.id,
          decision: policyDecision.decision,
          details: policyDecision.details,
          reason: policyDecision.reason,
          repositoryFullName,
          scopeType: "repository",
          workspaceId
        }
      });

      if (policyDecision.decision !== "allowed") {
        response.status(403).json({ error: policyDecision.reason });
        return;
      }

      const intake = await analyze(
        await createReadClient({
          repositoryFullName,
          workspaceId
        }),
        parsedRequest.data.repoInput
      );

      response.json(intake);
    } catch (error) {
      if (isGitHubReadError(error)) {
        response.status(mapErrorCodeToStatus(error.code)).json({
          details: error.details ?? null,
          error: error.message
        });
        return;
      }

      next(error);
    }
  });

  return analyzeRouter;
}

export default createAnalyzeRouter();
