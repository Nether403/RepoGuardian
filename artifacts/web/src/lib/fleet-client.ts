import {
  CancelAnalysisJobResponseSchema,
  CreateSweepScheduleRequestSchema,
  CreateSweepScheduleResponseSchema,
  CreateTrackedRepositoryRequestSchema,
  CreateTrackedRepositoryResponseSchema,
  EnqueueAnalysisJobRequestSchema,
  EnqueueAnalysisJobResponseSchema,
  FleetStatusResponseSchema,
  ListAnalysisJobsResponseSchema,
  ListSweepSchedulesResponseSchema,
  ListTrackedRepositoriesResponseSchema,
  RetryAnalysisJobResponseSchema,
  TriggerSweepScheduleResponseSchema,
  type AnalysisJob,
  type CreateSweepScheduleRequest,
  type FleetStatusResponse,
  type SweepSchedule,
  type TrackedRepository
} from "@repo-guardian/shared-types";
import {
  cancelAnalysisJob as requestCancelAnalysisJob,
  createSweepSchedule as requestCreateSweepSchedule,
  createTrackedRepository as requestCreateTrackedRepository,
  enqueueAnalysisJob as requestEnqueueAnalysisJob,
  getFleetStatus as requestGetFleetStatus,
  listAnalysisJobs as requestListAnalysisJobs,
  listSweepSchedules as requestListSweepSchedules,
  listTrackedRepositories as requestListTrackedRepositories,
  RepoGuardianApiError,
  retryAnalysisJob as requestRetryAnalysisJob,
  triggerSweepSchedule as requestTriggerSweepSchedule
} from "@repo-guardian/api-client";
import { getApiOptions } from "./api-options";

export class FleetClientError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "FleetClientError";
    this.status = status;
    this.details = details;
  }
}

function toFleetClientError(
  error: unknown,
  fallbackMessage: string
): FleetClientError {
  if (error instanceof FleetClientError) {
    return error;
  }

  if (error instanceof RepoGuardianApiError) {
    return new FleetClientError(error.message, error.status, error.details, {
      cause: error
    });
  }

  return new FleetClientError(fallbackMessage, 0, null, {
    cause: error
  });
}

export async function listTrackedRepositories(): Promise<TrackedRepository[]> {
  try {
    const response = await requestListTrackedRepositories(getApiOptions());
    return ListTrackedRepositoriesResponseSchema.parse(response).repositories;
  } catch (error) {
    throw toFleetClientError(
      error,
      "Repo Guardian could not reach the tracked repositories API"
    );
  }
}

export async function createTrackedRepository(input: {
  label?: string | null;
  repoInput: string;
}): Promise<TrackedRepository> {
  let requestBody: ReturnType<typeof CreateTrackedRepositoryRequestSchema.parse>;

  try {
    requestBody = CreateTrackedRepositoryRequestSchema.parse(input);
  } catch (error) {
    throw new FleetClientError(
      "Tracked repository request could not be validated",
      400,
      null,
      { cause: error }
    );
  }

  try {
    const response = await requestCreateTrackedRepository(requestBody, getApiOptions());
    return CreateTrackedRepositoryResponseSchema.parse(response).repository;
  } catch (error) {
    throw toFleetClientError(
      error,
      "Repo Guardian could not create the tracked repository"
    );
  }
}

export async function enqueueTrackedRepositoryAnalysis(
  trackedRepositoryId: string
): Promise<AnalysisJob> {
  let requestBody: ReturnType<typeof EnqueueAnalysisJobRequestSchema.parse>;

  try {
    requestBody = EnqueueAnalysisJobRequestSchema.parse({
      trackedRepositoryId
    });
  } catch (error) {
    throw new FleetClientError(
      "Tracked repository analysis request could not be validated",
      400,
      null,
      { cause: error }
    );
  }

  try {
    const response = await requestEnqueueAnalysisJob(requestBody, getApiOptions());
    return EnqueueAnalysisJobResponseSchema.parse(response).job;
  } catch (error) {
    throw toFleetClientError(
      error,
      "Repo Guardian could not enqueue the tracked repository analysis"
    );
  }
}

export async function listAnalysisJobs(): Promise<AnalysisJob[]> {
  try {
    const response = await requestListAnalysisJobs(getApiOptions());
    return ListAnalysisJobsResponseSchema.parse(response).jobs;
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not load analysis jobs");
  }
}

export async function cancelAnalysisJob(jobId: string): Promise<AnalysisJob> {
  try {
    const response = await requestCancelAnalysisJob(jobId, getApiOptions());
    return CancelAnalysisJobResponseSchema.parse(response).job;
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not cancel the analysis job");
  }
}

export async function retryAnalysisJob(jobId: string): Promise<AnalysisJob> {
  try {
    const response = await requestRetryAnalysisJob(jobId, getApiOptions());
    return RetryAnalysisJobResponseSchema.parse(response).job;
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not retry the analysis job");
  }
}

export async function getFleetStatus(): Promise<FleetStatusResponse> {
  try {
    const response = await requestGetFleetStatus(getApiOptions());
    return FleetStatusResponseSchema.parse(response);
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not load fleet status");
  }
}

export async function listSweepSchedules(): Promise<SweepSchedule[]> {
  try {
    const response = await requestListSweepSchedules(getApiOptions());
    return ListSweepSchedulesResponseSchema.parse(response).schedules;
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not load sweep schedules");
  }
}

export async function createSweepSchedule(
  input: CreateSweepScheduleRequest
): Promise<SweepSchedule> {
  let requestBody: ReturnType<typeof CreateSweepScheduleRequestSchema.parse>;

  try {
    requestBody = CreateSweepScheduleRequestSchema.parse(input);
  } catch (error) {
    throw new FleetClientError(
      "Sweep schedule request could not be validated",
      400,
      null,
      { cause: error }
    );
  }

  try {
    const response = await requestCreateSweepSchedule(requestBody, getApiOptions());
    return CreateSweepScheduleResponseSchema.parse(response).schedule;
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not create the sweep schedule");
  }
}

export async function triggerSweepSchedule(scheduleId: string): Promise<{
  job: AnalysisJob;
  schedule: SweepSchedule;
}> {
  try {
    return TriggerSweepScheduleResponseSchema.parse(
      await requestTriggerSweepSchedule(scheduleId, getApiOptions())
    );
  } catch (error) {
    throw toFleetClientError(error, "Repo Guardian could not trigger the sweep schedule");
  }
}
