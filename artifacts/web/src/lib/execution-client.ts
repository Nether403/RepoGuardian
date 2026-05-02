import {
  ExecutionPlanRequestSchema,
  ExecutionExecuteRequestSchema,
  ExecutionResultSchema,
  type ExecutionPlanRegenerationContext,
  type ExecutionPlanResponse,
  type ExecutionResult
} from "@repo-guardian/shared-types";
import {
  createExecutionPlan,
  executeExecutionPlan,
  RepoGuardianApiError
} from "@repo-guardian/api-client";
import { getApiOptions } from "./api-options";

export class ExecutionClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExecutionClientError";
    this.status = status;
    this.details = details;
  }
}

export async function requestExecutionPlan(input: {
  analysisRunId: string;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
  regenerationContext?: ExecutionPlanRegenerationContext;
}): Promise<ExecutionPlanResponse> {
  let requestBody: ReturnType<typeof ExecutionPlanRequestSchema.parse>;

  try {
    requestBody = ExecutionPlanRequestSchema.parse(input);
  } catch (error) {
    throw new ExecutionClientError(
      "Execution plan request could not be validated",
      400,
      null,
      { cause: error }
    );
  }

  try {
    return await createExecutionPlan(requestBody, getApiOptions());
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new ExecutionClientError(error.message, error.status, error.details, { cause: error });
    }
    throw new ExecutionClientError("Repo Guardian could not reach the execution plan API", 0, null, { cause: error });
  }
}

export async function requestExecutionExecute(input: {
  planId: string;
  planHash: string;
  approvalToken: string;
  confirm: true;
  confirmationText: string;
}): Promise<ExecutionResult> {
  let requestBody: ReturnType<typeof ExecutionExecuteRequestSchema.parse>;

  try {
    requestBody = ExecutionExecuteRequestSchema.parse(input);
  } catch (error) {
    throw new ExecutionClientError(
      "Execution execute request could not be validated",
      400,
      null,
      { cause: error }
    );
  }

  try {
    return ExecutionResultSchema.parse(await executeExecutionPlan(requestBody, getApiOptions()));
  } catch (error) {
    if (error instanceof RepoGuardianApiError) {
      throw new ExecutionClientError(error.message, error.status, error.details, { cause: error });
    }
    throw new ExecutionClientError("Repo Guardian could not reach the execute API", 0, null, { cause: error });
  }
}
