import {
  ExecutionRequestSchema,
  ExecutionResultSchema,
  type AnalyzeRepoResponse,
  type ExecutionMode,
  type ExecutionResult
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

export class ExecutionPlanClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExecutionPlanClientError";
    this.status = status;
    this.details = details;
  }
}

export async function requestExecutionPlan(input: {
  analysis: AnalyzeRepoResponse;
  approvalGranted: boolean;
  mode: ExecutionMode;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
}): Promise<ExecutionResult> {
  try {
    const requestBody = ExecutionRequestSchema.parse(input);
    const response = await fetch("/api/execution/plan", {
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
      throw new ExecutionPlanClientError(
        getErrorMessage(
          payload,
          `Execution request failed with status ${response.status}`
        ),
        response.status,
        payload
      );
    }

    return ExecutionResultSchema.parse(payload);
  } catch (error) {
    if (error instanceof ExecutionPlanClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "ZodError") {
      throw new ExecutionPlanClientError(
        "Execution request could not be validated",
        400,
        null,
        {
          cause: error
        }
      );
    }

    throw new ExecutionPlanClientError(
      "Repo Guardian could not reach the execution API",
      0,
      null,
      {
        cause: error
      }
    );
  }
}
