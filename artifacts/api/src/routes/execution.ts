import { type Router as ExpressRouter, Router } from "express";
import {
  createExecutionPlanResult,
  type ExecutionServiceDependencies
} from "@repo-guardian/execution";
import {
  GitHubReadClient,
  GitHubWriteClient
} from "@repo-guardian/github";
import {
  ExecutionRequestSchema,
  type ExecutionRequest
} from "@repo-guardian/shared-types";
import { env } from "../lib/env.js";

function createExecutionInput(request: ExecutionRequest) {
  return {
    analysis: request.analysis,
    approvalGranted: request.approvalGranted,
    mode: request.mode,
    selectedIssueCandidateIds: request.selectedIssueCandidateIds,
    selectedPRCandidateIds: request.selectedPRCandidateIds
  };
}

export function createExecutionRouter(
  dependencies: ExecutionServiceDependencies
): ExpressRouter {
  const executionRouter: ExpressRouter = Router();

  executionRouter.post("/execution/plan", async (request, response, next) => {
    const parsedRequest = ExecutionRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const result = await createExecutionPlanResult(
        createExecutionInput(parsedRequest.data),
        dependencies
      );

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
