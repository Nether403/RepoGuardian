import { describe, expect, it } from "vitest";
import {
  AnalyzeRepoResponseSchema,
  AnalysisWarningSchema,
  createAnalysisWarning,
  dedupeAnalysisWarnings,
  hasCoverageWarnings
} from "../analyze.js";

describe("analysis warning schemas", () => {
  it("accepts valid warning codes, stages, and severities", () => {
    const warning = AnalysisWarningSchema.parse({
      code: "TREE_TRUNCATED",
      message: "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
      paths: [],
      severity: "warning",
      source: "github-tree",
      stage: "intake"
    });

    expect(warning).toEqual({
      code: "TREE_TRUNCATED",
      message: "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
      paths: [],
      severity: "warning",
      source: "github-tree",
      stage: "intake"
    });
  });

  it("dedupes warnings semantically and derives coverage from codes", () => {
    const warnings = dedupeAnalysisWarnings([
      createAnalysisWarning({
        code: "MANIFEST_WITHOUT_LOCKFILE",
        message: "Manifest without lockfile: package.json",
        paths: ["package.json"],
        source: "package.json",
        stage: "detection"
      }),
      createAnalysisWarning({
        code: "MANIFEST_WITHOUT_LOCKFILE",
        message: "Manifest without lockfile: package.json",
        paths: ["package.json"],
        source: "package.json",
        stage: "detection"
      })
    ]);

    expect(warnings).toHaveLength(1);
    expect(hasCoverageWarnings(warnings)).toBe(true);
  });

  it("preserves distinct warning messages from the same file and stage", () => {
    const warnings = dedupeAnalysisWarnings([
      createAnalysisWarning({
        code: "FILE_PARSE_FAILED",
        message: "Skipped unsupported Gradle dependency declaration on line 12 in build.gradle.",
        paths: ["build.gradle"],
        source: "build.gradle",
        stage: "dependency-parse"
      }),
      createAnalysisWarning({
        code: "FILE_PARSE_FAILED",
        message:
          'Parsed Gradle dependency org.projectlombok:lombok with unresolved version placeholder "lombokVersion".',
        paths: ["build.gradle"],
        source: "build.gradle",
        stage: "dependency-parse"
      })
    ]);

    expect(warnings).toHaveLength(2);
    expect(warnings.map((warning) => warning.message)).toEqual(
      expect.arrayContaining([
        "Skipped unsupported Gradle dependency declaration on line 12 in build.gradle.",
        'Parsed Gradle dependency org.projectlombok:lombok with unresolved version placeholder "lombokVersion".'
      ])
    );
  });
});

describe("AnalyzeRepoResponseSchema", () => {
  it("remains backward compatible with string warning fields while adding structured details", () => {
    const response = AnalyzeRepoResponseSchema.parse({
      dependencyFindingSummary: {
        findingsBySeverity: {
          critical: 0,
          high: 0,
          info: 0,
          low: 0,
          medium: 0
        },
        isPartial: true,
        totalFindings: 0,
        vulnerableDirectCount: 0,
        vulnerableTransitiveCount: 0
      },
      dependencyFindings: [],
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
        totalPlans: 0
      },
      prPatchPlans: [],
      codeReviewFindingSummary: {
        findingsBySeverity: {
          critical: 0,
          high: 0,
          info: 0,
          low: 0,
          medium: 0
        },
        isPartial: true,
        reviewedFileCount: 0,
        totalFindings: 0
      },
      codeReviewFindings: [],
      dependencySnapshot: {
        dependencies: [],
        filesParsed: [],
        filesSkipped: [],
        isPartial: true,
        parseWarningDetails: [
          createAnalysisWarning({
            code: "FILE_FETCH_SKIPPED",
            message: "Skipped package-lock.json: GitHub returned invalid file content",
            paths: ["package-lock.json"],
            source: "package-lock.json",
            stage: "dependency-parse"
          })
        ],
        parseWarnings: ["Skipped package-lock.json: GitHub returned invalid file content"],
        summary: {
          byEcosystem: [],
          directDependencies: 0,
          parsedFileCount: 0,
          skippedFileCount: 1,
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
      isPartial: true,
      repository: {
        canonicalUrl: "https://github.com/openai/openai-node",
        defaultBranch: "main",
        description: "SDK repository",
        forks: 12,
        fullName: "openai/openai-node",
        htmlUrl: "https://github.com/openai/openai-node",
        owner: "openai",
        primaryLanguage: "TypeScript",
        repo: "openai-node",
        stars: 42
      },
      treeSummary: {
        samplePaths: ["package.json"],
        totalDirectories: 0,
        totalFiles: 1,
        truncated: true
      },
      reviewCoverage: {
        candidateFileCount: 0,
        isPartial: true,
        reviewedFileCount: 0,
        selectedFileCount: 0,
        selectedPaths: [],
        skippedFileCount: 0,
        skippedPaths: [],
        strategy: "targeted"
      },
      warningDetails: [
        createAnalysisWarning({
          code: "TREE_TRUNCATED",
          message: "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
          source: "github-tree",
          stage: "intake"
        })
      ],
      warnings: ["GitHub returned a truncated recursive tree; the repository snapshot is partial."]
    });

    expect(response.warningDetails[0]?.code).toBe("TREE_TRUNCATED");
    expect(response.warnings).toEqual([
      "GitHub returned a truncated recursive tree; the repository snapshot is partial."
    ]);
    expect(response.issueCandidates).toEqual([]);
    expect(response.issueCandidateSummary.totalCandidates).toBe(0);
    expect(response.prCandidates).toEqual([]);
    expect(response.prCandidateSummary.totalCandidates).toBe(0);
    expect(response.prPatchPlans).toEqual([]);
    expect(response.prPatchPlanSummary.totalPatchCandidates).toBe(0);
    expect(response.dependencySnapshot.parseWarningDetails[0]?.code).toBe("FILE_FETCH_SKIPPED");
    expect(response.dependencySnapshot.parseWarnings).toEqual([
      "Skipped package-lock.json: GitHub returned invalid file content"
    ]);
  });
});
