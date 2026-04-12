import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type AnalyzeRepoResponse,
  type ExecutionActionPlan,
  type SavedAnalysisRun
} from "@repo-guardian/shared-types";
import { createAnalysisRunSummary } from "@repo-guardian/runs";
import { AnalysisRunRepository } from "../analysis-runs.js";
import { PostgresClient } from "../client.js";
import { ExecutionPlanRepository } from "../execution-plans.js";
import { runMigrations } from "../migrations.js";

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

function createAction(): ExecutionActionPlan {
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
    actionType: "create_issue"
  };
}

describeIf("Postgres persistence integration", () => {
  const client = new PostgresClient({
    connectionString: process.env.TEST_DATABASE_URL
  });
  const runRepository = new AnalysisRunRepository(client);
  const planRepository = new ExecutionPlanRepository(client);

  beforeAll(async () => {
    await runMigrations(client);
  });

  beforeEach(async () => {
    await client.query("TRUNCATE execution_audit_events, execution_attempts, execution_plan_actions, execution_plans, analysis_runs RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await client.close();
  });

  it("applies migrations idempotently", async () => {
    await expect(runMigrations(client)).resolves.toEqual([]);
  });

  it("persists runs and plan read models durably", async () => {
    const run = createRun("integration-run");
    await runRepository.upsertRun(run);

    const summary = createAnalysisRunSummary(run);
    const listed = await runRepository.listRuns();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject(summary);

    await planRepository.savePlan({
      actions: [createAction()],
      actorUserId: "usr_authenticated",
      analysisRunId: run.id,
      approval: {
        confirmationText: "I approve this GitHub write-back plan.",
        required: true
      },
      createdAt: "2026-04-12T10:02:00.000Z",
      expiresAt: "2026-04-12T10:17:00.000Z",
      planHash: "sha256:test-plan",
      planId: "plan_integration",
      repository: {
        defaultBranch: run.analysis.repository.defaultBranch,
        fullName: run.analysis.repository.fullName,
        owner: run.analysis.repository.owner,
        repo: run.analysis.repository.repo
      },
      selectedIssueCandidateIds: ["issue:one"],
      selectedPRCandidateIds: [],
      summary: {
        approvalRequiredActions: 1,
        blockedActions: 0,
        eligibleActions: 1,
        issueSelections: 1,
        prSelections: 0,
        skippedActions: 0,
        totalActions: 1,
        totalSelections: 1
      }
    });

    const detail = await planRepository.getPlanDetail("plan_integration");
    const events = await planRepository.getPlanEvents("plan_integration");

    expect(detail).toMatchObject({
      analysisRunId: run.id,
      planId: "plan_integration",
      status: "planned"
    });
    expect(events.events).toEqual([
      expect.objectContaining({
        eventType: "plan_created",
        planId: "plan_integration"
      })
    ]);
  });
});
