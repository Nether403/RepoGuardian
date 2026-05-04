import express from "express";
import { PersistenceError } from "@repo-guardian/persistence";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createFleetRouter } from "../routes/fleet.js";

function createAnalysisJob(overrides: Record<string, unknown> = {}) {
  return {
    attemptCount: 0,
    completedAt: null,
    errorMessage: null,
    failedAt: null,
    jobId: "job_one",
    jobKind: "analyze_repository",
    label: "Async",
    maxAttempts: 1,
    planId: null,
    queuedAt: "2026-04-12T10:00:00.000Z",
    repoInput: "openai/openai-node",
    repositoryFullName: "openai/openai-node",
    requestedByUserId: "usr_authenticated",
    runId: null,
    scheduledSweepId: null,
    startedAt: null,
    status: "queued",
    trackedRepositoryId: null,
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  };
}

function createSweepSchedule(overrides: Record<string, unknown> = {}) {
  return {
    cadence: "weekly",
    createdAt: "2026-04-12T10:00:00.000Z",
    isActive: true,
    label: "Weekly sweep",
    lastTriggeredAt: null,
    nextRunAt: "2026-04-19T10:00:00.000Z",
    scheduleId: "sweep_one",
    selectionStrategy: "all_executable_prs",
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  };
}

function createTrackedRepository(overrides: Record<string, unknown> = {}) {
  return {
    canonicalUrl: "https://github.com/openai/openai-node",
    createdAt: "2026-04-12T10:00:00.000Z",
    fullName: "openai/openai-node",
    id: "tracked_one",
    isActive: true,
    label: "Weekly review",
    lastQueuedAt: "2026-04-12T10:00:00.000Z",
    owner: "openai",
    repo: "openai-node",
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  };
}

function createExecutionPlanSummary(overrides: Record<string, unknown> = {}) {
  return {
    analysisRunId: "run_one",
    approvalStatus: "required",
    cancelledAt: null,
    completedAt: null,
    createdAt: "2026-04-12T10:01:00.000Z",
    executionId: null,
    executionResultStatus: null,
    expiresAt: "2026-04-12T10:16:00.000Z",
    failedAt: null,
    planId: "plan_one",
    repositoryFullName: "openai/openai-node",
    selectedIssueCandidateCount: 0,
    selectedPRCandidateCount: 1,
    startedAt: null,
    status: "planned",
    summary: {
      approvalRequiredActions: 1,
      blockedActions: 0,
      eligibleActions: 1,
      issueSelections: 0,
      prSelections: 1,
      skippedActions: 0,
      totalActions: 1,
      totalSelections: 1
    },
    ...overrides
  };
}

function createAnalysisJobProcessor(overrides: Record<string, unknown> = {}) {
  const job = createAnalysisJob();
  const schedule = createSweepSchedule();

  return {
    cancelJob: vi.fn().mockResolvedValue({
      ...job,
      completedAt: "2026-04-12T10:02:00.000Z",
      status: "cancelled"
    }),
    createSweepSchedule: vi.fn().mockResolvedValue(schedule),
    enqueueAdHoc: vi.fn().mockResolvedValue(job),
    enqueueExecutionPlanJob: vi.fn().mockResolvedValue({
      ...job,
      jobId: "job_plan",
      jobKind: "generate_execution_plan"
    }),
    enqueueTrackedRepositoryAnalysis: vi.fn().mockResolvedValue({
      ...job,
      trackedRepositoryId: "tracked_one"
    }),
    getFleetStatus: vi.fn().mockResolvedValue({
      generatedAt: "2026-04-12T10:05:00.000Z",
      recentJobs: [job],
      summary: {
        blockedPatchPlans: 1,
        executablePatchPlans: 2,
        failedJobs: 0,
        mergedPullRequests: 0,
        openPullRequests: 1,
        stalePatchPlans: 0,
        staleRepositories: 0,
        trackedRepositories: 1
      },
      trackedPullRequests: [
        {
          branchName: "repo-guardian/test-branch",
          closedAt: null,
          createdAt: "2026-04-12T10:04:00.000Z",
          executionId: "exec_one",
          lifecycleStatus: "open",
          mergedAt: null,
          owner: "openai",
          planId: "plan_one",
          pullRequestNumber: 19,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
          repo: "openai-node",
          repositoryFullName: "openai/openai-node",
          title: "Harden workflow",
          trackedPullRequestId: "tpr_one",
          updatedAt: "2026-04-12T10:04:00.000Z"
        }
      ],
      trackedRepositories: [
        {
          latestAnalysisJob: job,
          latestPlanId: "plan_one",
          latestPlanStatus: "planned",
          latestRun: {
            blockedPatchPlans: 1,
            createdAt: "2026-04-12T10:03:00.000Z",
            defaultBranch: "main",
            executablePatchPlans: 2,
            fetchedAt: "2026-04-12T10:03:00.000Z",
            highSeverityFindings: 0,
            id: "run_one",
            issueCandidates: 0,
            label: "Weekly review",
            prCandidates: 2,
            repositoryFullName: "openai/openai-node",
            totalFindings: 1
          },
          patchPlanCounts: {
            blocked: 1,
            executable: 2,
            stale: 0
          },
          stale: false,
          trackedRepository: {
            canonicalUrl: "https://github.com/openai/openai-node",
            createdAt: "2026-04-12T10:00:00.000Z",
            fullName: "openai/openai-node",
            id: "tracked_one",
            isActive: true,
            label: "Weekly review",
            lastQueuedAt: "2026-04-12T10:00:00.000Z",
            owner: "openai",
            repo: "openai-node",
            updatedAt: "2026-04-12T10:00:00.000Z"
          }
        }
      ]
    }),
    getJob: vi.fn().mockResolvedValue(job),
    listJobs: vi.fn().mockResolvedValue([job]),
    listSweepSchedules: vi.fn().mockResolvedValue([schedule]),
    retryJob: vi.fn().mockResolvedValue({
      ...job,
      status: "queued"
    }),
    triggerSweepSchedule: vi.fn().mockResolvedValue({
      job: {
        ...job,
        jobId: "job_sweep",
        jobKind: "run_scheduled_sweep",
        repoInput: "[scheduled-sweep]",
        repositoryFullName: "[scheduled-sweep]",
        scheduledSweepId: "sweep_one"
      },
      schedule
    }),
    ...overrides
  };
}

function createRepositoryActivity(overrides: Record<string, unknown> = {}) {
  return {
    actionId: null,
    activityId: "run:run_one",
    detail: {
      actorUserId: null,
      blockedPatchPlanCount: 0,
      branchName: "main",
      candidateSelectionCount: null,
      defaultBranch: "main",
      detailType: "analysis_run",
      executablePatchPlanCount: 2,
      findingCount: 1,
      jobKind: null,
      label: "Weekly review",
      lifecycleStatus: null,
      relatedActionId: null,
      relatedExecutionId: null,
      relatedJobId: null,
      relatedPlanId: null,
      relatedRunId: "run_one",
      relatedTrackedPullRequestId: null,
      totalPatchPlans: 2
    },
    executionEventId: null,
    executionId: null,
    jobId: null,
    kind: "analysis_run",
    occurredAt: "2026-04-12T10:03:00.000Z",
    planId: null,
    pullRequestUrl: null,
    repositoryFullName: "openai/openai-node",
    runId: "run_one",
    status: "snapshot_saved",
    summary: "1 findings, 2 executable patch plans",
    title: "Weekly review",
    trackedPullRequestId: null,
    ...overrides
  };
}

function createTestApp(
  input: Partial<Parameters<typeof createFleetRouter>[0]> &
    Pick<Parameters<typeof createFleetRouter>[0], "analysisJobProcessor" | "analysisJobStore" | "executionPlanStore" | "runStore" | "trackedPullRequestStore" | "trackedRepositoryStore">
) {
  const app = express();
  app.use(express.json());
  app.use(
    createFleetRouter({
      repositoryActivityStore: {
        getActivityByRepositoryFullName: vi.fn().mockResolvedValue(createRepositoryActivity()),
        listActivitiesByRepositoryFullName: vi.fn().mockResolvedValue({
          appliedCursor: null,
          appliedCursorDirection: "next",
          appliedKinds: [],
          appliedSortPreset: "newest_first",
          appliedStatuses: [],
          availableKinds: [
            "analysis_job",
            "analysis_run",
            "execution_event",
            "execution_plan",
            "tracked_pull_request"
          ],
          detailsIncluded: true,
          events: [],
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
          occurredAfter: null,
          occurredBefore: null,
          page: 1,
          pageSize: 20,
          previousCursor: null,
          totalPages: 0,
          totalEvents: 0
        }),
        listTimelineByRepositoryFullName: vi.fn().mockResolvedValue({
          appliedCursor: null,
          appliedCursorDirection: "next",
          appliedKinds: [],
          appliedSortPreset: "newest_first",
          appliedStatuses: [],
          availableKinds: [
            "analysis_job",
            "analysis_run",
            "execution_event",
            "execution_plan",
            "tracked_pull_request"
          ],
          events: [],
          expansionMode: "summary",
          hasNextPage: false,
          hasPreviousPage: false,
          limit: 20,
          nextCursor: null,
          occurredAfter: null,
          occurredBefore: null,
          previousCursor: null,
          returnedCount: 0
        })
      },
      policyDecisionRepository: {
        listDecisions: vi.fn().mockResolvedValue({
          decisions: [],
          page: 1,
          pageSize: 25,
          totalDecisions: 0,
          totalPages: 0
        }),
        listRecentDecisions: vi.fn().mockResolvedValue([]),
        recordDecision: vi.fn().mockResolvedValue({})
      },
      ...input
    })
  );
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  });
  return app;
}

describe("fleet routes", () => {
  it("lists and creates tracked repositories", async () => {
    const trackedRepository = {
      canonicalUrl: "https://github.com/openai/openai-node",
      createdAt: "2026-04-12T10:00:00.000Z",
      fullName: "openai/openai-node",
      id: "tracked_one",
      isActive: true,
      label: "Weekly review",
      lastQueuedAt: null,
      owner: "openai",
      repo: "openai-node",
      updatedAt: "2026-04-12T10:00:00.000Z"
    };
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn().mockResolvedValue(trackedRepository),
        getRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const listResponse = await request(app)
      .get("/tracked-repositories")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      repositories: [trackedRepository]
    });

    const createResponse = await request(app)
      .post("/tracked-repositories")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        label: "Weekly review",
        repoInput: "github.com/openai/openai-node"
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      repository: trackedRepository
    });
  });

  it("enqueues and reads analysis jobs", async () => {
    const job = createAnalysisJob();
    const analysisJobProcessor = createAnalysisJobProcessor({
      enqueueAdHoc: vi.fn().mockResolvedValue(job),
      enqueueTrackedRepositoryAnalysis: vi.fn().mockResolvedValue({
        ...job,
        trackedRepositoryId: "tracked_one"
      }),
      getJob: vi.fn().mockResolvedValue(job)
    });
    const policyDecisionRepository = {
      listDecisions: vi.fn().mockResolvedValue({
        decisions: [],
        page: 1,
        pageSize: 25,
        totalDecisions: 0,
        totalPages: 0
      }),
      listRecentDecisions: vi.fn().mockResolvedValue([]),
      recordDecision: vi.fn().mockResolvedValue({})
    };
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([job])
      },
      analysisJobProcessor,
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      policyDecisionRepository,
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockResolvedValue(createTrackedRepository()),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const enqueueResponse = await request(app)
      .post("/analyze/jobs")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        label: "Async",
        repoInput: "openai/openai-node"
      });
    expect(enqueueResponse.status).toBe(202);
    expect(enqueueResponse.body).toEqual({ job });
    expect(analysisJobProcessor.enqueueAdHoc).toHaveBeenCalledWith({
      label: "Async",
      repoInput: "openai/openai-node",
      requestedByUserId: "usr_authenticated"
    });
    expect(policyDecisionRepository.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "analyze_repository",
        actorUserId: "usr_local_default",
        decision: "allowed",
        reason: "Supervised repository analysis may proceed.",
        repositoryFullName: "openai/openai-node",
        scopeType: "repository",
        workspaceId: "workspace_local_default"
      })
    );
    expect(
      policyDecisionRepository.recordDecision.mock.invocationCallOrder[0]
    ).toBeLessThan(analysisJobProcessor.enqueueAdHoc.mock.invocationCallOrder[0]!);

    const trackedEnqueueResponse = await request(app)
      .post("/analyze/jobs")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        trackedRepositoryId: "tracked_one"
      });
    expect(trackedEnqueueResponse.status).toBe(202);
    expect(analysisJobProcessor.enqueueTrackedRepositoryAnalysis).toHaveBeenCalledWith({
      requestedByUserId: "usr_authenticated",
      trackedRepositoryId: "tracked_one"
    });

    const getResponse = await request(app)
      .get("/analyze/jobs/job_one")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ job });
  });

  it("lists, retries, and cancels jobs, and enqueues async plan generation", async () => {
    const listJob = createAnalysisJob({
      errorMessage: "rate limited",
      failedAt: "2026-04-12T10:01:00.000Z",
      jobId: "job_failed",
      status: "failed"
    });
    const analysisJobProcessor = createAnalysisJobProcessor({
      cancelJob: vi.fn().mockResolvedValue({
        ...listJob,
        completedAt: "2026-04-12T10:02:00.000Z",
        errorMessage: null,
        failedAt: null,
        status: "cancelled"
      }),
      enqueueExecutionPlanJob: vi.fn().mockResolvedValue(
        createAnalysisJob({
          jobId: "job_plan",
          jobKind: "generate_execution_plan",
          planId: null
        })
      ),
      listJobs: vi.fn().mockResolvedValue([listJob]),
      retryJob: vi.fn().mockResolvedValue({
        ...listJob,
        errorMessage: null,
        failedAt: null,
        status: "queued"
      })
    });
    const policyDecisionRepository = {
      listDecisions: vi.fn().mockResolvedValue({
        decisions: [],
        page: 1,
        pageSize: 25,
        totalDecisions: 0,
        totalPages: 0
      }),
      listRecentDecisions: vi.fn().mockResolvedValue([]),
      recordDecision: vi.fn().mockResolvedValue({})
    };
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([listJob])
      },
      analysisJobProcessor,
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      policyDecisionRepository,
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn(),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const listResponse = await request(app)
      .get("/analyze/jobs?status=failed")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({ jobs: [listJob] });
    expect(analysisJobProcessor.listJobs).toHaveBeenCalledWith("failed");

    const retryResponse = await request(app)
      .post("/analyze/jobs/job_failed/retry")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(retryResponse.status).toBe(200);
    expect(analysisJobProcessor.retryJob).toHaveBeenCalledWith("job_failed");

    const cancelResponse = await request(app)
      .post("/analyze/jobs/job_failed/cancel")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(cancelResponse.status).toBe(200);
    expect(analysisJobProcessor.cancelJob).toHaveBeenCalledWith("job_failed");

    const planResponse = await request(app)
      .post("/execution/plan/jobs")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        analysisRunId: "run_one",
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"],
        selectionStrategy: "provided_candidates"
      });
    expect(planResponse.status).toBe(202);
    expect(analysisJobProcessor.enqueueExecutionPlanJob).toHaveBeenCalledWith({
      analysisRunId: "run_one",
      requestedByUserId: "usr_authenticated",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"],
      selectionStrategy: "provided_candidates"
    });
    expect(policyDecisionRepository.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "generate_pr_candidates",
        actorUserId: "usr_local_default",
        decision: "allowed",
        reason: "Execution plan generation may proceed for selected candidates.",
        runId: "run_one",
        scopeType: "repository",
        workspaceId: "workspace_local_default"
      })
    );
    expect(
      policyDecisionRepository.recordDecision.mock.invocationCallOrder[0]
    ).toBeLessThan(
      analysisJobProcessor.enqueueExecutionPlanJob.mock.invocationCallOrder[0]!
    );
  });

  it("returns fleet status and manages sweep schedules", async () => {
    const schedule = createSweepSchedule();
    const sweepJob = createAnalysisJob({
      jobId: "job_sweep",
      jobKind: "run_scheduled_sweep",
      repoInput: "[scheduled-sweep]",
      repositoryFullName: "[scheduled-sweep]",
      scheduledSweepId: schedule.scheduleId
    });
    const analysisJobProcessor = createAnalysisJobProcessor({
      createSweepSchedule: vi.fn().mockResolvedValue(schedule),
      listSweepSchedules: vi.fn().mockResolvedValue([schedule]),
      triggerSweepSchedule: vi.fn().mockResolvedValue({
        job: sweepJob,
        schedule
      })
    });
    const policyDecision = {
      actionType: "execute_write",
      actorUserId: "usr_authenticated",
      createdAt: "2026-04-12T10:06:00.000Z",
      decision: "allowed",
      details: {
        approvalGranted: true,
        selectedActionCount: 1
      },
      eventId: "policy_decision_one",
      githubInstallationId: null,
      jobId: null,
      planId: "plan_one",
      repositoryFullName: "openai/openai-node",
      reason: "Approved write execution may proceed.",
      runId: "run_one",
      scopeType: "repository",
      sweepScheduleId: null,
      workspaceId: "workspace_local_default"
    };
    const policyDecisionRepository = {
      listRecentDecisions: vi.fn().mockResolvedValue([policyDecision]),
      recordDecision: vi.fn().mockResolvedValue({})
    };
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([sweepJob])
      },
      analysisJobProcessor,
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn(),
        listRepositories: vi.fn().mockResolvedValue([])
      },
      policyDecisionRepository
    });

    const fleetStatusResponse = await request(app)
      .get("/fleet/status")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(fleetStatusResponse.status).toBe(200);
    expect(fleetStatusResponse.body.summary.trackedRepositories).toBe(1);
    expect(fleetStatusResponse.body.policyDecisions).toEqual([policyDecision]);
    expect(fleetStatusResponse.body.autonomySimulation).toMatchObject({
      comparison: {
        currentManualFlow: {
          candidateActions: 2,
          requiresApproval: true
        },
        simulatedAutonomousFlow: {
          manualReviewActions: 2,
          pullRequestsOpened: 0,
          unattendedWrites: 0
        }
      },
      outcomeCounts: {
        manualReview: 2,
        wouldAllow: 0,
        wouldBlock: 0
      },
      policyProfile: "proposed_low_risk_pr_opening",
      simulationMode: "dry_run"
    });
    expect(
      fleetStatusResponse.body.autonomySimulation.repositoryReadiness[0]
    ).toMatchObject({
      executablePatchPlans: 2,
      readiness: "needs_review",
      repositoryFullName: "openai/openai-node"
    });
    expect(policyDecisionRepository.listRecentDecisions).toHaveBeenCalledWith({
      limit: 12,
      workspaceId: "workspace_local_default"
    });

    const listSchedulesResponse = await request(app)
      .get("/sweep-schedules")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(listSchedulesResponse.status).toBe(200);
    expect(listSchedulesResponse.body).toEqual({
      schedules: [schedule]
    });

    const createScheduleResponse = await request(app)
      .post("/sweep-schedules")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        cadence: "weekly",
        label: "Weekly sweep",
        selectionStrategy: "all_executable_prs"
      });
    expect(createScheduleResponse.status).toBe(201);
    expect(createScheduleResponse.body).toEqual({
      schedule
    });
    expect(policyDecisionRepository.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "schedule_sweep",
        actorUserId: "usr_local_default",
        decision: "allowed",
        reason: "Plan-only sweep scheduling may proceed.",
        scopeType: "workspace",
        workspaceId: "workspace_local_default"
      })
    );

    const triggerResponse = await request(app)
      .post("/sweep-schedules/sweep_one/trigger")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(triggerResponse.status).toBe(200);
    expect(triggerResponse.body).toEqual({
      job: sweepJob,
      schedule
    });
    expect(analysisJobProcessor.triggerSweepSchedule).toHaveBeenCalledWith({
      requestedByUserId: "usr_authenticated",
      scheduleId: "sweep_one"
    });
  });

  it("lists policy decisions with server-side pagination and filters", async () => {
    const policyDecision = {
      actionType: "execute_write",
      actorUserId: "usr_authenticated",
      createdAt: "2026-04-12T10:06:00.000Z",
      decision: "denied",
      details: {
        selectedActionCount: 2
      },
      eventId: "policy_decision_two",
      githubInstallationId: null,
      jobId: null,
      planId: "plan_two",
      repositoryFullName: "openai/openai-node",
      reason: "Write execution requires explicit approval.",
      runId: "run_two",
      scopeType: "repository",
      sweepScheduleId: null,
      workspaceId: "workspace_local_default"
    };
    const policyDecisionRepository = {
      listDecisions: vi.fn().mockResolvedValue({
        decisions: [policyDecision],
        page: 2,
        pageSize: 5,
        totalDecisions: 6,
        totalPages: 2
      }),
      listRecentDecisions: vi.fn().mockResolvedValue([]),
      recordDecision: vi.fn().mockResolvedValue({})
    };
    const app = createTestApp({
      analysisJobProcessor: createAnalysisJobProcessor(),
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      policyDecisionRepository,
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn(),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const response = await request(app)
      .get(
        "/policy-decisions?page=2&pageSize=5&actionType=execute_write&decision=denied&repositoryFullName=openai%2Fopenai-node&occurredAfter=2026-04-12T00%3A00%3A00.000Z&occurredBefore=2026-04-13T00%3A00%3A00.000Z"
      )
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      decisions: [policyDecision],
      page: 2,
      pageSize: 5,
      totalDecisions: 6,
      totalPages: 2
    });
    expect(policyDecisionRepository.listDecisions).toHaveBeenCalledWith({
      actionType: "execute_write",
      decision: "denied",
      occurredAfter: "2026-04-12T00:00:00.000Z",
      occurredBefore: "2026-04-13T00:00:00.000Z",
      page: 2,
      pageSize: 5,
      repositoryFullName: "openai/openai-node",
      workspaceId: "workspace_local_default"
    });
  });

  it("rejects invalid policy decision pagination query params", async () => {
    const app = createTestApp({
      analysisJobProcessor: createAnalysisJobProcessor(),
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn(),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const response = await request(app)
      .get("/policy-decisions?occurredAfter=not-a-date")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid policy decision query params");
  });

  it("returns tracked repository history", async () => {
    const listActivitiesByRepositoryFullName = vi.fn().mockResolvedValue({
      appliedCursor: null,
      appliedCursorDirection: "next",
      appliedKinds: ["execution_plan"],
      appliedSortPreset: "newest_first",
      appliedStatuses: ["planned"],
      availableKinds: [
        "analysis_job",
        "analysis_run",
        "execution_event",
        "execution_plan",
        "tracked_pull_request"
      ],
      events: [
        createRepositoryActivity(),
        createRepositoryActivity({
          activityId: "plan:plan_one",
          detail: {
            actorUserId: null,
            approvalStatus: "required",
            blockedActionCount: 0,
            blockedPatchPlanCount: null,
            branchName: null,
            candidateSelectionCount: 1,
            detailType: "execution_plan",
            eligibleActionCount: 1,
            executionResultStatus: null,
            executablePatchPlanCount: null,
            findingCount: null,
            jobKind: null,
            label: null,
            lifecycleStatus: "planned",
            relatedActionId: null,
            relatedExecutionId: "exec_one",
            relatedJobId: null,
            relatedPlanId: "plan_one",
            relatedRunId: "run_one",
            relatedTrackedPullRequestId: null,
            selectedIssueCandidateCount: 0,
            selectedPRCandidateCount: 1,
            totalActionCount: 1,
            totalSelectionCount: 1
          },
          executionId: "exec_one",
          kind: "execution_plan",
          occurredAt: "2026-04-12T10:05:00.000Z",
          planId: "plan_one",
          runId: "run_one",
          status: "planned",
          summary: "1 actions",
          title: "plan_one"
        })
      ],
      detailsIncluded: true,
      hasNextPage: true,
      hasPreviousPage: false,
      nextCursor: "cursor_next",
      occurredAfter: "2026-04-12T10:00:00.000Z",
      occurredBefore: "2026-04-12T11:00:00.000Z",
      page: 1,
      pageSize: 2,
      previousCursor: null,
      totalPages: 3,
      totalEvents: 2
    });
    const trackedRepository = {
      canonicalUrl: "https://github.com/openai/openai-node",
      createdAt: "2026-04-12T10:00:00.000Z",
      fullName: "openai/openai-node",
      id: "tracked_one",
      isActive: true,
      label: "Weekly review",
      lastQueuedAt: "2026-04-12T10:00:00.000Z",
      owner: "openai",
      repo: "openai-node",
      updatedAt: "2026-04-12T10:00:00.000Z"
    };
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([createAnalysisJob({
          trackedRepositoryId: "tracked_one"
        })])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([
          createExecutionPlanSummary()
        ])
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([
          {
            blockedPatchPlans: 1,
            createdAt: "2026-04-12T10:03:00.000Z",
            defaultBranch: "main",
            executablePatchPlans: 2,
            fetchedAt: "2026-04-12T10:03:00.000Z",
            highSeverityFindings: 0,
            id: "run_one",
            issueCandidates: 0,
            label: "Weekly review",
            prCandidates: 2,
            repositoryFullName: "openai/openai-node",
            totalFindings: 1
          }
        ])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([
          {
            branchName: "repo-guardian/test-branch",
            closedAt: null,
            createdAt: "2026-04-12T10:04:00.000Z",
            executionId: "exec_one",
            lifecycleStatus: "open",
            mergedAt: null,
            owner: "openai",
            planId: "plan_one",
            pullRequestNumber: 19,
            pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
            repo: "openai-node",
            repositoryFullName: "openai/openai-node",
            title: "Harden workflow",
            trackedPullRequestId: "tpr_one",
            updatedAt: "2026-04-12T10:04:00.000Z"
          }
        ])
      },
      repositoryActivityStore: {
        getActivityByRepositoryFullName: vi.fn(),
        listActivitiesByRepositoryFullName,
        listTimelineByRepositoryFullName: vi.fn()
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const response = await request(app)
      .get(
        "/tracked-repositories/tracked_one/history?activityKinds=execution_plan&activityStatuses=planned&activityOccurredAfter=2026-04-12T10:00:00.000Z&activityOccurredBefore=2026-04-12T11:00:00.000Z&activityPage=1&activityPageSize=2"
      )
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(200);
    expect(response.body.trackedRepository.id).toBe("tracked_one");
    expect(response.body.currentStatus.trackedRepository.id).toBe("tracked_one");
    expect(response.body.recentRuns[0]?.id).toBe("run_one");
    expect(response.body.recentJobs[0]?.jobId).toBe("job_one");
    expect(response.body.recentPlans[0]?.planId).toBe("plan_one");
    expect(response.body.trackedPullRequests[0]?.trackedPullRequestId).toBe("tpr_one");
    expect(response.body.activityFeed.totalEvents).toBe(2);
    expect(response.body.activityFeed.pageSize).toBe(2);
    expect(response.body.activityFeed.appliedKinds).toEqual(["execution_plan"]);
    expect(response.body.activityFeed.appliedStatuses).toEqual(["planned"]);
    expect(
      response.body.activityFeed.events.some(
        (event: { activityId: string }) => event.activityId === "plan:plan_one"
      )
    ).toBe(true);
    expect(listActivitiesByRepositoryFullName).toHaveBeenCalledWith({
      cursor: null,
      cursorDirection: "next",
      includeDetails: false,
      kinds: ["execution_plan"],
      limit: 2,
      occurredAfter: "2026-04-12T10:00:00.000Z",
      occurredBefore: "2026-04-12T11:00:00.000Z",
      offset: 0,
      repositoryFullName: "openai/openai-node",
      sortPreset: "newest_first",
      statuses: ["planned"]
    });
  });

  it("returns tracked repository activity without loading repository summary context", async () => {
    const listActivitiesByRepositoryFullName = vi.fn().mockResolvedValue({
      appliedCursor: "cursor_one",
      appliedCursorDirection: "next",
      appliedKinds: [],
      appliedSortPreset: "oldest_first",
      appliedStatuses: ["completed", "open"],
      availableKinds: [
        "analysis_job",
        "analysis_run",
        "execution_event",
        "execution_plan",
        "tracked_pull_request"
      ],
      detailsIncluded: true,
      events: [createRepositoryActivity({ status: "completed" })],
      hasNextPage: false,
      hasPreviousPage: true,
      nextCursor: null,
      occurredAfter: "2026-04-10T00:00:00.000Z",
      occurredBefore: null,
      page: 2,
      pageSize: 1,
      previousCursor: "cursor_previous",
      totalEvents: 2,
      totalPages: 2
    });
    const trackedRepository = createTrackedRepository();
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      repositoryActivityStore: {
        getActivityByRepositoryFullName: vi.fn(),
        listActivitiesByRepositoryFullName,
        listTimelineByRepositoryFullName: vi.fn()
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const response = await request(app)
      .get(
        "/tracked-repositories/tracked_one/activity?activityStatuses=completed,open&activityOccurredAfter=2026-04-10T00:00:00.000Z&activityPage=2&activityPageSize=1&activitySortPreset=oldest_first&activityCursor=cursor_one&activityCursorDirection=next&activityIncludeDetails=true"
      )
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(2);
    expect(response.body.appliedSortPreset).toBe("oldest_first");
    expect(response.body.appliedStatuses).toEqual(["completed", "open"]);
    expect(listActivitiesByRepositoryFullName).toHaveBeenCalledWith({
      cursor: "cursor_one",
      cursorDirection: "next",
      includeDetails: true,
      kinds: [],
      limit: 1,
      occurredAfter: "2026-04-10T00:00:00.000Z",
      occurredBefore: null,
      offset: 1,
      repositoryFullName: "openai/openai-node",
      sortPreset: "oldest_first",
      statuses: ["completed", "open"]
    });
  });

  it("returns a cursor-native tracked repository timeline page", async () => {
    const listTimelineByRepositoryFullName = vi.fn().mockResolvedValue({
      appliedCursor: "cursor_one",
      appliedCursorDirection: "next",
      appliedKinds: ["execution_plan"],
      appliedSortPreset: "oldest_first",
      appliedStatuses: ["completed"],
      availableKinds: [
        "analysis_job",
        "analysis_run",
        "execution_event",
        "execution_plan",
        "tracked_pull_request"
      ],
      events: [createRepositoryActivity({ status: "completed" })],
      expansionMode: "detail",
      hasNextPage: true,
      hasPreviousPage: true,
      limit: 5,
      nextCursor: "cursor_next",
      occurredAfter: "2026-04-10T00:00:00.000Z",
      occurredBefore: null,
      previousCursor: "cursor_previous",
      returnedCount: 1
    });
    const trackedRepository = createTrackedRepository();
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      repositoryActivityStore: {
        getActivityByRepositoryFullName: vi.fn(),
        listActivitiesByRepositoryFullName: vi.fn(),
        listTimelineByRepositoryFullName
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const response = await request(app)
      .get(
        "/tracked-repositories/tracked_one/timeline?timelineKinds=execution_plan&timelineStatuses=completed&timelineOccurredAfter=2026-04-10T00:00:00.000Z&timelineLimit=5&timelineSortPreset=oldest_first&timelineCursor=cursor_one&timelineDirection=next&timelineExpand=detail"
      )
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(200);
    expect(response.body.expansionMode).toBe("detail");
    expect(response.body.limit).toBe(5);
    expect(listTimelineByRepositoryFullName).toHaveBeenCalledWith({
      cursor: "cursor_one",
      cursorDirection: "next",
      expansionMode: "detail",
      kinds: ["execution_plan"],
      limit: 5,
      occurredAfter: "2026-04-10T00:00:00.000Z",
      occurredBefore: null,
      repositoryFullName: "openai/openai-node",
      sortPreset: "oldest_first",
      statuses: ["completed"]
    });
  });

  it("returns a tracked repository timeline event with expanded audit detail", async () => {
    const getActivityByRepositoryFullName = vi.fn().mockResolvedValue(
      createRepositoryActivity({
        activityId: "execution-event:event_one",
        detail: {
          actorUserId: "operator_one",
          actionType: null,
          blockedPatchPlanCount: null,
          branchName: null,
          candidateSelectionCount: null,
          detailType: "execution_event",
          errors: [],
          eventType: "execution_completed",
          executablePatchPlanCount: null,
          findingCount: null,
          jobKind: null,
          label: null,
          lifecycleStatus: null,
          nextStatus: "completed",
          previousStatus: null,
          rawPayload: {
            phase: "finalize",
            result: "merged"
          },
          relatedActionId: "action_one",
          relatedExecutionId: "exec_one",
          relatedJobId: null,
          relatedPlanId: "plan_one",
          relatedRunId: null,
          relatedTrackedPullRequestId: null,
          succeeded: null,
          warnings: []
        },
        executionEventId: "event_one",
        executionId: "exec_one",
        kind: "execution_event",
        planId: "plan_one",
        runId: null,
        status: "execution_completed",
        summary: "Action action_one",
        title: "Execution Completed"
      })
    );
    const trackedRepository = createTrackedRepository();
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      repositoryActivityStore: {
        getActivityByRepositoryFullName,
        listActivitiesByRepositoryFullName: vi.fn(),
        listTimelineByRepositoryFullName: vi.fn()
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const response = await request(app)
      .get("/tracked-repositories/tracked_one/timeline/execution-event:event_one?expand=detail")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(200);
    expect(response.body.detail.detailType).toBe("execution_event");
    expect(response.body.detail.rawPayload).toEqual({
      phase: "finalize",
      result: "merged"
    });
    expect(getActivityByRepositoryFullName).toHaveBeenCalledWith({
      activityId: "execution-event:event_one",
      expansionMode: "detail",
      repositoryFullName: "openai/openai-node"
    });
  });

  it("returns 404 when tracked repository history does not exist", async () => {
    const app = createTestApp({
      analysisJobStore: {
        listJobs: vi.fn().mockResolvedValue([])
      },
      analysisJobProcessor: createAnalysisJobProcessor(),
      executionPlanStore: {
        listPlanSummariesByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      runStore: {
        listRunsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedPullRequestStore: {
        listTrackedPullRequestsByRepositoryFullName: vi.fn().mockResolvedValue([])
      },
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        getRepository: vi.fn().mockRejectedValue(
          new PersistenceError("not_found", "Tracked repository was not found.")
        ),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const response = await request(app)
      .get("/tracked-repositories/tracked_missing/history")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Tracked repository was not found."
    });
  });
});
