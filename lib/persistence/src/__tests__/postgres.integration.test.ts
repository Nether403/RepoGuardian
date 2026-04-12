import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type AnalyzeRepoResponse,
  type ExecutionActionPlan,
  type ExecutionResult,
  type SavedAnalysisRun
} from "@repo-guardian/shared-types";
import { createAnalysisRunSummary } from "@repo-guardian/runs";
import { AnalysisJobRepository } from "../analysis-jobs.js";
import { AnalysisRunRepository } from "../analysis-runs.js";
import { PostgresClient } from "../client.js";
import { PersistenceError } from "../errors.js";
import {
  ExecutionPlanRepository,
  type ClaimedExecutionPlan,
  type StoredExecutionPlan
} from "../execution-plans.js";
import { runMigrations } from "../migrations.js";
import { TrackedRepositoryRepository } from "../tracked-repositories.js";
import { createIsolatedTestDatabase } from "./postgres-test-database.js";

const describeIf = process.env.TEST_DATABASE_URL ? describe : describe.skip;

function createAnalysis(): AnalyzeRepoResponse {
  return {
    codeReviewFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false,
      reviewedFileCount: 0,
      totalFindings: 0
    },
    codeReviewFindings: [],
    dependencyFindingSummary: {
      findingsBySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      isPartial: false,
      totalFindings: 0,
      vulnerableDirectCount: 0,
      vulnerableTransitiveCount: 0
    },
    dependencyFindings: [],
    dependencySnapshot: {
      dependencies: [],
      filesParsed: [],
      filesSkipped: [],
      isPartial: false,
      parseWarningDetails: [],
      parseWarnings: [],
      summary: {
        byEcosystem: [],
        directDependencies: 0,
        parsedFileCount: 0,
        skippedFileCount: 0,
        totalDependencies: 0,
        transitiveDependencies: 0
      }
    },
    detectedFiles: {
      lockfiles: [],
      manifests: [],
      signals: []
    },
    ecosystems: [],
    fetchedAt: "2026-04-12T10:00:00.000Z",
    isPartial: false,
    issueCandidateSummary: {
      bySeverity: { critical: 0, high: 0, info: 0, low: 0, medium: 0 },
      byType: [],
      totalCandidates: 0
    },
    issueCandidates: [],
    prCandidateSummary: {
      byReadiness: [],
      byRiskLevel: [],
      byType: [],
      totalCandidates: 0
    },
    prCandidates: [],
    prPatchPlanSummary: {
      byPatchability: [],
      byValidationStatus: [],
      totalPatchCandidates: 0,
      totalPlans: 0
    },
    prPatchPlans: [],
    repository: {
      canonicalUrl: "https://github.com/openai/openai-node",
      defaultBranch: "main",
      description: "Test repository",
      forks: 0,
      fullName: "openai/openai-node",
      htmlUrl: "https://github.com/openai/openai-node",
      owner: "openai",
      primaryLanguage: "TypeScript",
      repo: "openai-node",
      stars: 1
    },
    reviewCoverage: {
      candidateFileCount: 0,
      isPartial: false,
      reviewedFileCount: 0,
      selectedFileCount: 0,
      selectedPaths: [],
      skippedFileCount: 0,
      skippedPaths: [],
      strategy: "targeted"
    },
    treeSummary: {
      samplePaths: [],
      totalDirectories: 0,
      totalFiles: 0,
      truncated: false
    },
    warningDetails: [],
    warnings: []
  };
}

function createRun(runId: string): SavedAnalysisRun {
  return {
    analysis: createAnalysis(),
    createdAt: "2026-04-12T10:01:00.000Z",
    id: runId,
    label: "Integration"
  };
}

function createAction(overrides: Partial<ExecutionActionPlan> = {}): ExecutionActionPlan {
  return {
    affectedPackages: [],
    affectedPaths: [],
    approvalNotes: [],
    approvalRequired: true,
    approvalStatus: "required",
    attempted: false,
    blocked: false,
    branchName: null,
    commitSha: null,
    errorMessage: null,
    eligibility: "eligible",
    id: "action:one",
    issueNumber: null,
    issueUrl: null,
    linkedIssueCandidateIds: [],
    linkedPRCandidateIds: [],
    plannedSteps: ["Create issue"],
    pullRequestNumber: null,
    pullRequestUrl: null,
    reason: "Ready",
    succeeded: false,
    targetId: "issue:one",
    targetType: "issue_candidate",
    title: "Create issue",
    actionType: "create_issue",
    ...overrides
  };
}

function createPlan(input?: {
  actions?: ExecutionActionPlan[];
  createdAt?: string;
  expiresAt?: string;
  planId?: string;
  runId?: string;
}): StoredExecutionPlan {
  const run = createRun(input?.runId ?? "integration-run");
  const summary = createAnalysisRunSummary(run);

  return {
    actions: input?.actions ?? [createAction()],
    actorUserId: "usr_authenticated",
    analysisRunId: run.id,
    approval: {
      confirmationText: "I approve this GitHub write-back plan.",
      required: true
    },
    createdAt: input?.createdAt ?? "2026-04-12T10:02:00.000Z",
    expiresAt: input?.expiresAt ?? "2099-04-12T10:17:00.000Z",
    planHash: "sha256:test-plan",
    planId: input?.planId ?? "plan_integration",
    repository: {
      defaultBranch: run.analysis.repository.defaultBranch,
      fullName: summary.repositoryFullName,
      owner: run.analysis.repository.owner,
      repo: run.analysis.repository.repo
    },
    selectedIssueCandidateIds: ["issue:one"],
    selectedPRCandidateIds: [],
    summary: {
      approvalRequiredActions: (input?.actions ?? [createAction()]).length,
      blockedActions: 0,
      eligibleActions: (input?.actions ?? [createAction()]).length,
      issueSelections: 1,
      prSelections: 0,
      skippedActions: 0,
      totalActions: (input?.actions ?? [createAction()]).length,
      totalSelections: 1
    }
  };
}

function createResult(input: {
  action: ExecutionActionPlan;
  executionId: string;
  status: "completed" | "failed";
}): ExecutionResult {
  return {
    actions: [input.action],
    approvalNotes: ["Explicit approval verified via token."],
    approvalRequired: true,
    approvalStatus: "granted",
    completedAt: "2026-04-12T10:06:00.000Z",
    errors: input.status === "failed" ? ["Action failed."] : [],
    executionId: input.executionId,
    mode: "execute_approved",
    startedAt: "2026-04-12T10:03:00.000Z",
    status: input.status,
    summary: {
      approvalRequiredActions: 1,
      blockedActions: 0,
      eligibleActions: 1,
      issueSelections: 1,
      prSelections: 0,
      skippedActions: 0,
      totalActions: 1,
      totalSelections: 1
    },
    warnings: input.status === "failed" ? ["Manual follow-up required."] : []
  };
}

describeIf("Postgres persistence integration", () => {
  let client: PostgresClient;
  let disposeDatabase: () => Promise<void>;
  let runRepository: AnalysisRunRepository;
  let planRepository: ExecutionPlanRepository;
  let trackedRepositoryRepository: TrackedRepositoryRepository;
  let analysisJobRepository: AnalysisJobRepository;

  beforeAll(async () => {
    const isolatedDatabase = await createIsolatedTestDatabase(
      "repo_guardian_persistence"
    );
    disposeDatabase = isolatedDatabase.dispose;
    client = new PostgresClient({
      connectionString: isolatedDatabase.connectionString
    });
    runRepository = new AnalysisRunRepository(client);
    planRepository = new ExecutionPlanRepository(client);
    trackedRepositoryRepository = new TrackedRepositoryRepository(client);
    analysisJobRepository = new AnalysisJobRepository(client);
    await runMigrations(client);
  });

  beforeEach(async () => {
    await client.query(
      "TRUNCATE analysis_jobs, tracked_repositories, execution_audit_events, execution_attempts, execution_plan_actions, execution_plans, analysis_runs RESTART IDENTITY CASCADE"
    );
  });

  afterAll(async () => {
    await client.close();
    await disposeDatabase();
  });

  it("applies migrations on an empty database and reruns idempotently", async () => {
    const isolatedDatabase = await createIsolatedTestDatabase(
      "repo_guardian_migrations"
    );
    const migrationClient = new PostgresClient({
      connectionString: isolatedDatabase.connectionString
    });

    try {
      await expect(runMigrations(migrationClient)).resolves.toEqual([
        "0001_execution_backbone.sql",
        "0002_execution_plan_action_order_unique.sql",
        "0003_analysis_queue_foundation.sql",
        "0004_scheduling_and_pr_lifecycle.sql"
      ]);
      await expect(runMigrations(migrationClient)).resolves.toEqual([]);
    } finally {
      await migrationClient.close();
      await isolatedDatabase.dispose();
    }
  });

  it("persists runs and enriches summaries with durable execution metadata", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(createPlan({ runId: run.id }));

    const listed = await runRepository.listRuns();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      execution: {
        latestExecutionCompletedAt: null,
        latestPlanId: "plan_integration",
        latestPlanStatus: "planned"
      },
      id: run.id
    });

    const reopened = await runRepository.getRun(run.id);
    expect(reopened.summary.execution).toEqual({
      latestExecutionCompletedAt: null,
      latestPlanId: "plan_integration",
      latestPlanStatus: "planned"
    });
  });

  it("persists tracked repositories and analysis jobs for async queueing", async () => {
    const trackedRepository = await trackedRepositoryRepository.createRepository({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      label: "Weekly dependency review",
      owner: "openai",
      repo: "openai-node"
    });

    const job = await analysisJobRepository.enqueueJob({
      jobKind: "analyze_repository",
      label: trackedRepository.label,
      repoInput: trackedRepository.fullName,
      repositoryFullName: trackedRepository.fullName,
      requestedByUserId: "usr_authenticated",
      trackedRepositoryId: trackedRepository.id
    });

    expect(job).toMatchObject({
      attemptCount: 0,
      repositoryFullName: "openai/openai-node",
      status: "queued",
      trackedRepositoryId: trackedRepository.id
    });
    expect((await trackedRepositoryRepository.listRepositories())[0]).toMatchObject({
      fullName: "openai/openai-node",
      id: trackedRepository.id,
      lastQueuedAt: expect.any(String)
    });

    const claimed = await analysisJobRepository.claimNextQueuedJob();
    expect(claimed).toMatchObject({
      attemptCount: 1,
      jobId: job.jobId,
      status: "running"
    });

    const run = createRun("async-run");
    await runRepository.upsertRun(run);
    const completed = await analysisJobRepository.completeJob({
      jobId: job.jobId,
      runId: run.id
    });

    expect(completed).toMatchObject({
      completedAt: expect.any(String),
      jobId: job.jobId,
      runId: run.id,
      status: "completed"
    });
  });

  it("enforces unique action ordering within a plan", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(createPlan({ runId: run.id }));

    await expect(
      client.query(
        `INSERT INTO execution_plan_actions (
          plan_id,
          action_id,
          action_index,
          action_payload,
          started_at,
          completed_at
        ) VALUES ($1, $2, $3, $4::jsonb, NULL, NULL)`,
        [
          "plan_integration",
          "action:duplicate",
          0,
          JSON.stringify(createAction({ id: "action:duplicate" }))
        ]
      )
    ).rejects.toThrow();
  });

  it("allows only one concurrent claimExecution call for the same plan", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(createPlan({ runId: run.id }));

    const [first, second] = await Promise.allSettled([
      planRepository.claimExecution({
        actorUserId: "usr_a",
        planId: "plan_integration"
      }),
      planRepository.claimExecution({
        actorUserId: "usr_b",
        planId: "plan_integration"
      })
    ]);

    const fulfilled = [first, second].filter(
      (result): result is PromiseFulfilledResult<ClaimedExecutionPlan> =>
        result.status === "fulfilled"
    );
    const rejected = [first, second].filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(PersistenceError);
    expect((rejected[0]?.reason as PersistenceError).code).toBe("conflict");

    const detail = await planRepository.getPlanDetail("plan_integration");
    expect(detail.status).toBe("executing");
    expect(detail.executionId).toBeTruthy();
  });

  it("expires a planned plan lazily when it is read after expiresAt", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(
      createPlan({
        expiresAt: "2000-04-12T10:17:00.000Z",
        runId: run.id
      })
    );

    const detail = await planRepository.getPlanDetail("plan_integration");
    const events = await planRepository.getPlanEvents("plan_integration");

    expect(detail.status).toBe("expired");
    expect(events.events.map((event) => event.eventType)).toEqual([
      "plan_created",
      "plan_expired"
    ]);
  });

  it("records action timestamps and ordered events for executing to completed", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(createPlan({ runId: run.id }));

    const claimed = await planRepository.claimExecution({
      actorUserId: "usr_authenticated",
      planId: "plan_integration"
    });
    const startedAction = createAction({
      attempted: true,
      id: claimed.actions[0]?.id ?? "action:one"
    });
    const completedAction = {
      ...startedAction,
      succeeded: true
    };

    await planRepository.recordActionStarted({
      action: startedAction,
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName
    });
    await planRepository.recordActionCompleted({
      action: completedAction,
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName
    });
    await planRepository.finalizeExecution({
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName,
      result: createResult({
        action: completedAction,
        executionId: claimed.executionId,
        status: "completed"
      })
    });

    const detail = await planRepository.getPlanDetail("plan_integration");
    const events = await planRepository.getPlanEvents("plan_integration");

    expect(detail.status).toBe("completed");
    expect(detail.completedAt).toBeTruthy();
    expect(detail.actions[0]?.startedAt).toBeTruthy();
    expect(detail.actions[0]?.completedAt).toBeTruthy();
    expect(events.events.map((event) => event.eventType)).toEqual([
      "plan_created",
      "execution_started",
      "action_started",
      "action_succeeded",
      "execution_completed"
    ]);
  });

  it("records ordered events for executing to failed", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);
    await planRepository.savePlan(createPlan({ runId: run.id }));

    const claimed = await planRepository.claimExecution({
      actorUserId: "usr_authenticated",
      planId: "plan_integration"
    });
    const startedAction = createAction({
      attempted: true,
      id: claimed.actions[0]?.id ?? "action:one"
    });
    const failedAction = {
      ...startedAction,
      errorMessage: "Action failed.",
      succeeded: false
    };

    await planRepository.recordActionStarted({
      action: startedAction,
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName
    });
    await planRepository.recordActionCompleted({
      action: failedAction,
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName
    });
    await planRepository.finalizeExecution({
      actorUserId: "usr_authenticated",
      executionId: claimed.executionId,
      planId: claimed.planId,
      repositoryFullName: claimed.repositoryFullName,
      result: createResult({
        action: failedAction,
        executionId: claimed.executionId,
        status: "failed"
      })
    });

    const detail = await planRepository.getPlanDetail("plan_integration");
    const events = await planRepository.getPlanEvents("plan_integration");

    expect(detail.status).toBe("failed");
    expect(detail.failedAt).toBeTruthy();
    expect(events.events.map((event) => event.eventType)).toEqual([
      "plan_created",
      "execution_started",
      "action_started",
      "action_failed",
      "execution_failed"
    ]);
  });
});
