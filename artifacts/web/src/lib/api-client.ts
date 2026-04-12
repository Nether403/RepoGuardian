import {
  AnalyzeRepoRequestSchema,
  AnalyzeRepoResponseSchema,
  type AnalyzeRepoResponse
} from "@repo-guardian/shared-types";
import {
  analyzeRepository as requestAnalyzeRepository,
  RepoGuardianApiError
} from "@repo-guardian/api-client";
import { getApiOptions } from "./api-options";

export class AnalyzeRepoClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalyzeRepoClientError";
    this.status = status;
    this.details = details;
  }
}

export async function analyzeRepository(repoInput: string): Promise<AnalyzeRepoResponse> {
  let requestBody: ReturnType<typeof AnalyzeRepoRequestSchema.parse>;

  try {
    requestBody = AnalyzeRepoRequestSchema.parse({ repoInput });
  } catch (error) {
    throw new AnalyzeRepoClientError("Repository input is required", 400, null, {
      cause: error
    });
  }

  try {
    return AnalyzeRepoResponseSchema.parse(
      await requestAnalyzeRepository(requestBody, getApiOptions())
    );
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new AnalyzeRepoClientError(
        error.message,
        error.status,
        error.details,
        {
          cause: error
        }
      );
    }

    throw new AnalyzeRepoClientError(
      "Repo Guardian could not reach the analyze API",
      0,
      null,
      {
        cause: error
      }
    );
  }
}
