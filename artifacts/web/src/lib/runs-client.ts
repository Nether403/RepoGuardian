import {
  CompareAnalysisRunsRequestSchema,
  CompareAnalysisRunsResponseSchema,
  GetAnalysisRunResponseSchema,
  ListAnalysisRunsResponseSchema,
  SaveAnalysisRunRequestSchema,
  SaveAnalysisRunResponseSchema,
  type AnalyzeRepoResponse,
  type CompareAnalysisRunsResponse,
  type GetAnalysisRunResponse,
  type ListAnalysisRunsResponse,
  type SaveAnalysisRunResponse
} from "@repo-guardian/shared-types";
import {
  compareAnalysisRuns,
  getAnalysisRun,
  listAnalysisRuns,
  RepoGuardianApiError,
  saveAnalysisRun as requestSaveAnalysisRun
} from "@repo-guardian/api-client";
import { getApiOptions } from "./api-options";

export class SavedRunsClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "SavedRunsClientError";
    this.status = status;
    this.details = details;
  }
}

export async function listSavedAnalysisRuns(): Promise<ListAnalysisRunsResponse> {
  try {
    return ListAnalysisRunsResponseSchema.parse(await listAnalysisRuns(getApiOptions()));
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new SavedRunsClientError(
        error.message,
        error.status,
        error.details,
        {
          cause: error
        }
      );
    }

    throw new SavedRunsClientError(
      "Repo Guardian could not reach the saved runs API",
      0,
      null,
      {
        cause: error
      }
    );
  }
}

export async function saveAnalysisRun(input: {
  analysis: AnalyzeRepoResponse;
  label?: string | null;
}): Promise<SaveAnalysisRunResponse> {
  let requestBody: ReturnType<typeof SaveAnalysisRunRequestSchema.parse>;

  try {
    requestBody = SaveAnalysisRunRequestSchema.parse(input);
  } catch (error) {
    throw new SavedRunsClientError("Repo Guardian could not save the analysis run", 0, null, {
      cause: error
    });
  }

  try {
    return SaveAnalysisRunResponseSchema.parse(
      await requestSaveAnalysisRun(requestBody, getApiOptions())
    );
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new SavedRunsClientError(
        error.message,
        error.status,
        error.details,
        {
          cause: error
        }
      );
    }

    throw new SavedRunsClientError("Repo Guardian could not save the analysis run", 0, null, {
      cause: error
    });
  }
}

export async function getSavedAnalysisRun(
  runId: string
): Promise<GetAnalysisRunResponse> {
  try {
    return GetAnalysisRunResponseSchema.parse(await getAnalysisRun(runId, getApiOptions()));
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new SavedRunsClientError(
        error.message,
        error.status,
        error.details,
        {
          cause: error
        }
      );
    }

    throw new SavedRunsClientError("Repo Guardian could not reopen the saved run", 0, null, {
      cause: error
    });
  }
}

export async function compareSavedAnalysisRuns(input: {
  baseRunId: string;
  targetRunId: string;
}): Promise<CompareAnalysisRunsResponse> {
  let requestBody: ReturnType<typeof CompareAnalysisRunsRequestSchema.parse>;

  try {
    requestBody = CompareAnalysisRunsRequestSchema.parse(input);
  } catch (error) {
    throw new SavedRunsClientError("Repo Guardian could not compare saved runs", 0, null, {
      cause: error
    });
  }

  try {
    return CompareAnalysisRunsResponseSchema.parse(
      await compareAnalysisRuns(requestBody, getApiOptions())
    );
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new SavedRunsClientError(
        error.message,
        error.status,
        error.details,
        {
          cause: error
        }
      );
    }

    throw new SavedRunsClientError("Repo Guardian could not compare saved runs", 0, null, {
      cause: error
    });
  }
}
