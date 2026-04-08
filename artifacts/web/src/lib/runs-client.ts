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

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

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
    const response = await fetch("/api/runs");
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new SavedRunsClientError(
        getErrorMessage(payload, `Saved runs request failed with status ${response.status}`),
        response.status,
        payload
      );
    }

    return ListAnalysisRunsResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof SavedRunsClientError) {
      throw error;
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
  try {
    const requestBody = SaveAnalysisRunRequestSchema.parse(input);
    const response = await fetch("/api/runs", {
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new SavedRunsClientError(
        getErrorMessage(payload, `Save run request failed with status ${response.status}`),
        response.status,
        payload
      );
    }

    return SaveAnalysisRunResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof SavedRunsClientError) {
      throw error;
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
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new SavedRunsClientError(
        getErrorMessage(payload, `Get saved run request failed with status ${response.status}`),
        response.status,
        payload
      );
    }

    return GetAnalysisRunResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof SavedRunsClientError) {
      throw error;
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
  try {
    const requestBody = CompareAnalysisRunsRequestSchema.parse(input);
    const response = await fetch("/api/runs/compare", {
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new SavedRunsClientError(
        getErrorMessage(payload, `Compare runs request failed with status ${response.status}`),
        response.status,
        payload
      );
    }

    return CompareAnalysisRunsResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof SavedRunsClientError) {
      throw error;
    }

    throw new SavedRunsClientError("Repo Guardian could not compare saved runs", 0, null, {
      cause: error
    });
  }
}
