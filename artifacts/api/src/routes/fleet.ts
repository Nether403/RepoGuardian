import { type Router as ExpressRouter, Router } from "express";
import { normalizeRepoInput } from "@repo-guardian/github";
import { isPersistenceError, type TrackedRepositoryRepository } from "@repo-guardian/persistence";
import {
  AnalysisJobStatusSchema,
  CreateSweepScheduleRequestSchema,
  CreateTrackedRepositoryRequestSchema,
  EnqueueAnalysisJobRequestSchema,
  EnqueueExecutionPlanJobRequestSchema
} from "@repo-guardian/shared-types";
import {
  type AnalysisJobProcessor,
  getAnalysisJobProcessor
} from "../lib/analysis-job-processor.js";
import { env } from "../lib/env.js";
import { getTrackedRepositoryRepository } from "../lib/persistence.js";
import { requireAuth } from "../middleware/auth.js";
import { GitHubReadClient } from "@repo-guardian/github";

type TrackedRepositoryStore = Pick<
  TrackedRepositoryRepository,
  "createRepository" | "listRepositories"
>;

type AnalysisJobProcessorLike = Pick<
  AnalysisJobProcessor,
  | "cancelJob"
  | "createSweepSchedule"
  | "enqueueAdHoc"
  | "enqueueExecutionPlanJob"
  | "enqueueTrackedRepositoryAnalysis"
  | "getFleetStatus"
  | "getJob"
  | "listJobs"
  | "listSweepSchedules"
  | "retryJob"
  | "triggerSweepSchedule"
>;

function mapPersistenceError(error: unknown): number | null {
  if (!isPersistenceError(error)) {
    return null;
  }

  switch (error.code) {
    case "invalid_job_id":
    case "invalid_tracked_repository_id":
      return 400;
    case "not_found":
      return 404;
    case "conflict":
    case "invalid_plan_id":
    case "invalid_run_id":
      return 409;
  }

  return null;
}

function getSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function createFleetRouter(input: {
  analysisJobProcessor: AnalysisJobProcessorLike;
  trackedRepositoryStore: TrackedRepositoryStore;
}): ExpressRouter {
  const fleetRouter: ExpressRouter = Router();

  fleetRouter.use(requireAuth);

  fleetRouter.get("/tracked-repositories", async (_request, response, next) => {
    try {
      response.json({
        repositories: await input.trackedRepositoryStore.listRepositories()
      });
    } catch (error) {
      next(error);
    }
  });

  fleetRouter.post("/tracked-repositories", async (request, response, next) => {
    const parsedRequest = CreateTrackedRepositoryRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const normalized = normalizeRepoInput(parsedRequest.data.repoInput);
      const repository = await input.trackedRepositoryStore.createRepository({
        canonicalUrl: normalized.canonicalUrl,
        fullName: normalized.fullName,
        label: parsedRequest.data.label,
        owner: normalized.owner,
        repo: normalized.repo
      });

      response.status(201).json({ repository });
    } catch (error) {
      next(error);
    }
  });

  fleetRouter.post("/analyze/jobs", async (request, response, next) => {
    const parsedRequest = EnqueueAnalysisJobRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const job = parsedRequest.data.trackedRepositoryId
        ? await input.analysisJobProcessor.enqueueTrackedRepositoryAnalysis({
            requestedByUserId: "usr_authenticated",
            trackedRepositoryId: parsedRequest.data.trackedRepositoryId
          })
        : await input.analysisJobProcessor.enqueueAdHoc({
            label: parsedRequest.data.label,
            repoInput: parsedRequest.data.repoInput!,
            requestedByUserId: "usr_authenticated"
          });

      response.status(202).json({ job });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Analysis job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/analyze/jobs/:jobId", async (request, response, next) => {
    try {
      response.json({
        job: await input.analysisJobProcessor.getJob(getSingleParam(request.params.jobId))
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Analysis job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/analyze/jobs", async (request, response, next) => {
    const rawStatus =
      typeof request.query.status === "string"
        ? request.query.status
        : Array.isArray(request.query.status) && typeof request.query.status[0] === "string"
          ? request.query.status[0]
          : undefined;
    const parsedStatus = AnalysisJobStatusSchema.safeParse(
      rawStatus
    );

    if (rawStatus && !parsedStatus.success) {
      response.status(400).json({
        error: parsedStatus.error.issues[0]?.message ?? "Invalid query string"
      });
      return;
    }

    try {
      response.json({
        jobs: await input.analysisJobProcessor.listJobs(parsedStatus.data)
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Analysis job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.post("/analyze/jobs/:jobId/cancel", async (request, response, next) => {
    try {
      response.json({
        job: await input.analysisJobProcessor.cancelJob(getSingleParam(request.params.jobId))
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Analysis job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.post("/analyze/jobs/:jobId/retry", async (request, response, next) => {
    try {
      response.json({
        job: await input.analysisJobProcessor.retryJob(getSingleParam(request.params.jobId))
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Analysis job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.post("/execution/plan/jobs", async (request, response, next) => {
    const parsedRequest = EnqueueExecutionPlanJobRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      const job = await input.analysisJobProcessor.enqueueExecutionPlanJob({
        analysisRunId: parsedRequest.data.analysisRunId,
        requestedByUserId: "usr_authenticated",
        selectedIssueCandidateIds: parsedRequest.data.selectedIssueCandidateIds,
        selectedPRCandidateIds: parsedRequest.data.selectedPRCandidateIds,
        selectionStrategy: parsedRequest.data.selectionStrategy
      });

      response.status(202).json({ job });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Execution plan job request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/fleet/status", async (_request, response, next) => {
    try {
      response.json(await input.analysisJobProcessor.getFleetStatus());
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Fleet status request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/sweep-schedules", async (_request, response, next) => {
    try {
      response.json({
        schedules: await input.analysisJobProcessor.listSweepSchedules()
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Sweep schedule request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.post("/sweep-schedules", async (request, response, next) => {
    const parsedRequest = CreateSweepScheduleRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      response.status(201).json({
        schedule: await input.analysisJobProcessor.createSweepSchedule(parsedRequest.data)
      });
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Sweep schedule request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.post("/sweep-schedules/:scheduleId/trigger", async (request, response, next) => {
    try {
      response.json(
        await input.analysisJobProcessor.triggerSweepSchedule({
          requestedByUserId: "usr_authenticated",
          scheduleId: getSingleParam(request.params.scheduleId)
        })
      );
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Sweep schedule request failed"
        });
        return;
      }

      next(error);
    }
  });

  return fleetRouter;
}

export default function createDefaultFleetRouter(): ExpressRouter {
  const readClient = new GitHubReadClient({ token: env.GITHUB_TOKEN });

  return createFleetRouter({
    analysisJobProcessor: getAnalysisJobProcessor({ readClient }),
    trackedRepositoryStore: getTrackedRepositoryRepository()
  });
}
