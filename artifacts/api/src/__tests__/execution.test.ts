import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  ExecutionResultSchema,
  type CodeReviewFinding,
  type ExecutionPlanningContext,
  type IssueCandidate,
  type PRCandidate,
  type PRPatchPlan
} from "@repo-guardian/shared-types";
import { createExecutionRouter } from "../routes/execution.js";

function createIssueCandidate(
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

function createPRCandidate(
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

function createPRPatchPlan(
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

function createWorkflowFinding(
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

function createAnalysisContext(
  overrides: Partial<ExecutionPlanningContext> = {}
): ExecutionPlanningContext {
  return {
    codeReviewFindings: [createWorkflowFinding()],
    dependencyFindings: [],
    issueCandidates: [createIssueCandidate()],
    prCandidates: [createPRCandidate()],
    prPatchPlans: [createPRPatchPlan()],
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
    ...overrides
  };
}

function createTestApp(dependencies: Parameters<typeof createExecutionRouter>[0]) {
  const app = express();

  app.use(express.json());
  app.use("/api", createExecutionRouter(dependencies));

  return app;
}

describe("POST /api/execution/plan", () => {
  it("returns a dry-run plan without side effects", async () => {
    const readClient = {
      fetchRepositoryFileText: vi.fn()
    };
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };
    const app = createTestApp({
      readClient,
      writeClient
    });

    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      approvalGranted: false,
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "required",
      mode: "dry_run",
      status: "planned"
    });
    expect(readClient.fetchRepositoryFileText).not.toHaveBeenCalled();
    expect(writeClient.createIssue).not.toHaveBeenCalled();
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(writeClient.commitFileChanges).not.toHaveBeenCalled();
    expect(writeClient.openPullRequest).not.toHaveBeenCalled();
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved issue creation request", async () => {
    const app = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn().mockResolvedValue({
          issueNumber: 8,
          issueUrl: "https://github.com/openai/openai-node/issues/8"
        }),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      approvalGranted: true,
      mode: "execute_approved",
      selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
      selectedPRCandidateIds: []
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "granted",
      mode: "execute_approved",
      status: "completed"
    });
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_issue",
          attempted: true,
          blocked: false,
          issueNumber: 8,
          issueUrl: "https://github.com/openai/openai-node/issues/8",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("executes an approved workflow PR creation request", async () => {
    const app = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi
          .fn()
          .mockResolvedValue(
            "name: CI\non:\n  push:\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n"
          )
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn().mockResolvedValue({
          baseCommitSha: "base-sha",
          branchName: "repo-guardian/test-branch"
        }),
        commitFileChanges: vi.fn().mockResolvedValue({
          branchName: "repo-guardian/test-branch",
          commitSha: "commit-sha"
        }),
        openPullRequest: vi.fn().mockResolvedValue({
          pullRequestNumber: 19,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/19"
        })
      }
    });

    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      approvalGranted: true,
      mode: "execute_approved",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          commitSha: "base-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          commitSha: "commit-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/test-branch",
          pullRequestNumber: 19,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
          succeeded: true
        })
      ])
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns a blocked result when approval is missing", async () => {
    const app = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const response = await request(app).post("/api/execution/plan").send({
      analysis: createAnalysisContext(),
      approvalGranted: false,
      mode: "execute_approved",
      selectedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      approvalRequired: true,
      approvalStatus: "denied",
      mode: "execute_approved",
      status: "blocked"
    });
    expect(response.body.errors).toContain(
      "Execution is blocked because approvalGranted was not explicitly set to true."
    );
    expect(ExecutionResultSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns 400 for an invalid execution request", async () => {
    const app = createTestApp({
      readClient: {
        fetchRepositoryFileText: vi.fn()
      },
      writeClient: {
        createIssue: vi.fn(),
        createBranchFromDefaultBranch: vi.fn(),
        commitFileChanges: vi.fn(),
        openPullRequest: vi.fn()
      }
    });

    const response = await request(app).post("/api/execution/plan").send({
      mode: "dry_run",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: []
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Required"
    });
  });
});
