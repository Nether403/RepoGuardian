import {
  AnalyzeRepoRequestSchema,
  AnalyzeRepoResponseSchema,
  type AnalyzeRepoResponse
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
  try {
    const requestBody = AnalyzeRepoRequestSchema.parse({ repoInput });
    const response = await fetch("/api/analyze", {
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new AnalyzeRepoClientError(
        getErrorMessage(
          payload,
          `Analyze request failed with status ${response.status}`
        ),
        response.status,
        payload
      );
    }

    return AnalyzeRepoResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof AnalyzeRepoClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "ZodError") {
      throw new AnalyzeRepoClientError(
        "Repository input is required",
        400,
        null,
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
