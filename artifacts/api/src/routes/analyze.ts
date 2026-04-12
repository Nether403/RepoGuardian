import { type Router as ExpressRouter, Router } from "express";
import {
  GitHubReadClient,
  type GitHubReadErrorCode,
  isGitHubReadError
} from "@repo-guardian/github";
import { AnalyzeRepoRequestSchema } from "@repo-guardian/shared-types";
import { analyzeRepository } from "../lib/analyze-repository.js";
import { env } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";

const readClient = new GitHubReadClient({ token: env.GITHUB_TOKEN });
const analyzeRouter: ExpressRouter = Router();

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

analyzeRouter.post("/analyze", requireAuth, async (request, response, next) => {
  const parsedRequest = AnalyzeRepoRequestSchema.safeParse(request.body);

  if (!parsedRequest.success) {
    response.status(400).json({
      error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
    });
    return;
  }

  try {
    const intake = await analyzeRepository(readClient, parsedRequest.data.repoInput);

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

export default analyzeRouter;
