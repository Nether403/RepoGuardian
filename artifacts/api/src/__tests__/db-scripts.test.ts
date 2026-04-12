import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AnalysisRunRepository,
  ExecutionPlanRepository,
  PostgresClient
} from "@repo-guardian/persistence";
import type { SavedAnalysisRun } from "@repo-guardian/shared-types";
import { createIsolatedTestDatabase } from "../../../../lib/persistence/src/__tests__/postgres-test-database.js";

const describeIf = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const tempDirs: string[] = [];

type ResetPersistenceCaches = () => Promise<void>;

function createRun(runId: string): SavedAnalysisRun {
  return {
    analysis: {
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
    },
    createdAt: "2026-04-12T10:01:00.000Z",
    id: runId,
    label: "Legacy run"
  };
}

describeIf("database scripts", () => {
  let client: PostgresClient;
  let runRepository: AnalysisRunRepository;
  let planRepository: ExecutionPlanRepository;
  let connectionString: string;
  let disposeDatabase: () => Promise<void>;

  beforeAll(async () => {
    const isolatedDatabase = await createIsolatedTestDatabase("repo_guardian_api_scripts");
    connectionString = isolatedDatabase.connectionString;
    disposeDatabase = isolatedDatabase.dispose;
    client = new PostgresClient({ connectionString });
    runRepository = new AnalysisRunRepository(client);
    planRepository = new ExecutionPlanRepository(client);
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        rm(dir, {
          force: true,
          recursive: true
        })
      )
    );
  });

  afterAll(async () => {
    vi.resetModules();
    const { resetPersistenceCaches } = await import("../lib/persistence.js");
    await resetPersistenceCaches();
    await client.close();
    await disposeDatabase();
  });

  async function loadScriptModules(input?: {
    plansRootDir?: string;
    runsRootDir?: string;
  }): Promise<{
    resetPersistenceCaches: ResetPersistenceCaches;
    runDatabaseMigrations: () => Promise<string[]>;
    runLegacyImport: () => Promise<unknown>;
  }> {
    process.env.NODE_ENV = "test";
    process.env.API_SECRET_KEY = "dev-secret-key-do-not-use-in-production";
    process.env.DATABASE_URL = connectionString;

    if (input?.runsRootDir) {
      process.env.REPO_GUARDIAN_RUN_STORE_DIR = input.runsRootDir;
    } else {
      delete process.env.REPO_GUARDIAN_RUN_STORE_DIR;
    }

    if (input?.plansRootDir) {
      process.env.REPO_GUARDIAN_PLAN_STORE_DIR = input.plansRootDir;
    } else {
      delete process.env.REPO_GUARDIAN_PLAN_STORE_DIR;
    }

    vi.resetModules();

    const [{ runDatabaseMigrations }, { runLegacyImport }, { resetPersistenceCaches }] =
      await Promise.all([
        import("../scripts/db-migrate.ts"),
        import("../scripts/db-import-legacy.ts"),
        import("../lib/persistence.js")
      ]);

    return {
      resetPersistenceCaches,
      runDatabaseMigrations,
      runLegacyImport
    };
  }

  it("runs migrations on an empty database and reruns idempotently", async () => {
    const { resetPersistenceCaches, runDatabaseMigrations } =
      await loadScriptModules();

    const first = await runDatabaseMigrations();
    expect(first).toEqual([
      "0001_execution_backbone.sql",
      "0002_execution_plan_action_order_unique.sql",
      "0003_analysis_queue_foundation.sql",
      "0004_scheduling_and_pr_lifecycle.sql"
    ]);

    await resetPersistenceCaches();

    const second = await runDatabaseMigrations();
    expect(second).toEqual([]);

    await resetPersistenceCaches();
  });

  it("imports legacy JSON into Postgres and reports skipped non-planned plans honestly", async () => {
    const runsRootDir = await mkdtemp(join(tmpdir(), "repo-guardian-runs-"));
    const plansRootDir = await mkdtemp(join(tmpdir(), "repo-guardian-plans-"));
    tempDirs.push(runsRootDir, plansRootDir);

    const run = createRun("legacy-run");
    await writeFile(
      join(runsRootDir, "legacy-run.json"),
      `${JSON.stringify(run, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(plansRootDir, "planned.json"),
      `${JSON.stringify({
        actorUserId: "usr_authenticated",
        analysisRunId: run.id,
        createdAt: "2026-04-12T10:02:00.000Z",
        expiresAt: "2026-04-12T10:17:00.000Z",
        normalizedExecutionPayload: {
          actions: [
            {
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
              actionType: "create_issue"
            }
          ]
        },
        planHash: "sha256:test",
        planId: "plan_legacy",
        repositoryFullName: "openai/openai-node",
        selectedIssueCandidateIds: ["issue:one"],
        selectedPRCandidateIds: [],
        status: "planned"
      }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(plansRootDir, "completed.json"),
      `${JSON.stringify({
        actorUserId: "usr_authenticated",
        analysisRunId: run.id,
        createdAt: "2026-04-12T10:02:00.000Z",
        expiresAt: "2026-04-12T10:17:00.000Z",
        normalizedExecutionPayload: { actions: [] },
        planHash: "sha256:test-two",
        planId: "plan_completed",
        repositoryFullName: "openai/openai-node",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: [],
        status: "completed"
      }, null, 2)}\n`,
      "utf8"
    );

    const { resetPersistenceCaches, runDatabaseMigrations, runLegacyImport } =
      await loadScriptModules({
        plansRootDir,
        runsRootDir
      });

    await runDatabaseMigrations();
    const report = await runLegacyImport();

    expect(report).toEqual({
      planSkipReasons: {
        alreadyImported: 0,
        missingAnalysisRun: 0,
        nonPlannedStatus: {
          completed: 1,
          executing: 0,
          failed: 0
        }
      },
      plansImported: 1,
      plansSkipped: 1,
      runSkipReasons: {
        alreadyImported: 0
      },
      runsImported: 1,
      runsSkipped: 0
    });

    const storedRun = await runRepository.getRun(run.id);
    const storedPlan = await planRepository.getPlanDetail("plan_legacy");

    expect(storedRun.run.id).toBe(run.id);
    expect(storedPlan.planId).toBe("plan_legacy");
    expect(storedPlan.status).toBe("planned");

    await resetPersistenceCaches();
  });
});
