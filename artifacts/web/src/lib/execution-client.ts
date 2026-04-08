import {
  ExecutionRequestSchema,
  ExecutionResultSchema,
  type AnalyzeRepoResponse,
  type ExecutionMode,
  type ExecutionResult
} from "@repo-guardian/shared-types";
import {
  createExecutionPlan,
  RepoGuardianApiError
} from "@repo-guardian/api-client";

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
  let requestBody: ReturnType<typeof ExecutionRequestSchema.parse>;

  try {
    requestBody = ExecutionRequestSchema.parse(input);
  } catch (error) {
    throw new ExecutionPlanClientError(
      "Execution request could not be validated",
      400,
      null,
      {
        cause: error
      }
    );
  }

  try {
    return ExecutionResultSchema.parse(await createExecutionPlan(requestBody));
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new ExecutionPlanClientError(
        error.message,
        error.status,
        error.details,
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
