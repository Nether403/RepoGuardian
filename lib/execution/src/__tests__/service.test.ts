import { describe, expect, it, vi } from "vitest";
import type {
  CodeReviewFinding,
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

function workflowIssueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: [
      "Replace write-all with the minimum required permissions.",
      "Re-run the workflow after the hardening change."
    ],
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    id: "issue:workflow-hardening:.github/workflows/ci.yml",
    labels: ["security", "workflow", "high"],
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    scope: "workflow-file",
    severity: "high",
    suggestedBody: "Harden the CI workflow permissions.",
    summary: "The workflow permissions are broader than necessary.",
    title: "Harden workflow .github/workflows/ci.yml",
    whyItMatters: "Broad workflow permissions increase the blast radius of token misuse.",
    ...overrides
  };
}

function workflowPRCandidate(
  overrides: Partial<PRCandidate> = {}
): PRCandidate {
  return {
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    expectedFileChanges: [
      {
        changeType: "edit",
        path: ".github/workflows/ci.yml",
        reason: "Tighten workflow permissions in the existing workflow file."
      }
    ],
    id: "pr:workflow-hardening:.github/workflows/ci.yml",
    labels: ["candidate-pr", "security", "workflow", "high"],
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    rationale: "The hardening change stays inside one workflow file.",
    readiness: "ready",
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    riskLevel: "low",
    rollbackNote: "Restore the previous workflow permissions if legitimate jobs stop working.",
    severity: "high",
    summary: "Harden the CI workflow by reducing broad permissions.",
    testPlan: [
      "Run the workflow after the permissions change.",
      "Confirm privileged jobs still have the minimum access they need."
    ],
    title: "Harden .github/workflows/ci.yml",
    ...overrides
  };
}

function workflowPatchPlan(
  overrides: Partial<PRPatchPlan> = {}
): PRPatchPlan {
  return {
    affectedPackages: [],
    affectedPaths: [".github/workflows/ci.yml"],
    candidateType: "workflow-hardening",
    confidence: "high",
    linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
    patchPlan: {
      constraints: ["Keep the change inside one workflow file."],
      filesPlanned: [
        {
          changeType: "edit",
          path: ".github/workflows/ci.yml",
          reason: "Tighten workflow permissions in the existing workflow file."
        }
      ],
      patchStrategy:
        "Replace broad workflow permissions with a minimal explicit permissions block.",
      requiredHumanReview: ["Confirm the workflow still has the minimum permissions it needs."],
      requiredValidationSteps: [
        "Run the workflow after the permissions change.",
        "Confirm privileged jobs still have the minimum access they need."
      ]
    },
    patchWarnings: [],
    patchability: "patch_candidate",
    prCandidateId: "pr:workflow-hardening:.github/workflows/ci.yml",
    readiness: "ready",
    relatedFindingIds: ["review:workflow-permissions:.github/workflows/ci.yml:3-3"],
    riskLevel: "low",
    severity: "high",
    title: "Harden .github/workflows/ci.yml",
    validationNotes: ["Validation has not been executed in this step."],
    validationStatus: "ready",
    ...overrides
  };
}

function workflowFinding(
  overrides: Partial<CodeReviewFinding> = {}
): CodeReviewFinding {
  return {
    candidateIssue: true,
    candidatePr: true,
    category: "workflow-permissions",
    confidence: "high",
    evidence: [
      {
        label: "Matched line",
        value: "permissions: write-all"
      }
    ],
    id: "review:workflow-permissions:.github/workflows/ci.yml:3-3",
    lineSpans: [
      {
        endLine: 3,
        path: ".github/workflows/ci.yml",
        startLine: 3
      }
    ],
    paths: [".github/workflows/ci.yml"],
    recommendedAction: "Replace write-all with the minimum explicit permission set.",
    severity: "high",
    sourceType: "workflow",
    summary: "Broad workflow permissions increase token blast radius.",
    title: "Broad GitHub Actions permissions detected",
    ...overrides
  };
}

function analysisContext(
  overrides: Partial<ExecutionPlanningContext> = {}
): ExecutionPlanningContext {
  return {
    codeReviewFindings: [workflowFinding()],
    dependencyFindings: [],
    issueCandidates: [workflowIssueCandidate()],
    prCandidates: [workflowPRCandidate()],
    prPatchPlans: [workflowPatchPlan()],
    repository,
    ...overrides
  };
}

describe("createExecutionPlanResult", () => {
  it("creates approved issues and records remote issue metadata", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      issueNumber: 14,
      issueUrl: "https://github.com/openai/openai-node/issues/14"
    });

    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: []
      },
      {
        writeClient: {
          createIssue,
          createBranchFromDefaultBranch: vi.fn(),
          commitFileChanges: vi.fn(),
          openPullRequest: vi.fn()
        }
      }
    );

    expect(result.status).toBe("completed");
    expect(createIssue).toHaveBeenCalledTimes(1);
    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "create_issue",
        approvalStatus: "granted",
        attempted: true,
        blocked: false,
        issueNumber: 14,
        issueUrl: "https://github.com/openai/openai-node/issues/14",
        succeeded: true,
        targetId: "issue:workflow-hardening:.github/workflows/ci.yml"
      })
    ]);
  });

  it("blocks issue creation when approval is missing", async () => {
    const createIssue = vi.fn();

    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext(),
        approvalGranted: false,
        mode: "execute_approved",
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: []
      },
      {
        writeClient: {
          createIssue,
          createBranchFromDefaultBranch: vi.fn(),
          commitFileChanges: vi.fn(),
          openPullRequest: vi.fn()
        }
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.errors).toContain(
      "Execution is blocked because approvalGranted was not explicitly set to true."
    );
    expect(createIssue).not.toHaveBeenCalled();
    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "create_issue",
        approvalStatus: "denied",
        attempted: false,
        blocked: true,
        succeeded: false
      })
    ]);
  });

  it("creates a branch, commits a workflow patch, and opens a pull request for an approved patch-capable candidate", async () => {
    const fetchRepositoryFileText = vi
      .fn()
      .mockResolvedValue("name: CI\non:\n  push:\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n");
    const createBranchFromDefaultBranch = vi.fn().mockResolvedValue({
      baseCommitSha: "base-sha",
      branchName: "repo-guardian/test-branch"
    });
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/test-branch",
      commitSha: "commit-sha"
    });
    const openPullRequest = vi.fn().mockResolvedValue({
      pullRequestNumber: 22,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/22"
    });

    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      },
      {
        readClient: {
          fetchRepositoryFileText
        },
        writeClient: {
          createIssue: vi.fn(),
          createBranchFromDefaultBranch,
          commitFileChanges,
          openPullRequest
        }
      }
    );

    expect(result.status).toBe("completed");
    expect(fetchRepositoryFileText).toHaveBeenCalledTimes(1);
    expect(createBranchFromDefaultBranch).toHaveBeenCalledTimes(1);
    expect(commitFileChanges).toHaveBeenCalledTimes(1);
    expect(openPullRequest).toHaveBeenCalledTimes(1);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          attempted: true,
          blocked: false,
          branchName: expect.stringContaining("repo-guardian/"),
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          blocked: false,
          branchName: "repo-guardian/test-branch",
          commitSha: "base-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          blocked: false,
          branchName: "repo-guardian/test-branch",
          commitSha: "commit-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          blocked: false,
          branchName: "repo-guardian/test-branch",
          pullRequestNumber: 22,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/22",
          succeeded: true
        })
      ])
    );
  });

  it("blocks patch_plan_only PR execution", async () => {
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };

    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext({
          prPatchPlans: [
            workflowPatchPlan({
              patchWarnings: [
                "Workflow hardening still needs human confirmation before write-back."
              ],
              patchability: "patch_plan_only",
              validationStatus: "ready_with_warnings"
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      },
      {
        readClient: {
          fetchRepositoryFileText: vi.fn()
        },
        writeClient
      }
    );

    expect(result.status).toBe("blocked");
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: false,
          blocked: true,
          succeeded: false
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: false,
          blocked: true,
          succeeded: false
        })
      ])
    );
  });

  it("blocks not_patchable PR execution", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext({
          prPatchPlans: [
            workflowPatchPlan({
              patchPlan: null,
              patchWarnings: ["The workflow trigger change is not safe for automated patching."],
              patchability: "not_patchable",
              validationStatus: "blocked"
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      },
      {
        readClient: {
          fetchRepositoryFileText: vi.fn()
        },
        writeClient: {
          createIssue: vi.fn(),
          createBranchFromDefaultBranch: vi.fn(),
          commitFileChanges: vi.fn(),
          openPullRequest: vi.fn()
        }
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.actions).toEqual([
      expect.objectContaining({
        actionType: "skip",
        attempted: false,
        blocked: true,
        succeeded: false
      })
    ]);
  });

  it("keeps dry_run side-effect free", async () => {
    const readClient = {
      fetchRepositoryFileText: vi.fn()
    };
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };

    const result = await createExecutionPlanResult(
      {
        analysis: analysisContext(),
        approvalGranted: false,
        mode: "dry_run",
        selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
      },
      {
        readClient,
        writeClient
      }
    );

    expect(result.status).toBe("planned");
    expect(
      result.actions.every(
        (action) => action.attempted === false && action.succeeded === false
      )
    ).toBe(true);
    expect(readClient.fetchRepositoryFileText).not.toHaveBeenCalled();
    expect(writeClient.createIssue).not.toHaveBeenCalled();
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(writeClient.commitFileChanges).not.toHaveBeenCalled();
    expect(writeClient.openPullRequest).not.toHaveBeenCalled();
  });
});
