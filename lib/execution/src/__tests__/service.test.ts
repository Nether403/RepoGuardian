import { describe, expect, it } from "vitest";
import type {
  ExecutionPlanningContext,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan,
  RepositoryMetadata
} from "@repo-guardian/shared-types";
import { createExecutionPlanResult } from "../service.js";

const repository: RepositoryMetadata = {
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
};

function issueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: ["Upgrade react and refresh the lockfile."],
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
    summary: "react issue",
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

function prPatchPlan(
  overrides: Partial<PRPatchPlan> = {}
): PRPatchPlan {
  return {
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    patchPlan: {
      constraints: ["Keep changes bounded."],
      filesPlanned: [
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
      patchStrategy: "Update manifest and lockfile only.",
      requiredHumanReview: ["Confirm the upgrade path is compatible."],
      requiredValidationSteps: ["Install dependencies.", "Run tests."]
    },
    patchWarnings: [],
    patchability: "patch_candidate",
    prCandidateId: "pr:dependency-upgrade:react",
    readiness: "ready",
    relatedFindingIds: ["dependency:react:1"],
    riskLevel: "low",
    severity: "high",
    title: "Upgrade react and refresh dependency locks",
    validationNotes: ["Validation has not been executed in this step."],
    validationStatus: "ready",
    ...overrides
  };
}

function analysisContext(
  overrides: Partial<ExecutionPlanningContext> = {}
): ExecutionPlanningContext {
  return {
    issueCandidates: [issueCandidate()],
    prCandidates: [prCandidate()],
    prPatchPlans: [prPatchPlan()],
    repository,
    ...overrides
  };
}

describe("createExecutionPlanResult", () => {
  it("plans dry-run actions for selected issue candidates", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: []
    });

    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "create_issue",
        approvalRequired: true,
        approvalStatus: "required",
        eligibility: "eligible",
        targetId: "issue:dependency-upgrade:react"
      })
    ]);
  });

  it("plans dry-run actions for selected PR candidates with patch plans", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(result.actions.map((action) => action.actionType)).toEqual([
      "prepare_patch",
      "validate_patch",
      "create_pr"
    ]);
    expect(result.actions[2]).toMatchObject({
      actionType: "create_pr",
      approvalRequired: true,
      eligibility: "eligible"
    });
  });

  it("blocks non-patchable PR candidates", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext({
        prCandidates: [
          prCandidate({
            affectedPackages: [],
            affectedPaths: ["src/auth/token.ts"],
            candidateType: "secret-remediation",
            id: "pr:secret-remediation:src",
            linkedIssueCandidateIds: ["issue:secret-remediation:src"],
            relatedFindingIds: ["review:secret:1"],
            riskLevel: "high",
            title: "Remove hardcoded secret from src/auth/token.ts"
          })
        ],
        prPatchPlans: [
          prPatchPlan({
            affectedPackages: [],
            affectedPaths: ["src/auth/token.ts"],
            candidateType: "secret-remediation",
            patchPlan: null,
            patchability: "not_patchable",
            prCandidateId: "pr:secret-remediation:src",
            relatedFindingIds: ["review:secret:1"],
            riskLevel: "high",
            title: "Remove hardcoded secret from src/auth/token.ts",
            validationStatus: "blocked"
          })
        ]
      }),
      mode: "dry_run",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: ["pr:secret-remediation:src"]
    });

    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "skip",
        eligibility: "blocked",
        targetId: "pr:secret-remediation:src"
      })
    ]);
    expect(result.status).toBe("blocked");
  });

  it("blocks unknown selected IDs", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:missing"],
      selectedPRCandidateIds: ["pr:missing"]
    });

    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "skip",
        eligibility: "blocked",
        targetId: "issue:missing"
      }),
      expect.objectContaining({
        actionType: "skip",
        eligibility: "blocked",
        targetId: "pr:missing"
      })
    ]);
  });

  it("marks write-oriented actions as approval-required", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(
      result.actions
        .filter((action) => action.actionType === "create_issue" || action.actionType === "create_pr")
        .every((action) => action.approvalRequired && action.approvalStatus === "required")
    ).toBe(true);
    expect(result.approvalRequired).toBe(true);
  });

  it("returns a structured execution log/result", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(result).toMatchObject({
      mode: "dry_run",
      status: "planned",
      summary: {
        approvalRequiredActions: 2,
        eligibleActions: 4,
        issueSelections: 1,
        prSelections: 1,
        totalSelections: 2
      }
    });
    expect(typeof result.executionId).toBe("string");
    expect(typeof result.startedAt).toBe("string");
    expect(typeof result.completedAt).toBe("string");
  });

  it("blocks unsupported execute_approved mode with a structured result", () => {
    const result = createExecutionPlanResult({
      analysis: analysisContext(),
      mode: "execute_approved",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    expect(result.status).toBe("blocked");
    expect(result.errors).toEqual([
      "Execution mode execute_approved is not supported in Milestone 5A."
    ]);
    expect(result.actions.every((action) => action.eligibility === "blocked")).toBe(true);
  });
});
