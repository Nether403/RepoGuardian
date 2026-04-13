import { type Router as ExpressRouter, Router } from "express";
import { normalizeRepoInput } from "@repo-guardian/github";
import {
  isPersistenceError,
  type AnalysisJobRepository,
  type AnalysisRunRepository,
  type ExecutionPlanRepository,
  type RepositoryActivityRepository,
  type TrackedPullRequestRepository,
  type TrackedRepositoryRepository
} from "@repo-guardian/persistence";
import {
  AnalysisJobStatusSchema,
  CreateSweepScheduleRequestSchema,
  CreateTrackedRepositoryRequestSchema,
  EnqueueAnalysisJobRequestSchema,
  EnqueueExecutionPlanJobRequestSchema,
  RepositoryActivityCursorDirectionSchema,
  RepositoryActivityEventSchema,
  RepositoryActivityFeedSchema,
  RepositoryActivityKindSchema,
  RepositoryActivitySortPresetSchema,
  RepositoryTimelineExpansionModeSchema,
  RepositoryTimelinePageSchema,
  TrackedRepositoryHistoryResponseSchema
} from "@repo-guardian/shared-types";
import { z } from "zod";
import {
  type AnalysisJobProcessor,
  getAnalysisJobProcessor
} from "../lib/analysis-job-processor.js";
import { env } from "../lib/env.js";
import {
  getAnalysisJobRepository,
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getGitHubInstallationRepository,
  getRepositoryActivityRepository,
  getTrackedPullRequestRepository,
  getTrackedRepositoryRepository
} from "../lib/persistence.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { GitHubReadClient } from "@repo-guardian/github";

type TrackedRepositoryStore = Pick<
  TrackedRepositoryRepository,
  "createRepository" | "getRepository" | "listRepositories"
>;

type AnalysisJobStore = Pick<
  AnalysisJobRepository,
  "listJobs"
>;

type AnalysisRunStore = Pick<
  AnalysisRunRepository,
  "listRunsByRepositoryFullName"
>;

type ExecutionPlanStore = Pick<
  ExecutionPlanRepository,
  "listPlanSummariesByRepositoryFullName"
>;

type TrackedPullRequestStore = Pick<
  TrackedPullRequestRepository,
  "listTrackedPullRequestsByRepositoryFullName"
>;

type RepositoryActivityStore = Pick<
  RepositoryActivityRepository,
  | "getActivityByRepositoryFullName"
  | "listActivitiesByRepositoryFullName"
  | "listTimelineByRepositoryFullName"
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

const trackedRepositoryHistoryQuerySchema = z.object({
  activityKinds: z
    .union([
      RepositoryActivityKindSchema,
      z.array(RepositoryActivityKindSchema),
      z.string().trim().min(1)
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return [];
      }

      const values = Array.isArray(value) ? value : [value];

      return values.flatMap((entry) =>
        typeof entry === "string"
          ? entry
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          : entry
      );
    })
    .pipe(z.array(RepositoryActivityKindSchema)),
  activityPage: z.coerce.number().int().positive().default(1),
  activityPageSize: z.coerce.number().int().min(1).max(100).default(20),
  activityOccurredAfter: z.string().datetime().nullable().optional().default(null),
  activityOccurredBefore: z.string().datetime().nullable().optional().default(null),
  activityCursor: z.string().trim().min(1).nullable().optional().default(null),
  activityCursorDirection: RepositoryActivityCursorDirectionSchema.optional().default("next"),
  activityIncludeDetails: z.coerce.boolean().optional().default(false),
  activitySortPreset: RepositoryActivitySortPresetSchema.optional().default("newest_first"),
  activityStatuses: z
    .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return [];
      }

      const values = Array.isArray(value) ? value : [value];

      return values.flatMap((entry) =>
        entry
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      );
    })
    .pipe(z.array(z.string().min(1)))
});

const trackedRepositoryTimelineQuerySchema = z.object({
  timelineCursor: z.string().trim().min(1).nullable().optional().default(null),
  timelineDirection: RepositoryActivityCursorDirectionSchema.optional().default("next"),
  timelineExpand: RepositoryTimelineExpansionModeSchema.optional().default("summary"),
  timelineKinds: z
    .union([
      RepositoryActivityKindSchema,
      z.array(RepositoryActivityKindSchema),
      z.string().trim().min(1)
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return [];
      }

      const values = Array.isArray(value) ? value : [value];

      return values.flatMap((entry) =>
        typeof entry === "string"
          ? entry
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          : entry
      );
    })
    .pipe(z.array(RepositoryActivityKindSchema)),
  timelineLimit: z.coerce.number().int().min(1).max(100).default(20),
  timelineOccurredAfter: z.string().datetime().nullable().optional().default(null),
  timelineOccurredBefore: z.string().datetime().nullable().optional().default(null),
  timelineSortPreset: RepositoryActivitySortPresetSchema.optional().default("newest_first"),
  timelineStatuses: z
    .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return [];
      }

      const values = Array.isArray(value) ? value : [value];

      return values.flatMap((entry) =>
        entry
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      );
    })
    .pipe(z.array(z.string().min(1)))
});

const trackedRepositoryTimelineEventQuerySchema = z.object({
  expand: RepositoryTimelineExpansionModeSchema.optional().default("detail")
});

function toRepositoryActivityQuery(input: z.infer<typeof trackedRepositoryHistoryQuerySchema>) {
  return {
    kinds: input.activityKinds,
    limit: input.activityPageSize,
    cursor: input.activityCursor,
    cursorDirection: input.activityCursorDirection,
    includeDetails: input.activityIncludeDetails,
    occurredAfter: input.activityOccurredAfter,
    occurredBefore: input.activityOccurredBefore,
    offset: (input.activityPage - 1) * input.activityPageSize,
    sortPreset: input.activitySortPreset,
    statuses: input.activityStatuses
  };
}

function toRepositoryTimelineQuery(input: z.infer<typeof trackedRepositoryTimelineQuerySchema>) {
  return {
    cursor: input.timelineCursor,
    cursorDirection: input.timelineDirection,
    expansionMode: input.timelineExpand,
    kinds: input.timelineKinds,
    limit: input.timelineLimit,
    occurredAfter: input.timelineOccurredAfter,
    occurredBefore: input.timelineOccurredBefore,
    sortPreset: input.timelineSortPreset,
    statuses: input.timelineStatuses
  };
}

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
  analysisJobStore: AnalysisJobStore;
  analysisJobProcessor: AnalysisJobProcessorLike;
  executionPlanStore: ExecutionPlanStore;
  repositoryActivityStore: RepositoryActivityStore;
  runStore: AnalysisRunStore;
  trackedPullRequestStore: TrackedPullRequestStore;
  trackedRepositoryStore: TrackedRepositoryStore;
}): ExpressRouter {
  const fleetRouter: ExpressRouter = Router();

  fleetRouter.use(requireAuth);

  fleetRouter.get("/tracked-repositories", async (_request, response, next) => {
    try {
      response.json({
        repositories: await input.trackedRepositoryStore.listRepositories(
          _request.authContext?.activeWorkspaceId
        )
      });
    } catch (error) {
      next(error);
    }
  });

  fleetRouter.post(
    "/tracked-repositories",
    requireWorkspaceRole(["owner", "maintainer"]),
    async (request, response, next) => {
    const parsedRequest = CreateTrackedRepositoryRequestSchema.safeParse(request.body);

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

      if (parsedRequest.data.installationRepositoryId) {
        const installationRepository =
          await getGitHubInstallationRepository().getRepositoryById({
            installationRepositoryId: parsedRequest.data.installationRepositoryId,
            workspaceId
          });
        const repository = await input.trackedRepositoryStore.createRepository({
          canonicalUrl: installationRepository.canonicalUrl,
          fullName: installationRepository.fullName,
          githubInstallationId: installationRepository.githubInstallationId,
          installationRepositoryId: installationRepository.id,
          label: parsedRequest.data.label,
          owner: installationRepository.owner,
          repo: installationRepository.repo,
          workspaceId
        });

        response.status(201).json({ repository });
        return;
      }

      if (!parsedRequest.data.repoInput) {
        response.status(400).json({
          error: "repoInput is required until installation repository selection is wired here."
        });
        return;
      }

      const normalized = normalizeRepoInput(parsedRequest.data.repoInput);
      const repository = await input.trackedRepositoryStore.createRepository({
        canonicalUrl: normalized.canonicalUrl,
        fullName: normalized.fullName,
        label: parsedRequest.data.label,
        owner: normalized.owner,
        repo: normalized.repo,
        workspaceId
      });

      response.status(201).json({ repository });
    } catch (error) {
      next(error);
    }
  });

  fleetRouter.get("/tracked-repositories/:trackedRepositoryId/history", async (request, response, next) => {
    try {
      const parsedQuery = trackedRepositoryHistoryQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        response.status(400).json({
          error: "Tracked repository history query could not be validated."
        });
        return;
      }

      const trackedRepository = await input.trackedRepositoryStore.getRepository(
        getSingleParam(request.params.trackedRepositoryId),
        request.authContext?.activeWorkspaceId
      );
      const [fleetStatus, recentRuns, recentJobs, recentPlans, trackedPullRequests] =
        await Promise.all([
          input.analysisJobProcessor.getFleetStatus(),
          input.runStore.listRunsByRepositoryFullName({
            limit: 8,
            repositoryFullName: trackedRepository.fullName,
            workspaceId: request.authContext?.activeWorkspaceId
          }),
          input.analysisJobStore.listJobs({
            limit: 8,
            repositoryFullName: trackedRepository.fullName,
            workspaceId: request.authContext?.activeWorkspaceId
          }),
          input.executionPlanStore.listPlanSummariesByRepositoryFullName({
            limit: 8,
            repositoryFullName: trackedRepository.fullName
          }),
          input.trackedPullRequestStore.listTrackedPullRequestsByRepositoryFullName(
            trackedRepository.fullName
          )
        ]);
      const activityFeed =
        await input.repositoryActivityStore.listActivitiesByRepositoryFullName({
          ...toRepositoryActivityQuery(parsedQuery.data),
          repositoryFullName: trackedRepository.fullName
        });
      const currentStatus = fleetStatus.trackedRepositories.find(
        (entry) => entry.trackedRepository.id === trackedRepository.id
      );

      response.json(
        TrackedRepositoryHistoryResponseSchema.parse({
          activityFeed,
          currentStatus: currentStatus ?? {
            latestAnalysisJob: null,
            latestPlanId: null,
            latestPlanStatus: null,
            latestRun: null,
            patchPlanCounts: {
              blocked: 0,
              executable: 0,
              stale: 0
            },
            stale: true,
            trackedRepository
          },
          generatedAt: fleetStatus.generatedAt,
          recentJobs,
          recentPlans,
          recentRuns,
          trackedPullRequests,
          trackedRepository
        })
      );
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Tracked repository history request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/tracked-repositories/:trackedRepositoryId/activity", async (request, response, next) => {
    try {
      const parsedQuery = trackedRepositoryHistoryQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        response.status(400).json({
          error: "Tracked repository activity query could not be validated."
        });
        return;
      }

      const trackedRepository = await input.trackedRepositoryStore.getRepository(
        getSingleParam(request.params.trackedRepositoryId),
        request.authContext?.activeWorkspaceId
      );
      const activityFeed = await input.repositoryActivityStore.listActivitiesByRepositoryFullName({
        ...toRepositoryActivityQuery(parsedQuery.data),
        repositoryFullName: trackedRepository.fullName
      });

      response.json(RepositoryActivityFeedSchema.parse(activityFeed));
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Tracked repository activity request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get("/tracked-repositories/:trackedRepositoryId/timeline", async (request, response, next) => {
    try {
      const parsedQuery = trackedRepositoryTimelineQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        response.status(400).json({
          error: "Tracked repository timeline query could not be validated."
        });
        return;
      }

      const trackedRepository = await input.trackedRepositoryStore.getRepository(
        getSingleParam(request.params.trackedRepositoryId),
        request.authContext?.activeWorkspaceId
      );
      const timeline = await input.repositoryActivityStore.listTimelineByRepositoryFullName({
        ...toRepositoryTimelineQuery(parsedQuery.data),
        repositoryFullName: trackedRepository.fullName
      });

      response.json(RepositoryTimelinePageSchema.parse(timeline));
    } catch (error) {
      const status = mapPersistenceError(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Tracked repository timeline request failed"
        });
        return;
      }

      next(error);
    }
  });

  fleetRouter.get(
    "/tracked-repositories/:trackedRepositoryId/timeline/:activityId",
    async (request, response, next) => {
      try {
        const parsedQuery = trackedRepositoryTimelineEventQuerySchema.safeParse(request.query);

        if (!parsedQuery.success) {
          response.status(400).json({
            error: "Tracked repository timeline event query could not be validated."
          });
          return;
        }

      const trackedRepository = await input.trackedRepositoryStore.getRepository(
        getSingleParam(request.params.trackedRepositoryId),
        request.authContext?.activeWorkspaceId
      );
        const event = await input.repositoryActivityStore.getActivityByRepositoryFullName({
          activityId: getSingleParam(request.params.activityId),
          expansionMode: parsedQuery.data.expand,
          repositoryFullName: trackedRepository.fullName
        });

        response.json(RepositoryActivityEventSchema.parse(event));
      } catch (error) {
        const status = mapPersistenceError(error);

        if (status) {
          response.status(status).json({
            error:
              error instanceof Error
                ? error.message
                : "Tracked repository timeline event request failed"
          });
          return;
        }

        next(error);
      }
    }
  );

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
    analysisJobStore: getAnalysisJobRepository(),
    analysisJobProcessor: getAnalysisJobProcessor({ readClient }),
    executionPlanStore: getExecutionPlanRepository(),
    repositoryActivityStore: getRepositoryActivityRepository(),
    runStore: getAnalysisRunRepository(),
    trackedPullRequestStore: getTrackedPullRequestRepository(),
    trackedRepositoryStore: getTrackedRepositoryRepository()
  });
}
