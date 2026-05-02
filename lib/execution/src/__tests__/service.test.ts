import { describe, expect, it, vi } from "vitest";
import type {
  CodeReviewFinding,
  DependencyFinding,
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
    id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
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

function dependencyFinding(
  overrides: Partial<DependencyFinding> = {}
): DependencyFinding {
  return {
    advisoryId: "GHSA-test-1234",
    advisorySource: "OSV",
    affectedRange: "introduced 0, fixed 2.0.0",
    candidateIssue: true,
    candidatePr: true,
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
    recommendedAction: "Upgrade react to 2.0.0 and refresh the lockfile.",
    referenceUrls: ["https://osv.dev/vulnerability/GHSA-test-1234"],
    remediationType: "upgrade",
    remediationVersion: "2.0.0",
    reachability: { band: "unknown", referencedPaths: [], score: 0, signals: [] },
    severity: "high",
    sourceType: "dependency",
    summary: "react is affected by a dependency advisory.",
    title: "react is affected by GHSA-test-1234",
    ...overrides
  };
}

function dependencyIssueCandidate(
  overrides: Partial<IssueCandidate> = {}
): IssueCandidate {
  return {
    acceptanceCriteria: [
      "Upgrade react to the remediated version.",
      "Refresh the root package-lock.json entries for react.",
      "Re-run the affected validation commands."
    ],
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    id: "issue:dependency-upgrade:react",
    labels: ["dependencies", "security", "high"],
    relatedFindingIds: ["dependency:react:1"],
    scope: "package",
    severity: "high",
    suggestedBody: "Upgrade react to the remediated version.",
    summary: "react should be upgraded to the remediated version.",
    title: "Upgrade react",
    whyItMatters: "The repository directly depends on a vulnerable version of react.",
    ...overrides
  };
}

function dependencyPRCandidate(
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
    labels: ["candidate-pr", "dependencies", "security", "high"],
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    rationale: "The change is bounded to one direct dependency and two root files.",
    readiness: "ready",
    relatedFindingIds: ["dependency:react:1"],
    riskLevel: "low",
    rollbackNote: "Restore the previous react version entries if the upgrade regresses.",
    severity: "high",
    summary: "Upgrade react and refresh the root npm dependency files.",
    testPlan: [
      "Install dependencies for the root workspace.",
      "Run the repository validation commands that cover react usage."
    ],
    title: "Upgrade react and refresh dependency locks",
    ...overrides
  };
}

function dependencyPatchPlan(
  overrides: Partial<PRPatchPlan> = {}
): PRPatchPlan {
  return {
    affectedPackages: ["react"],
    affectedPaths: ["package-lock.json", "package.json"],
    candidateType: "dependency-upgrade",
    confidence: "high",
    id: "patch-plan:pr:dependency-upgrade:react",
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    patchPlan: {
      constraints: [
        "Keep the change scoped to root package.json and package-lock.json.",
        "Avoid unrelated dependency churn."
      ],
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
      patchStrategy:
        "Update the direct dependency declaration and replace only the matching root lockfile entries.",
      requiredHumanReview: [
        "Confirm the resolved lock metadata matches the intended react release."
      ],
      requiredValidationSteps: [
        "Install dependencies for the root workspace.",
        "Run the repository validation commands that cover react usage."
      ]
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
    codeReviewFindings: [workflowFinding()],
    dependencyFindings: [],
    issueCandidates: [workflowIssueCandidate()],
    prCandidates: [workflowPRCandidate()],
    prPatchPlans: [workflowPatchPlan()],
    repository,
    ...overrides
  };
}

function dependencyAnalysisContext(
  overrides: Partial<ExecutionPlanningContext> = {}
): ExecutionPlanningContext {
  return {
    codeReviewFindings: [],
    dependencyFindings: [dependencyFinding()],
    issueCandidates: [dependencyIssueCandidate()],
    prCandidates: [dependencyPRCandidate()],
    prPatchPlans: [dependencyPatchPlan()],
    repository,
    ...overrides
  };
}

function createPackageJsonContent(specifier = "^1.0.0"): string {
  return `${JSON.stringify(
    {
      dependencies: {
        react: specifier
      }
    },
    null,
    2
  )}\n`;
}

function createPackageLockContent(input?: {
  duplicateTargetEntry?: boolean;
  includeTopLevelDependency?: boolean;
  lockfileVersion?: number;
  rootDependencySpecifier?: string;
  targetVersion?: string;
}): string {
  const targetVersion = input?.targetVersion ?? "2.0.0";
  const packages: Record<string, unknown> = {
    "": {
      dependencies: {
        react: input?.rootDependencySpecifier ?? "^1.0.0"
      }
    },
    "node_modules/react": {
      name: "react",
      version: "1.0.0",
      resolved: "https://registry.npmjs.org/react/-/react-1.0.0.tgz",
      integrity: "sha512-old"
    },
    "node_modules/other/node_modules/react": {
      name: "react",
      version: targetVersion,
      resolved: `https://registry.npmjs.org/react/-/react-${targetVersion}.tgz`,
      integrity: "sha512-new",
      dependencies: {
        "loose-envify": "^1.4.0"
      }
    }
  };

  if (input?.duplicateTargetEntry) {
    packages["node_modules/alternate/node_modules/react"] = {
      name: "react",
      version: targetVersion,
      resolved: `https://registry.npmjs.org/react/-/react-${targetVersion}.tgz`,
      integrity: "sha512-alt"
    };
  }

  const document: Record<string, unknown> = {
    lockfileVersion: input?.lockfileVersion ?? 3,
    name: "sample",
    packages
  };

  if (input?.includeTopLevelDependency !== false) {
    document.dependencies = {
      react: {
        version: "1.0.0",
        resolved: "https://registry.npmjs.org/react/-/react-1.0.0.tgz",
        integrity: "sha512-old"
      }
    };
  }

  return `${JSON.stringify(document, null, 2)}\n`;
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

  it("creates a branch, commits a workflow patch, and opens a pull request for explicit contents: write permissions", async () => {
    const fetchRepositoryFileText = vi.fn().mockResolvedValue([
      "name: CI",
      "on:",
      "  push:",
      "permissions:",
      "  contents: write",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest"
    ].join("\n"));
    const createBranchFromDefaultBranch = vi.fn().mockResolvedValue({
      baseCommitSha: "base-sha-contents",
      branchName: "repo-guardian/contents-write-branch"
    });
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/contents-write-branch",
      commitSha: "commit-sha-contents"
    });
    const openPullRequest = vi.fn().mockResolvedValue({
      pullRequestNumber: 23,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/23"
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
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/contents-write-branch",
        fileChanges: [
          expect.objectContaining({
            path: ".github/workflows/ci.yml",
            content: expect.stringContaining("contents: read")
          })
        ]
      })
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          branchName: "repo-guardian/contents-write-branch",
          commitSha: "base-sha-contents",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/contents-write-branch",
          commitSha: "commit-sha-contents",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/contents-write-branch",
          pullRequestNumber: 23,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/23",
          succeeded: true
        })
      ])
    );
  });

  it("creates a branch, commits a workflow patch, and opens a pull request for inline permissions: { contents: write }", async () => {
    const fetchRepositoryFileText = vi.fn().mockResolvedValue([
      "name: CI",
      "on:",
      "  push:",
      "permissions: { contents: write }",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest"
    ].join("\n"));
    const createBranchFromDefaultBranch = vi.fn().mockResolvedValue({
      baseCommitSha: "base-sha-inline",
      branchName: "repo-guardian/inline-contents-write-branch"
    });
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/inline-contents-write-branch",
      commitSha: "commit-sha-inline"
    });
    const openPullRequest = vi.fn().mockResolvedValue({
      pullRequestNumber: 24,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/24"
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
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/inline-contents-write-branch",
        fileChanges: [
          expect.objectContaining({
            path: ".github/workflows/ci.yml",
            content: expect.stringContaining("permissions: { contents: read }")
          })
        ]
      })
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          branchName: "repo-guardian/inline-contents-write-branch",
          commitSha: "base-sha-inline",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/inline-contents-write-branch",
          commitSha: "commit-sha-inline",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/inline-contents-write-branch",
          pullRequestNumber: 24,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/24",
          succeeded: true
        })
      ])
    );
  });

  it("creates a branch, commits a deterministic dependency patch, and opens a pull request for an approved npm dependency candidate", async () => {
    const fetchRepositoryFileText = vi
      .fn()
      .mockResolvedValueOnce(createPackageJsonContent("^1.0.0"))
      .mockResolvedValueOnce(createPackageLockContent());
    const createBranchFromDefaultBranch = vi.fn().mockResolvedValue({
      baseCommitSha: "base-sha",
      branchName: "repo-guardian/dependency-branch"
    });
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/dependency-branch",
      commitSha: "commit-sha"
    });
    const openPullRequest = vi.fn().mockResolvedValue({
      pullRequestNumber: 30,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/30"
    });

    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(fetchRepositoryFileText).toHaveBeenCalledTimes(2);
    expect(createBranchFromDefaultBranch).toHaveBeenCalledTimes(1);
    expect(commitFileChanges).toHaveBeenCalledTimes(1);
    expect(openPullRequest).toHaveBeenCalledTimes(1);
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/dependency-branch",
        commitMessage: "chore(deps): Upgrade react and refresh dependency locks",
        fileChanges: [
          expect.objectContaining({
            path: "package.json",
            content: expect.stringContaining('"react": "^2.0.0"')
          }),
          expect.objectContaining({
            path: "package-lock.json",
            content: expect.stringContaining('"version": "2.0.0"')
          })
        ]
      })
    );
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
          branchName: "repo-guardian/dependency-branch",
          commitSha: "base-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          blocked: false,
          branchName: "repo-guardian/dependency-branch",
          commitSha: "commit-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          blocked: false,
          branchName: "repo-guardian/dependency-branch",
          pullRequestNumber: 30,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/30",
          succeeded: true
        })
      ])
    );
  });

  it("creates a branch, commits a deterministic dependency patch, and opens a pull request for an approved npm dependency candidate with package-lock.json v2", async () => {
    const fetchRepositoryFileText = vi
      .fn()
      .mockResolvedValueOnce(createPackageJsonContent("^1.0.0"))
      .mockResolvedValueOnce(createPackageLockContent({ lockfileVersion: 2 }));
    const createBranchFromDefaultBranch = vi.fn().mockResolvedValue({
      baseCommitSha: "base-sha",
      branchName: "repo-guardian/dependency-branch-v2"
    });
    const commitFileChanges = vi.fn().mockResolvedValue({
      branchName: "repo-guardian/dependency-branch-v2",
      commitSha: "commit-sha-v2"
    });
    const openPullRequest = vi.fn().mockResolvedValue({
      pullRequestNumber: 31,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/31"
    });

    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(createBranchFromDefaultBranch).toHaveBeenCalledTimes(1);
    expect(commitFileChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        branchName: "repo-guardian/dependency-branch-v2",
        fileChanges: [
          expect.objectContaining({
            path: "package.json",
            content: expect.stringContaining('"react": "^2.0.0"')
          }),
          expect.objectContaining({
            path: "package-lock.json",
            content: expect.stringContaining('"lockfileVersion": 2')
          })
        ]
      })
    );
    expect(openPullRequest).toHaveBeenCalledTimes(1);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "create_branch",
          attempted: true,
          branchName: "repo-guardian/dependency-branch-v2",
          commitSha: "base-sha",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "commit_patch",
          attempted: true,
          branchName: "repo-guardian/dependency-branch-v2",
          commitSha: "commit-sha-v2",
          succeeded: true
        }),
        expect.objectContaining({
          actionType: "create_pr",
          attempted: true,
          branchName: "repo-guardian/dependency-branch-v2",
          pullRequestNumber: 31,
          pullRequestUrl: "https://github.com/openai/openai-node/pull/31",
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

  it("blocks patch_plan_only dependency PR execution", async () => {
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };

    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext({
          prPatchPlans: [
            dependencyPatchPlan({
              patchWarnings: [
                "Dependency lock refresh still needs human confirmation before write-back."
              ],
              patchability: "patch_plan_only",
              validationStatus: "ready_with_warnings"
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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

  it("blocks not_patchable dependency PR execution", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext({
          prPatchPlans: [
            dependencyPatchPlan({
              patchPlan: null,
              patchWarnings: ["The dependency update still needs manual lockfile regeneration."],
              patchability: "not_patchable",
              validationStatus: "blocked"
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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

  it("keeps dependency dry_run side-effect free", async () => {
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
        analysis: dependencyAnalysisContext(),
        approvalGranted: false,
        mode: "dry_run",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(writeClient.commitFileChanges).not.toHaveBeenCalled();
    expect(writeClient.openPullRequest).not.toHaveBeenCalled();
  });

  it("blocks dependency PR execution when approval is missing", async () => {
    const writeClient = {
      createBranchFromDefaultBranch: vi.fn(),
      commitFileChanges: vi.fn(),
      createIssue: vi.fn(),
      openPullRequest: vi.fn()
    };

    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext(),
        approvalGranted: false,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
      },
      {
        readClient: {
          fetchRepositoryFileText: vi.fn()
        },
        writeClient
      }
    );

    expect(result.status).toBe("blocked");
    expect(result.errors).toContain(
      "Execution is blocked because approvalGranted was not explicitly set to true."
    );
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
  });

  it("blocks dependency execution when the candidate does not target exactly the root npm files", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext({
          prCandidates: [
            dependencyPRCandidate({
              affectedPaths: ["apps/web/package-lock.json", "apps/web/package.json"]
            })
          ],
          prPatchPlans: [
            dependencyPatchPlan({
              affectedPaths: ["apps/web/package-lock.json", "apps/web/package.json"],
              patchPlan: {
                ...dependencyPatchPlan().patchPlan!,
                filesPlanned: [
                  {
                    changeType: "edit",
                    path: "apps/web/package-lock.json",
                    reason:
                      "Refresh the nested package-lock.json so react resolves to the remediated version."
                  },
                  {
                    changeType: "edit",
                    path: "apps/web/package.json",
                    reason: "Update the nested react dependency declaration."
                  }
                ]
              }
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          blocked: true,
          reason:
            "Deterministic dependency write-back currently supports only repo-root npm, Yarn (package.json/yarn.lock), Python (requirements.txt / pyproject.toml), Maven (pom.xml), Gradle (build.gradle/kts), Go (go.mod), Rust (Cargo.toml), Ruby (Gemfile), or Infra (Dockerfile) targets."
        })
      ])
    );
  });

  it("blocks dependency execution when the linked finding lacks a remediation version", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext({
          dependencyFindings: [
            dependencyFinding({
              remediationVersion: null
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          blocked: true,
          reason:
            "The linked dependency finding does not include a concrete remediation version."
        })
      ])
    );
  });

  it("blocks dependency execution when the linked finding is not direct", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext({
          dependencyFindings: [
            dependencyFinding({
              isDirect: false
            })
          ]
        }),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
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
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          blocked: true,
          reason:
            "Deterministic dependency write-back is limited to direct dependencies."
        })
      ])
    );
  });

  it("blocks dependency execution when the manifest specifier is not deterministic enough", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
      },
      {
        readClient: {
          fetchRepositoryFileText: vi
            .fn()
            .mockResolvedValueOnce(
              `${JSON.stringify(
                {
                  dependencies: {
                    react: "workspace:*"
                  }
                },
                null,
                2
              )}\n`
            )
            .mockResolvedValueOnce(createPackageLockContent())
        },
        writeClient: {
          createIssue: vi.fn(),
          createBranchFromDefaultBranch: vi.fn(),
          commitFileChanges: vi.fn(),
          openPullRequest: vi.fn()
        }
      }
    );

    expect(result.status).toBe("failed");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          attempted: true,
          blocked: false,
          errorMessage:
            "Deterministic dependency write-back supports only exact, ^, or ~ version specifiers for 2.0.0."
        }),
        expect.objectContaining({
          actionType: "create_branch",
          blocked: true,
          reason:
            "Patch synthesis failed: Deterministic dependency write-back supports only exact, ^, or ~ version specifiers for 2.0.0."
        })
      ])
    );
  });

  it("blocks dependency execution when lock metadata cannot be recovered uniquely", async () => {
    const result = await createExecutionPlanResult(
      {
        analysis: dependencyAnalysisContext(),
        approvalGranted: true,
        mode: "execute_approved",
        selectedIssueCandidateIds: [],
        selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
      },
      {
        readClient: {
          fetchRepositoryFileText: vi
            .fn()
            .mockResolvedValueOnce(createPackageJsonContent("^1.0.0"))
            .mockResolvedValueOnce(createPackageLockContent({ duplicateTargetEntry: true }))
        },
        writeClient: {
          createIssue: vi.fn(),
          createBranchFromDefaultBranch: vi.fn(),
          commitFileChanges: vi.fn(),
          openPullRequest: vi.fn()
        }
      }
    );

    expect(result.status).toBe("failed");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "prepare_patch",
          attempted: true,
          errorMessage:
            "Repo Guardian could not recover unique lockfile metadata for react@2.0.0."
        }),
        expect.objectContaining({
          actionType: "create_branch",
          blocked: true,
          reason:
            "Patch synthesis failed: Repo Guardian could not recover unique lockfile metadata for react@2.0.0."
        })
      ])
    );
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
    expect(writeClient.createIssue).not.toHaveBeenCalled();
    expect(writeClient.createBranchFromDefaultBranch).not.toHaveBeenCalled();
    expect(writeClient.commitFileChanges).not.toHaveBeenCalled();
    expect(writeClient.openPullRequest).not.toHaveBeenCalled();
  });
});
