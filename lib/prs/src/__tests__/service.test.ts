import { describe, expect, it } from "vitest";
import type {
  AnalysisWarning,
  CodeReviewFinding,
  DependencyFinding,
  DependencySnapshot,
  IssueCandidate,
  ReviewCoverage
} from "@repo-guardian/shared-types";
import { createPRCandidateResult } from "../service.js";

function dependencyFinding(
  overrides: Partial<DependencyFinding> = {}
): DependencyFinding {
  return {
    advisoryId: "GHSA-test-1234",
    advisorySource: "OSV",
    affectedRange: "introduced 0, fixed 2.0.0",
    candidateIssue: false,
    candidatePr: false,
    category: "dependency-vulnerability",
    confidence: "high",
    dependencyType: "production",
    evidence: [],
    id: "dependency:react:1",
    installedVersion: "1.0.0",
    isDirect: true,
    lineSpans: [],
    packageName: "react",
    paths: ["package-lock.json", "package.json"],
    recommendedAction: "Upgrade react.",
    referenceUrls: [],
    remediationType: "upgrade",
    remediationVersion: "2.0.0",
    severity: "high",
    sourceType: "dependency",
    summary: "react advisory",
    title: "react advisory",
    ...overrides
  };
}

function codeFinding(
  overrides: Partial<CodeReviewFinding> = {}
): CodeReviewFinding {
  return {
    candidateIssue: false,
    candidatePr: false,
    category: "workflow-permissions",
    confidence: "high",
    evidence: [],
    id: "review:workflow:1",
    lineSpans: [],
    paths: [".github/workflows/ci.yml"],
    recommendedAction: "Harden workflow.",
    severity: "high",
    sourceType: "workflow",
    summary: "workflow issue",
    title: "workflow issue",
    ...overrides
  };
}

function issueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: ["Do the thing."],
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    id: "issue:dependency-upgrade:react",
    labels: ["dependencies", "security"],
    relatedFindingIds: ["dependency:react:1"],
    scope: "package",
    severity: "high",
    suggestedBody: "body",
    summary: "react needs an upgrade",
    title: "Upgrade react",
    whyItMatters: "matters",
    ...overrides
  };
}

function dependencySnapshot(
  overrides: Partial<DependencySnapshot> = {}
): DependencySnapshot {
  return {
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
    },
    ...overrides
  };
}

function reviewCoverage(
  overrides: Partial<ReviewCoverage> = {}
): ReviewCoverage {
  return {
    candidateFileCount: 1,
    isPartial: true,
    reviewedFileCount: 1,
    selectedFileCount: 1,
    selectedPaths: [".github/workflows/ci.yml"],
    skippedFileCount: 0,
    skippedPaths: [],
    strategy: "targeted",
    ...overrides
  };
}

function warning(
  overrides: Partial<AnalysisWarning> = {}
): AnalysisWarning {
  return {
    code: "DECLARATION_ONLY_VERSION",
    message:
      "Declaration-only advisory coverage for react in package.json; no exact resolved version was available.",
    paths: ["package.json"],
    severity: "warning",
    source: "package.json",
    stage: "advisory",
    ...overrides
  };
}

describe("createPRCandidateResult", () => {
  it("creates a dependency-upgrade PR candidate from dependency findings", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [issueCandidate()],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: "dependency-upgrade",
        expectedFileChanges: [
          {
            changeType: "edit",
            path: "package-lock.json",
            reason:
              "Refresh package-lock.json so react resolves to the remediated version."
          },
          {
            changeType: "edit",
            path: "package.json",
            reason: "Update the react dependency declaration in package.json."
          }
        ],
        linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
        readiness: "ready",
        riskLevel: "low",
        title: "Upgrade react and refresh dependency locks"
      })
    ]);
  });

  it("creates a workflow-hardening PR candidate from workflow findings", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "workflow-permissions",
          id: "review:workflow:1"
        }),
        codeFinding({
          category: "workflow-trigger-risk",
          id: "review:workflow:2"
        })
      ],
      dependencyFindings: [],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          id: "issue:workflow-hardening:.github/workflows/ci.yml",
          relatedFindingIds: ["review:workflow:1", "review:workflow:2"],
          scope: "workflow-file",
          summary: "workflow",
          title: "workflow"
        })
      ],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: "workflow-hardening",
        expectedFileChanges: [
          {
            changeType: "edit",
            path: ".github/workflows/ci.yml",
            reason:
              "Tighten workflow permissions and adjust high-risk trigger behavior in the workflow definition."
          }
        ],
        readiness: "ready",
        riskLevel: "low",
        title: "Harden .github/workflows/ci.yml"
      })
    ]);
  });

  it("creates bounded execution PR candidates from execution findings", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger:1",
          paths: ["src/server.ts"],
          sourceType: "code"
        }),
        codeFinding({
          category: "unsafe-shell-execution",
          id: "review:shell:1",
          paths: ["src/runner.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/server.ts"],
          candidateType: "dangerous-execution",
          id: "issue:dangerous-execution:src/server.ts",
          relatedFindingIds: ["review:danger:1"],
          scope: "file",
          summary: "dangerous execution",
          title: "dangerous execution"
        }),
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/runner.ts"],
          candidateType: "shell-execution",
          id: "issue:shell-execution:src/runner.ts",
          relatedFindingIds: ["review:shell:1"],
          scope: "file",
          summary: "shell execution",
          title: "shell execution"
        })
      ],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates.map((candidate) => candidate.candidateType)).toEqual([
      "dangerous-execution",
      "shell-execution"
    ]);
    expect(result.candidates.every((candidate) => candidate.riskLevel === "medium")).toBe(true);
    expect(
      result.candidates.every((candidate) => candidate.readiness === "ready_with_warnings")
    ).toBe(true);
  });

  it("downgrades readiness when candidate-specific warnings reduce certainty", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [issueCandidate()],
      reviewCoverage: reviewCoverage(),
      warningDetails: [warning()]
    });

    expect(result.candidates[0]?.readiness).toBe("ready_with_warnings");
  });

  it("classifies secret remediation as high risk and draft only", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "hardcoded-secret",
          id: "review:secret:1",
          paths: ["src/auth/token.ts"],
          sourceType: "code",
          title: "Possible hardcoded secret detected"
        })
      ],
      dependencyFindings: [],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/auth/token.ts"],
          candidateType: "secret-remediation",
          id: "issue:secret-remediation:src",
          relatedFindingIds: ["review:secret:1"],
          scope: "file",
          summary: "secret",
          title: "secret"
        })
      ],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: "secret-remediation",
        readiness: "draft_only",
        riskLevel: "high"
      })
    ]);
  });

  it("links PR candidates back to issue candidates and findings", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [issueCandidate()],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates[0]).toMatchObject({
      linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      relatedFindingIds: ["dependency:react:1"]
    });
  });

  it("skips weak or unbounded issue candidates", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [
        dependencyFinding({
          id: "dependency:review:1",
          remediationType: "review"
        })
      ],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [
        issueCandidate({
          candidateType: "dependency-review",
          id: "issue:dependency-review:react",
          relatedFindingIds: ["dependency:review:1"]
        }),
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
          candidateType: "secret-remediation",
          id: "issue:secret-remediation:src",
          relatedFindingIds: ["dependency:review:1"],
          scope: "subsystem"
        })
      ],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.candidates).toEqual([]);
  });

  it("summarizes PR candidates by type, readiness, and risk", () => {
    const result = createPRCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger:1",
          paths: ["src/server.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [dependencyFinding()],
      dependencySnapshot: dependencySnapshot(),
      issueCandidates: [
        issueCandidate(),
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/server.ts"],
          candidateType: "dangerous-execution",
          id: "issue:dangerous-execution:src/server.ts",
          relatedFindingIds: ["review:danger:1"],
          scope: "file",
          summary: "dangerous execution",
          title: "dangerous execution"
        })
      ],
      reviewCoverage: reviewCoverage(),
      warningDetails: []
    });

    expect(result.summary).toEqual({
      byReadiness: [
        {
          count: 1,
          readiness: "ready"
        },
        {
          count: 1,
          readiness: "ready_with_warnings"
        }
      ],
      byRiskLevel: [
        {
          count: 1,
          riskLevel: "low"
        },
        {
          count: 1,
          riskLevel: "medium"
        }
      ],
      byType: [
        {
          candidateType: "dangerous-execution",
          count: 1
        },
        {
          candidateType: "dependency-upgrade",
          count: 1
        }
      ],
      totalCandidates: 2
    });
  });
});
