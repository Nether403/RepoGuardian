import { type Router as ExpressRouter, Router } from "express";
import {
  ExecutionRequestSchema,
  type ExecutionRequest
} from "@repo-guardian/shared-types";
import { createExecutionPlanResult } from "@repo-guardian/execution";

const executionRouter: ExpressRouter = Router();

function createExecutionInput(request: ExecutionRequest) {
  return {
    analysis: request.analysis,
    mode: request.mode,
    selectedIssueCandidateIds: request.selectedIssueCandidateIds,
    selectedPRCandidateIds: request.selectedPRCandidateIds
  };
}

executionRouter.post("/execution/plan", (request, response, next) => {
  const parsedRequest = ExecutionRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    response.status(400).json({
      error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
    });
    return;
  }

  try {
    const result = createExecutionPlanResult(
      createExecutionInput(parsedRequest.data)
    );

    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default executionRouter;
