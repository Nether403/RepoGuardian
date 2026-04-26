import { type Router as ExpressRouter, Router } from "express";
import { type GitHubReadErrorCode, isGitHubReadError } from "@repo-guardian/github";
import { AnalyzeRepoRequestSchema } from "@repo-guardian/shared-types";
import { analyzeRepository } from "../lib/analyze-repository.js";
import { createInstallationReadClient } from "../lib/github-installations.js";
import { requireAuth } from "../middleware/auth.js";

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
    const workspaceId =
      parsedRequest.data.workspaceId ?? request.authContext!.activeWorkspaceId;

    if (workspaceId !== request.authContext!.activeWorkspaceId) {
      response.status(403).json({
        error: "Forbidden: workspace mismatch."
      });
      return;
    }

    const intake = await analyzeRepository(
      await createInstallationReadClient({
        repositoryFullName: parsedRequest.data.repoInput.includes("/")
          ? parsedRequest.data.repoInput.replace(/^https:\/\/github\.com\//u, "").replace(/\/+$/u, "")
          : parsedRequest.data.repoInput,
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

export default analyzeRouter;
