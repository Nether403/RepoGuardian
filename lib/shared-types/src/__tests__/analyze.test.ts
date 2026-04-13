import { describe, expect, it } from "vitest";
import {
  AnalyzeRepoResponseSchema,
  CompareAnalysisRunsResponseSchema,
  RepositoryActivityEventSchema,
  SavedAnalysisRunSummarySchema
} from "../analyze.js";

describe("analyze schemas", () => {
  it("accepts pr patch plans with write-back eligibility details", () => {
    const result = AnalyzeRepoResponseSchema.safeParse({
      codeReviewFindingSummary: {
        findingsBySeverity: {
          critical: 0,
          high: 0,
          info: 0,
          low: 0,
          medium: 0
        },
        isPartial: false,
        reviewedFileCount: 0,
        totalFindings: 0
      },
      codeReviewFindings: [],
      dependencyFindingSummary: {
        findingsBySeverity: {
          critical: 0,
          high: 0,
          info: 0,
          low: 0,
          medium: 0
        },
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
      fetchedAt: "2026-04-06T12:00:00.000Z",
      isPartial: false,
      issueCandidateSummary: {
        bySeverity: {
          critical: 0,
          high: 0,
          info: 0,
          low: 0,
          medium: 0
        },
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
        totalPlans: 1
      },
      prPatchPlans: [
        {
          affectedPackages: ["react"],
          affectedPaths: ["package-lock.json", "package.json"],
          candidateType: "dependency-upgrade",
          confidence: "high",
          id: "patch-plan:pr:dependency-upgrade:react",
          linkedIssueCandidateIds: [],
          patchPlan: null,
          patchWarnings: [],
          patchability: "patch_candidate",
          prCandidateId: "pr:dependency-upgrade:react",
          readiness: "ready",
          relatedFindingIds: [],
          riskLevel: "low",
          severity: "high",
          title: "Upgrade react",
          validationNotes: [],
          validationStatus: "ready",
          writeBackEligibility: {
            approvalRequired: true,
            details: [
              "Approval is still required before Repo Guardian performs any GitHub write-back."
            ],
            matchedPatterns: ["permissions: write-all"],
            status: "executable",
            summary: "Eligible for approved deterministic npm dependency write-back."
          }
        }
      ],
      repository: {
        canonicalUrl: "https://github.com/openai/openai-node",
        defaultBranch: "main",
        description: null,
        forks: 12,
        fullName: "openai/openai-node",
        htmlUrl: "https://github.com/openai/openai-node",
        owner: "openai",
        primaryLanguage: "TypeScript",
        repo: "openai-node",
        stars: 42
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
    });

    expect(result.success).toBe(true);
  });

  it("accepts saved-run summaries and compare responses", () => {
    const baseRun = SavedAnalysisRunSummarySchema.parse({
      blockedPatchPlans: 1,
      createdAt: "2026-04-08T00:00:00.000Z",
      defaultBranch: "main",
      executablePatchPlans: 0,
      fetchedAt: "2026-04-08T00:00:00.000Z",
      highSeverityFindings: 1,
      id: "run-baseline",
      issueCandidates: 1,
      label: "Baseline",
      prCandidates: 1,
      repositoryFullName: "openai/openai-node",
      totalFindings: 1
    });
    const targetRun = SavedAnalysisRunSummarySchema.parse({
      ...baseRun,
      blockedPatchPlans: 0,
      createdAt: "2026-04-08T00:10:00.000Z",
      executablePatchPlans: 1,
      fetchedAt: "2026-04-08T00:10:00.000Z",
      id: "run-latest",
      label: "Latest",
      totalFindings: 2
    });

    const result = CompareAnalysisRunsResponseSchema.safeParse({
      baseRun,
      candidates: {
        blockedPatchPlans: {
          base: 1,
          delta: -1,
          target: 0
        },
        executablePatchPlans: {
          base: 0,
          delta: 1,
          target: 1
        },
        issueCandidates: {
          base: 1,
          delta: 0,
          target: 1
        },
        prCandidates: {
          base: 1,
          delta: 0,
          target: 1
        }
      },
      findings: {
        bySeverity: {
          base: {
            critical: 0,
            high: 1,
            info: 0,
            low: 0,
            medium: 0
          },
          target: {
            critical: 0,
            high: 2,
            info: 0,
            low: 0,
            medium: 0
          }
        },
        newFindingIds: ["finding:new"],
        resolvedFindingIds: ["finding:old"],
        total: {
          base: 1,
          delta: 1,
          target: 2
        }
      },
      repository: {
        baseRepositoryFullName: "openai/openai-node",
        sameRepository: true,
        targetRepositoryFullName: "openai/openai-node"
      },
      structure: {
        ecosystems: {
          added: [],
          removed: [],
          unchanged: ["node"]
        },
        lockfiles: {
          added: [],
          removed: [],
          unchanged: ["package-lock.json"]
        },
        manifests: {
          added: ["packages/app/package.json"],
          removed: [],
          unchanged: ["package.json"]
        }
      },
      targetRun
    });

    expect(result.success).toBe(true);
  });

  it("accepts typed repository activity detail variants and generic fallbacks", () => {
    const executionEvent = RepositoryActivityEventSchema.safeParse({
      actionId: "action_one",
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
        previousStatus: "executing",
        rawPayload: {
          phase: "finalize"
        },
        relatedActionId: "action_one",
        relatedExecutionId: "exec_one",
        relatedJobId: null,
        relatedPlanId: "plan_one",
        relatedRunId: null,
        relatedTrackedPullRequestId: null,
        succeeded: true,
        warnings: []
      },
      executionEventId: "event_one",
      executionId: "exec_one",
      jobId: null,
      kind: "execution_event",
      occurredAt: "2026-04-12T10:08:00.000Z",
      planId: "plan_one",
      pullRequestUrl: null,
      repositoryFullName: "openai/openai-node",
      runId: null,
      status: "execution_completed",
      summary: "Action action_one",
      title: "Execution Completed",
      trackedPullRequestId: null
    });

    const trackedPullRequest = RepositoryActivityEventSchema.safeParse({
      actionId: null,
      activityId: "pull-request:tpr_one",
      detail: {
        actorUserId: null,
        blockedPatchPlanCount: null,
        branchName: "repo-guardian/test-branch",
        candidateSelectionCount: null,
        closedAt: null,
        detailType: "tracked_pull_request",
        executablePatchPlanCount: null,
        findingCount: null,
        jobKind: null,
        label: "Harden workflow permissions",
        lifecycleStatus: "open",
        mergedAt: null,
        pullRequestNumber: 19,
        pullRequestTitle: "Harden workflow permissions",
        pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
        relatedActionId: null,
        relatedExecutionId: "exec_one",
        relatedJobId: null,
        relatedPlanId: "plan_one",
        relatedRunId: null,
        relatedTrackedPullRequestId: "tpr_one"
      },
      executionEventId: null,
      executionId: "exec_one",
      jobId: null,
      kind: "tracked_pull_request",
      occurredAt: "2026-04-12T10:08:30.000Z",
      planId: "plan_one",
      pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
      repositoryFullName: "openai/openai-node",
      runId: null,
      status: "open",
      summary: "repo-guardian/test-branch",
      title: "#19 Harden workflow permissions",
      trackedPullRequestId: "tpr_one"
    });

    const fallback = RepositoryActivityEventSchema.safeParse({
      actionId: null,
      activityId: "job:job_one",
      detail: {
        actorUserId: null,
        blockedPatchPlanCount: null,
        branchName: null,
        candidateSelectionCount: null,
        detailType: "generic",
        executablePatchPlanCount: null,
        findingCount: null,
        jobKind: "analyze_repository",
        label: "Nightly queue",
        lifecycleStatus: null,
        rawEventType: null,
        rawPayload: {
          queue: "nightly"
        },
        relatedActionId: null,
        relatedExecutionId: null,
        relatedJobId: "job_one",
        relatedPlanId: null,
        relatedRunId: "run_one",
        relatedTrackedPullRequestId: null
      },
      executionEventId: null,
      executionId: null,
      jobId: "job_one",
      kind: "analysis_job",
      occurredAt: "2026-04-12T10:04:00.000Z",
      planId: null,
      pullRequestUrl: null,
      repositoryFullName: "openai/openai-node",
      runId: "run_one",
      status: "completed",
      summary: "analyze_repository",
      title: "Nightly queue",
      trackedPullRequestId: null
    });

    const analysisJob = RepositoryActivityEventSchema.safeParse({
      actionId: null,
      activityId: "job:job_one",
      detail: {
        actorUserId: null,
        attemptCount: 1,
        blockedPatchPlanCount: null,
        branchName: null,
        candidateSelectionCount: null,
        detailType: "analysis_job",
        executablePatchPlanCount: null,
        findingCount: null,
        jobKind: "analyze_repository",
        label: "Nightly queue",
        lifecycleStatus: null,
        maxAttempts: 3,
        queueStage: "finished",
        relatedActionId: null,
        relatedExecutionId: null,
        relatedJobId: "job_one",
        relatedPlanId: null,
        relatedRunId: "run_one",
        relatedTrackedPullRequestId: null
      },
      executionEventId: null,
      executionId: null,
      jobId: "job_one",
      kind: "analysis_job",
      occurredAt: "2026-04-12T10:04:00.000Z",
      planId: null,
      pullRequestUrl: null,
      repositoryFullName: "openai/openai-node",
      runId: "run_one",
      status: "completed",
      summary: "analyze_repository",
      title: "Nightly queue",
      trackedPullRequestId: null
    });

    const analysisRun = RepositoryActivityEventSchema.safeParse({
      actionId: null,
      activityId: "run:run_one",
      detail: {
        actorUserId: null,
        blockedPatchPlanCount: 1,
        branchName: "main",
        candidateSelectionCount: null,
        defaultBranch: "main",
        detailType: "analysis_run",
        executablePatchPlanCount: 4,
        findingCount: 3,
        jobKind: null,
        label: "Weekly review",
        lifecycleStatus: null,
        relatedActionId: null,
        relatedExecutionId: null,
        relatedJobId: null,
        relatedPlanId: null,
        relatedRunId: "run_one",
        relatedTrackedPullRequestId: null,
        totalPatchPlans: 5
      },
      executionEventId: null,
      executionId: null,
      jobId: null,
      kind: "analysis_run",
      occurredAt: "2026-04-12T10:02:00.000Z",
      planId: null,
      pullRequestUrl: null,
      repositoryFullName: "openai/openai-node",
      runId: "run_one",
      status: "snapshot_saved",
      summary: "3 findings, 4 executable patch plans",
      title: "Weekly review",
      trackedPullRequestId: null
    });

    expect(executionEvent.success).toBe(true);
    expect(trackedPullRequest.success).toBe(true);
    expect(fallback.success).toBe(true);
    expect(analysisJob.success).toBe(true);
    expect(analysisRun.success).toBe(true);
  });
});
