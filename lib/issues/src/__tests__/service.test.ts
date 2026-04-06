import { describe, expect, it } from "vitest";
import type { CodeReviewFinding, DependencyFinding } from "@repo-guardian/shared-types";
import { createIssueCandidateResult } from "../service.js";

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
    id: "dependency:1",
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
    id: "review:1",
    lineSpans: [],
    paths: [".github/workflows/ci.yml"],
    recommendedAction: "Harden workflow.",
    severity: "high",
    sourceType: "workflow",
    summary: "workflow permissions issue",
    title: "workflow issue",
    ...overrides
  };
}

describe("createIssueCandidateResult", () => {
  it("groups related dependency findings for the same package into one candidate", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [
        dependencyFinding({ id: "dependency:1", advisoryId: "GHSA-a" }),
        dependencyFinding({ id: "dependency:2", advisoryId: "GHSA-b" })
      ]
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      candidateType: "dependency-upgrade",
      affectedPackages: ["react"],
      relatedFindingIds: ["dependency:1", "dependency:2"],
      scope: "package",
      title: "Upgrade react to address dependency advisories"
    });
  });

  it("groups related workflow findings in one workflow file into one candidate", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [
        codeFinding({
          id: "review:workflow:1",
          category: "workflow-permissions"
        }),
        codeFinding({
          id: "review:workflow:2",
          category: "workflow-trigger-risk"
        }),
        codeFinding({
          id: "review:workflow:3",
          category: "workflow-hardening",
          confidence: "medium",
          severity: "low"
        })
      ],
      dependencyFindings: []
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateType: "workflow-hardening",
        affectedPaths: [".github/workflows/ci.yml"],
        relatedFindingIds: [
          "review:workflow:1",
          "review:workflow:2",
          "review:workflow:3"
        ]
      })
    ]);
  });

  it("keeps unrelated finding families separate", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger",
          paths: ["src/server.ts"],
          sourceType: "code"
        }),
        codeFinding({
          category: "unsafe-shell-execution",
          id: "review:shell",
          paths: ["src/worker.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: []
    });

    expect(result.candidates.map((candidate) => candidate.candidateType)).toEqual([
      "dangerous-execution",
      "shell-execution"
    ]);
  });

  it("dedupes duplicate candidate groups and preserves traceability", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [],
      dependencyFindings: [
        dependencyFinding({ id: "dependency:1" }),
        dependencyFinding({ id: "dependency:1" })
      ]
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.relatedFindingIds).toEqual(["dependency:1"]);
  });

  it("skips weak standalone workflow hardening candidates", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "workflow-hardening",
          confidence: "medium",
          id: "review:weak",
          severity: "low"
        })
      ],
      dependencyFindings: []
    });

    expect(result.candidates).toEqual([]);
  });

  it("generates deterministic titles, summaries, and acceptance criteria", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "hardcoded-secret",
          id: "review:secret:1",
          paths: ["src/auth/token.ts"],
          sourceType: "code",
          title: "Possible hardcoded secret detected"
        })
      ],
      dependencyFindings: []
    });

    expect(result.candidates[0]).toMatchObject({
      acceptanceCriteria: expect.arrayContaining([
        expect.stringContaining("Move secret-like literals"),
        expect.stringContaining("Rotate any exposed credentials")
      ]),
      candidateType: "secret-remediation",
      summary: "A secret-like literal was found in src/auth/token.ts.",
      title: "Remediate hardcoded secret in src/auth/token.ts",
      whyItMatters: expect.stringContaining("Hardcoded credentials")
    });
    expect(result.candidates[0]?.suggestedBody).toContain("## Acceptance Criteria");
  });

  it("summarizes candidates by type and severity", () => {
    const result = createIssueCandidateResult({
      codeReviewFindings: [
        codeFinding({
          category: "dangerous-dynamic-execution",
          id: "review:danger",
          paths: ["src/server.ts"],
          sourceType: "code"
        })
      ],
      dependencyFindings: [dependencyFinding()]
    });

    expect(result.summary).toEqual({
      bySeverity: {
        critical: 0,
        high: 2,
        info: 0,
        low: 0,
        medium: 0
      },
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
