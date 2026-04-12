import { describe, expect, it, vi } from "vitest";
import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import type { GitHubReadClient } from "@repo-guardian/github";
import { AnalysisJobProcessor } from "../analysis-job-processor.js";

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

describe("AnalysisJobProcessor", () => {
  it("processes an enqueued ad hoc analysis job outside the request path", async () => {
    const queuedJob = {
      attemptCount: 0,
      completedAt: null,
      errorMessage: null,
      failedAt: null,
      jobId: "job_async",
      jobKind: "analyze_repository" as const,
      label: "Async",
      maxAttempts: 1,
      queuedAt: "2026-04-12T10:00:00.000Z",
      repoInput: "openai/openai-node",
      repositoryFullName: "openai/openai-node",
      requestedByUserId: "usr_authenticated",
      runId: null,
      startedAt: null,
      status: "queued" as const,
      trackedRepositoryId: null,
      updatedAt: "2026-04-12T10:00:00.000Z"
    };
    const runningJob = {
      ...queuedJob,
      attemptCount: 1,
      startedAt: "2026-04-12T10:00:01.000Z",
      status: "running" as const,
      updatedAt: "2026-04-12T10:00:01.000Z"
    };
    const analysisJobRepository = {
      claimNextQueuedJob: vi
        .fn()
        .mockResolvedValueOnce(runningJob)
        .mockResolvedValueOnce(null),
      completeJob: vi.fn().mockResolvedValue(undefined),
      enqueueJob: vi.fn().mockResolvedValue(queuedJob),
      failJob: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn()
    };
    const analyzeRepository = vi.fn().mockResolvedValue(createAnalysis());
    const runRepository = {
      saveRun: vi.fn().mockResolvedValue({
        run: {
          analysis: createAnalysis(),
          createdAt: "2026-04-12T10:00:02.000Z",
          id: "run_async",
          label: "Async"
        },
        summary: {
          blockedPatchPlans: 0,
          createdAt: "2026-04-12T10:00:02.000Z",
          defaultBranch: "main",
          executablePatchPlans: 0,
          fetchedAt: "2026-04-12T10:00:00.000Z",
          highSeverityFindings: 0,
          id: "run_async",
          issueCandidates: 0,
          label: "Async",
          prCandidates: 0,
          repositoryFullName: "openai/openai-node",
          totalFindings: 0
        }
      })
    };
    const trackedRepositoryRepository = {
      getRepository: vi.fn()
    };
    const processor = new AnalysisJobProcessor({
      analysisJobRepository,
      analyzeRepository,
      readClient: {
        fetchRepositoryFileText: vi.fn(),
        fetchRepositoryIntake: vi.fn()
      } as unknown as GitHubReadClient,
      runRepository,
      trackedRepositoryRepository
    });

    const response = await processor.enqueueAdHoc({
      label: "Async",
      repoInput: "openai/openai-node",
      requestedByUserId: "usr_authenticated"
    });

    expect(response).toEqual(queuedJob);
    expect(analysisJobRepository.enqueueJob).toHaveBeenCalledWith({
      label: "Async",
      repoInput: "openai/openai-node",
      repositoryFullName: "openai/openai-node",
      requestedByUserId: "usr_authenticated"
    });

    await vi.waitFor(() => {
      expect(analyzeRepository).toHaveBeenCalledWith(
        expect.any(Object),
        "openai/openai-node"
      );
      expect(runRepository.saveRun).toHaveBeenCalledTimes(1);
      expect(analysisJobRepository.completeJob).toHaveBeenCalledWith({
        jobId: "job_async",
        runId: "run_async"
      });
    });
  });
});
