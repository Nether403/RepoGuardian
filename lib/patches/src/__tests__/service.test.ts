import { describe, expect, it } from "vitest";
import type {
  AnalysisWarning,
  CodeReviewFinding,
  DependencyFinding,
  IssueCandidate,
  PRCandidate
} from "@repo-guardian/shared-types";
import { createPRPatchPlanResult } from "../service.js";

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

function prCandidate(
  overrides: Partial<PRCandidate> = {}
): PRCandidate {
  return {
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
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
    id: "pr:dependency-upgrade:react",
    labels: ["candidate-pr", "dependencies", "high", "security"],
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    rationale: "bounded",
    readiness: "ready",
    relatedFindingIds: ["dependency:react:1"],
    riskLevel: "low",
    rollbackNote: "rollback",
    severity: "high",
    summary: "summary",
    testPlan: ["Install dependencies.", "Run tests."],
    title: "Upgrade react and refresh dependency locks",
    ...overrides
  };
}

function warning(
  overrides: Partial<AnalysisWarning> = {}
): AnalysisWarning {
  return {
    code: "TREE_TRUNCATED",
    message: "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
    paths: [],
    severity: "warning",
    source: "github-tree",
    stage: "intake",
    ...overrides
  };
}

describe("createPRPatchPlanResult", () => {
  it("marks dependency-upgrade candidates as patch candidates", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      issueCandidates: [issueCandidate()],
      prCandidates: [prCandidate()],
      warningDetails: []
    });

    expect(result.plans).toEqual([
      expect.objectContaining({
        patchability: "patch_candidate",
        prCandidateId: "pr:dependency-upgrade:react",
        validationStatus: "ready"
      })
    ]);
  });

  it("marks workflow-hardening candidates as patch candidates", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [
        codeFinding({
          category: "workflow-permissions",
          id: "review:workflow:1"
        })
      ],
      dependencyFindings: [],
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          id: "issue:workflow-hardening:.github/workflows/ci.yml",
          relatedFindingIds: ["review:workflow:1"],
          scope: "workflow-file"
        })
      ],
      prCandidates: [
        prCandidate({
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          expectedFileChanges: [
            {
              changeType: "edit",
              path: ".github/workflows/ci.yml",
              reason:
                "Tighten workflow permissions and adjust high-risk trigger behavior in the workflow definition."
            }
          ],
          id: "pr:workflow-hardening:.github/workflows/ci.yml",
          linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
          relatedFindingIds: ["review:workflow:1"],
          title: "Harden .github/workflows/ci.yml"
        })
      ],
      warningDetails: []
    });

    expect(result.plans).toEqual([
      expect.objectContaining({
        patchability: "patch_candidate",
        validationStatus: "ready"
      })
    ]);
  });

  it("keeps secret remediation non-patchable", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [
        codeFinding({
          category: "hardcoded-secret",
          id: "review:secret:1",
          paths: ["src/auth/token.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [],
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/auth/token.ts"],
          candidateType: "secret-remediation",
          id: "issue:secret-remediation:src",
          relatedFindingIds: ["review:secret:1"],
          scope: "file"
        })
      ],
      prCandidates: [
        prCandidate({
          affectedPackages: [],
          affectedPaths: ["src/auth/token.ts"],
          candidateType: "secret-remediation",
          expectedFileChanges: [
            {
              changeType: "edit",
              path: "src/auth/token.ts",
              reason:
                "Remove the tracked secret-like literal and switch the code path to a runtime secret source."
            }
          ],
          id: "pr:secret-remediation:issue:secret-remediation:src",
          linkedIssueCandidateIds: ["issue:secret-remediation:src"],
          readiness: "draft_only",
          relatedFindingIds: ["review:secret:1"],
          riskLevel: "high",
          title: "Remove hardcoded secret from src/auth/token.ts"
        })
      ],
      warningDetails: []
    });

    expect(result.plans).toEqual([
      expect.objectContaining({
        patchPlan: null,
        patchability: "not_patchable",
        validationStatus: "blocked"
      })
    ]);
  });

  it("downgrades validation status when warnings reduce confidence", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      issueCandidates: [issueCandidate()],
      prCandidates: [prCandidate()],
      warningDetails: [warning()]
    });

    expect(result.plans[0]).toMatchObject({
      patchability: "patch_candidate",
      validationStatus: "ready_with_warnings"
    });
  });

  it("uses expected file changes as the patch plan file targeting", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      issueCandidates: [issueCandidate()],
      prCandidates: [prCandidate()],
      warningDetails: []
    });

    expect(result.plans[0]?.patchPlan?.filesPlanned).toEqual([
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
    ]);
  });

  it("keeps weak or broad candidates out of patch-candidate status", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger:1",
          paths: ["src/a.ts", "src/b.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [],
      issueCandidates: [
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/a.ts", "src/b.ts"],
          candidateType: "dangerous-execution",
          id: "issue:dangerous-execution:src",
          relatedFindingIds: ["review:danger:1"],
          scope: "subsystem"
        })
      ],
      prCandidates: [
        prCandidate({
          affectedPackages: [],
          affectedPaths: ["src/a.ts", "src/b.ts"],
          candidateType: "dangerous-execution",
          confidence: "low",
          expectedFileChanges: [
            {
              changeType: "edit",
              path: "src/a.ts",
              reason: "Replace dynamic evaluation with a safer explicit implementation."
            }
          ],
          id: "pr:dangerous-execution:src",
          linkedIssueCandidateIds: ["issue:dangerous-execution:src"],
          readiness: "draft_only",
          relatedFindingIds: ["review:danger:1"],
          riskLevel: "medium",
          title: "Remove dangerous dynamic execution"
        })
      ],
      warningDetails: []
    });

    expect(result.plans[0]).toMatchObject({
      patchability: "not_patchable",
      validationStatus: "blocked"
    });
  });

  it("preserves traceability back to PR candidates, issue candidates, and findings", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [],
      dependencyFindings: [dependencyFinding()],
      issueCandidates: [issueCandidate()],
      prCandidates: [prCandidate()],
      warningDetails: []
    });

    expect(result.plans[0]).toMatchObject({
      linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      prCandidateId: "pr:dependency-upgrade:react",
      relatedFindingIds: ["dependency:react:1"]
    });
  });

  it("summarizes patch plans by patchability and validation status", () => {
    const result = createPRPatchPlanResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger:1",
          paths: ["src/server.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [dependencyFinding()],
      issueCandidates: [
        issueCandidate(),
        issueCandidate({
          affectedPackages: [],
          affectedPaths: ["src/server.ts"],
          candidateType: "dangerous-execution",
          id: "issue:dangerous-execution:src/server.ts",
          relatedFindingIds: ["review:danger:1"],
          scope: "file"
        })
      ],
      prCandidates: [
        prCandidate(),
        prCandidate({
          affectedPackages: [],
          affectedPaths: ["src/server.ts"],
          candidateType: "dangerous-execution",
          expectedFileChanges: [
            {
              changeType: "edit",
              path: "src/server.ts",
              reason:
                "Replace dynamic evaluation with a safer explicit implementation."
            }
          ],
          id: "pr:dangerous-execution:src/server.ts",
          linkedIssueCandidateIds: ["issue:dangerous-execution:src/server.ts"],
          readiness: "ready_with_warnings",
          relatedFindingIds: ["review:danger:1"],
          riskLevel: "medium",
          title: "Remove dangerous dynamic execution in src/server.ts"
        })
      ],
      warningDetails: []
    });

    expect(result.summary).toEqual({
      byPatchability: [
        {
          count: 1,
          patchability: "patch_candidate"
        },
        {
          count: 1,
          patchability: "patch_plan_only"
        }
      ],
      byValidationStatus: [
        {
          count: 1,
          validationStatus: "ready"
        },
        {
          count: 1,
          validationStatus: "not_run"
        }
      ],
      totalPatchCandidates: 1,
      totalPlans: 2
    });
  });
});
