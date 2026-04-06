import { describe, expect, it } from "vitest";
import { AnalyzeRepoResponseSchema } from "../analyze.js";

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
});
