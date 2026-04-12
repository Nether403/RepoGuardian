import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AnalysisJobSchema,
  AnalyzeRepoResponseSchema,
  ExecutionResultSchema,
  ExecutionPlanResponseSchema,
  FleetStatusResponseSchema,
  ListAnalysisJobsResponseSchema,
  ListSweepSchedulesResponseSchema,
  ListTrackedRepositoriesResponseSchema,
  SweepScheduleSchema,
  TrackedRepositorySchema,
  type AnalyzeRepoResponse
} from "@repo-guardian/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    json: async () => body,
    ok,
    status
  } as Response;
}

function mockAuthenticatedFetch(inner: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = getFetchUrl(input);
    const headers = init?.headers;
    let authHeader: string | undefined | null;

    if (headers instanceof Headers) {
      authHeader = headers.get("Authorization");
    } else if (Array.isArray(headers)) {
      authHeader = headers.find(([k]) => k.toLowerCase() === "authorization")?.[1];
    } else {
      authHeader = (headers as Record<string, string>)?.["Authorization"];
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return createJsonResponse({ error: `Unauthorized (Test Mock) - Found: ${authHeader}` }, false, 401);
    }

    const testResponse = await inner(url, init);
    if (testResponse.status !== 500) {
      return testResponse;
    }

    // Default handlers for background noise and auto-saves if the test didn't handle it
    if (url === "/api/runs") {
      if (init?.method === "POST") {
        return createJsonResponse({
          summary: {
            id: "run-default",
            repositoryFullName: "openai/openai-node",
            defaultBranch: "main",
            fetchedAt: "2026-04-08T00:00:00.000Z",
            createdAt: "2026-04-08T00:00:00.000Z",
            totalFindings: 0,
            highSeverityFindings: 0,
            issueCandidates: 0,
            prCandidates: 0,
            executablePatchPlans: 0,
            blockedPatchPlans: 0,
            label: "Auto-saved"
          },
          run: {
            id: "run-default",
            analysis: successPayload,
            createdAt: "2026-04-08T00:00:00.000Z",
            label: "Auto-saved"
          }
        }, true, 201);
      }
      return createJsonResponse({ runs: [] });
    }

    return testResponse;
  });
}

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve
  };
}

async function submitRepository(
  _user: ReturnType<typeof userEvent.setup>,
  value = "openai/openai-node"
) {
  const input = screen.getByLabelText(/Repository input/i);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Analyze Repository/i }));
}

async function openFleetAdmin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /Fleet Admin/i }));
  await screen.findByText("Fleet admin ready");
}

function buildAnchorId(prefix: string, rawId: string): string {
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `${prefix}-${normalized || "item"}`;
}

function expectTraceabilityMapCounts(input: {
  findings: number;
  issueCandidates: number;
  patchPlans: number;
  prCandidates: number;
}) {
  const traceabilityMap = document.querySelector(
    '[aria-label="Traceability map summary"]'
  );

  expect(traceabilityMap).toHaveTextContent(
    new RegExp(`Patch plans\\s*${input.patchPlans}`, "u")
  );
  expect(traceabilityMap).toHaveTextContent(
    new RegExp(`PR candidates\\s*${input.prCandidates}`, "u")
  );
  expect(traceabilityMap).toHaveTextContent(
    new RegExp(`Issue candidates\\s*${input.issueCandidates}`, "u")
  );
  expect(traceabilityMap).toHaveTextContent(
    new RegExp(`Findings\\s*${input.findings}`, "u")
  );
}

function getPanelByHeading(name: RegExp | string): HTMLElement {
  const panel = screen.getByRole("heading", { name }).closest("section");

  expect(panel).not.toBeNull();

  return panel as HTMLElement;
}

const successPayload = AnalyzeRepoResponseSchema.parse({
  dependencyFindingSummary: {
    findingsBySeverity: {
      critical: 0,
      high: 1,
      info: 0,
      low: 0,
      medium: 0
    },
    isPartial: false,
    totalFindings: 1,
    vulnerableDirectCount: 1,
    vulnerableTransitiveCount: 0
  },
  dependencyFindings: [
    {
      advisoryId: "GHSA-test-1234",
      advisorySource: "OSV",
      affectedRange: "introduced 0, fixed 19.0.1",
      candidateIssue: false,
      candidatePr: false,
      category: "dependency-vulnerability",
      confidence: "high",
      dependencyType: "production",
      evidence: [
        {
          label: "Dependency",
          value: "react"
        }
      ],
      id: "dependency:GHSA-test-1234:react:19.0.0:.:direct",
      installedVersion: "19.0.0",
      isDirect: true,
      lineSpans: [],
      packageName: "react",
      paths: ["package-lock.json", "package.json"],
      recommendedAction:
        "Upgrade react to 19.0.1 or later and refresh the lockfile.",
      referenceUrls: ["https://osv.dev/vulnerability/GHSA-test-1234"],
      remediationType: "upgrade",
      remediationVersion: "19.0.1",
      severity: "high",
      sourceType: "dependency",
      summary: "react 19.0.0 matches GHSA-test-1234: React test advisory",
      title: "react is affected by GHSA-test-1234"
    }
  ],
  codeReviewFindingSummary: {
    findingsBySeverity: {
      critical: 0,
      high: 0,
      info: 0,
      low: 1,
      medium: 0
    },
    isPartial: true,
    reviewedFileCount: 1,
    totalFindings: 1
  },
  codeReviewFindings: [
    {
      candidateIssue: false,
      candidatePr: false,
      category: "workflow-hardening",
      confidence: "medium",
      evidence: [
        {
          label: "Workflow file",
          value: ".github/workflows/ci.yml"
        }
      ],
      id: "review:workflow-hardening:.github/workflows/ci.yml:file",
      lineSpans: [],
      paths: [".github/workflows/ci.yml"],
      recommendedAction:
        "Declare explicit top-level or job-level permissions so the workflow token uses the minimum access needed.",
      severity: "low",
      sourceType: "workflow",
      summary:
        "The workflow does not declare explicit permissions, which makes hardening harder to verify quickly.",
      title: "Workflow does not declare explicit permissions"
    }
  ],
  dependencySnapshot: {
    dependencies: [
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package.json",
        version: "^19.0.0",
        workspacePath: "."
      }
    ],
    filesParsed: [
      {
        dependencyCount: 1,
        ecosystem: "node",
        kind: "package.json",
        packageManager: "npm",
        path: "package.json"
      }
    ],
    filesSkipped: [],
    isPartial: false,
    parseWarningDetails: [],
    parseWarnings: [],
    summary: {
      byEcosystem: [
        {
          directDependencies: 1,
          ecosystem: "node",
          totalDependencies: 1
        }
      ],
      directDependencies: 1,
      parsedFileCount: 1,
      skippedFileCount: 0,
      totalDependencies: 1,
      transitiveDependencies: 0
    }
  },
  detectedFiles: {
    lockfiles: [
      {
        kind: "package-lock.json",
        path: "package-lock.json"
      }
    ],
    manifests: [
      {
        kind: "package.json",
        path: "package.json"
      },
      {
        kind: "pyproject.toml",
        path: "services/api/pyproject.toml"
      }
    ],
    signals: [
      {
        category: "workflow",
        kind: "github-workflow",
        path: ".github/workflows/ci.yml"
      }
    ]
  },
  ecosystems: [
    {
      ecosystem: "node",
      lockfiles: ["package-lock.json"],
      manifests: ["package.json"],
      packageManagers: ["npm"]
    },
    {
      ecosystem: "python",
      lockfiles: [],
      manifests: ["services/api/pyproject.toml"],
      packageManagers: ["poetry"]
    }
  ],
  fetchedAt: "2026-04-06T11:30:00.000Z",
  isPartial: false,
  issueCandidateSummary: {
    bySeverity: {
      critical: 0,
      high: 1,
      info: 0,
      low: 0,
      medium: 0
    },
    byType: [
      {
        candidateType: "dependency-upgrade",
        count: 1
      }
    ],
    totalCandidates: 1
  },
  issueCandidates: [
    {
      acceptanceCriteria: [
        "Upgrade react to a non-affected version and refresh the relevant lockfile entries.",
        "Run the relevant dependency installation and validation commands for the affected workspace.",
        "Confirm the related advisories no longer match the resolved dependency version."
      ],
      affectedPackages: ["react"],
      affectedPaths: ["package-lock.json", "package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      id: "issue:dependency-upgrade:react",
      labels: ["dependencies", "high", "security"],
      relatedFindingIds: ["dependency:GHSA-test-1234:react:19.0.0:.:direct"],
      scope: "package",
      severity: "high",
      suggestedBody: "## Summary\nUpgrade react to address dependency advisories",
      summary:
        "react is affected by a dependency advisory in the current repository snapshot.",
      title: "Upgrade react to address dependency advisories",
      whyItMatters:
        "The repository directly depends on react, so the advisory exposure is more likely to affect production behavior or build outputs."
    }
  ],
  prCandidateSummary: {
    byReadiness: [
      {
        count: 1,
        readiness: "ready"
      }
    ],
    byRiskLevel: [
      {
        count: 1,
        riskLevel: "low"
      }
    ],
    byType: [
      {
        candidateType: "dependency-upgrade",
        count: 1
      }
    ],
    totalCandidates: 1
  },
  prCandidates: [
    {
      affectedPackages: ["react"],
      affectedPaths: ["package-lock.json", "package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      expectedFileChanges: [
        {
          changeType: "edit",
          path: "package-lock.json",
          reason: "Refresh package-lock.json so react resolves to the remediated version."
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
      rationale:
        "The remediation path is bounded to react version updates and the matching manifest or lockfile entries already identified in the repository snapshot.",
      readiness: "ready",
      relatedFindingIds: ["dependency:GHSA-test-1234:react:19.0.0:.:direct"],
      riskLevel: "low",
      rollbackNote:
        "Revert the react version change and restore the previous lockfile entries if the upgrade causes regressions.",
      severity: "high",
      summary:
        "Update react and refresh the tracked dependency files so the current advisory match no longer applies.",
      testPlan: [
        "Install dependencies and refresh the affected lockfile entries.",
        "Run the repository validation commands that cover the affected workspace.",
        "Re-analyze the repository to confirm the advisory no longer matches the resolved version."
      ],
      title: "Upgrade react and refresh dependency locks"
    }
  ],
  prPatchPlanSummary: {
    byPatchability: [
      {
        count: 1,
        patchability: "patch_candidate"
      }
    ],
    byValidationStatus: [
      {
        count: 1,
        validationStatus: "ready"
      }
    ],
    totalPatchCandidates: 1,
    totalPlans: 1
  },
  prPatchPlans: [
    {
      affectedPackages: ["react"],
      affectedPaths: ["package-lock.json", "package.json"],
      candidateType: "dependency-upgrade",
      confidence: "high",
      id: "patch-plan:pr:dependency-upgrade:react",
      linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      patchPlan: {
        constraints: [
          "Keep the change scoped to the identified package and files.",
          "Avoid unrelated dependency churn while refreshing the lockfile."
        ],
        filesPlanned: [
          {
            changeType: "edit",
            path: "package-lock.json",
            reason: "Refresh package-lock.json so react resolves to the remediated version."
          },
          {
            changeType: "edit",
            path: "package.json",
            reason: "Update the react dependency declaration in package.json."
          }
        ],
        patchStrategy:
          "Update the identified dependency declaration and refresh the matching lockfile entries only.",
        requiredHumanReview: [
          "Confirm the chosen upgrade path is compatible with the affected workspace.",
          "Review the lockfile diff for unintended package changes."
        ],
        requiredValidationSteps: [
          "Install dependencies and refresh the affected lockfile entries.",
          "Run the repository validation commands that cover the affected workspace.",
          "Re-analyze the repository to confirm the advisory no longer matches the resolved version."
        ]
      },
      patchWarnings: [],
      patchability: "patch_candidate",
      prCandidateId: "pr:dependency-upgrade:react",
      readiness: "ready",
      relatedFindingIds: ["dependency:GHSA-test-1234:react:19.0.0:.:direct"],
      riskLevel: "low",
      severity: "high",
      title: "Upgrade react and refresh dependency locks",
      validationNotes: [
        "Validation has not been executed in this step.",
        "Standard validation steps are identified and the candidate is ready for later patch synthesis."
      ],
      validationStatus: "ready",
      writeBackEligibility: {
        approvalRequired: true,
        details: [
          "Approval is still required before Repo Guardian performs any GitHub write-back.",
          "The PR candidate is a direct npm dependency upgrade for react.",
          "The change scope is limited to repo-root package.json and package-lock.json.",
          "package.json uses a supported caret range (^19.0.0) specifier.",
          "package-lock.json uses supported lockfileVersion 3 and includes packages[\"\"].",
          "Existing lockfile metadata for react@19.0.1 was found uniquely and can be copied deterministically."
        ],
        status: "executable",
        summary: "Eligible for approved deterministic npm dependency write-back."
      }
    }
  ],
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
    samplePaths: [
      ".github/workflows/ci.yml",
      "package-lock.json",
      "package.json",
      "services/api/pyproject.toml"
    ],
    totalDirectories: 8,
    totalFiles: 42,
    truncated: false
  },
  reviewCoverage: {
    candidateFileCount: 1,
    isPartial: true,
    reviewedFileCount: 1,
    selectedFileCount: 1,
    selectedPaths: [".github/workflows/ci.yml"],
    skippedFileCount: 0,
    skippedPaths: [],
    strategy: "targeted"
  },
  warningDetails: [],
  warnings: ["Manifest without lockfile: services/api/pyproject.toml"]
});

function createExpandedEcosystemPayload(): AnalyzeRepoResponse {
  return AnalyzeRepoResponseSchema.parse({
    ...successPayload,
    dependencySnapshot: {
      ...successPayload.dependencySnapshot,
      dependencies: [
        ...successPayload.dependencySnapshot.dependencies,
        {
          dependencyType: "production",
          ecosystem: "go",
          isDirect: true,
          name: "github.com/gin-gonic/gin",
          packageManager: "go-mod",
          parseConfidence: "high",
          sourceFile: "go.sum",
          version: "v1.10.0",
          workspacePath: "."
        },
        {
          dependencyType: "production",
          ecosystem: "rust",
          isDirect: true,
          name: "serde",
          packageManager: "cargo",
          parseConfidence: "high",
          sourceFile: "Cargo.lock",
          version: "1.0.215",
          workspacePath: "."
        },
        {
          dependencyType: "production",
          ecosystem: "jvm",
          isDirect: true,
          name: "org.springframework:spring-context",
          packageManager: "gradle",
          parseConfidence: "high",
          sourceFile: "gradle.lockfile",
          version: "6.1.15",
          workspacePath: "."
        },
        {
          dependencyType: "production",
          ecosystem: "ruby",
          isDirect: true,
          name: "rails",
          packageManager: "bundler",
          parseConfidence: "high",
          sourceFile: "Gemfile.lock",
          version: "7.1.5",
          workspacePath: "."
        }
      ],
      filesParsed: [
        ...successPayload.dependencySnapshot.filesParsed,
        {
          dependencyCount: 1,
          ecosystem: "go",
          kind: "go.sum",
          packageManager: "go-mod",
          path: "go.sum"
        },
        {
          dependencyCount: 1,
          ecosystem: "rust",
          kind: "Cargo.lock",
          packageManager: "cargo",
          path: "Cargo.lock"
        },
        {
          dependencyCount: 1,
          ecosystem: "jvm",
          kind: "gradle.lockfile",
          packageManager: "gradle",
          path: "gradle.lockfile"
        },
        {
          dependencyCount: 1,
          ecosystem: "ruby",
          kind: "Gemfile.lock",
          packageManager: "bundler",
          path: "Gemfile.lock"
        }
      ],
      summary: {
        ...successPayload.dependencySnapshot.summary,
        byEcosystem: [
          ...successPayload.dependencySnapshot.summary.byEcosystem,
          {
            directDependencies: 1,
            ecosystem: "go",
            totalDependencies: 1
          },
          {
            directDependencies: 1,
            ecosystem: "rust",
            totalDependencies: 1
          },
          {
            directDependencies: 1,
            ecosystem: "jvm",
            totalDependencies: 1
          },
          {
            directDependencies: 1,
            ecosystem: "ruby",
            totalDependencies: 1
          }
        ],
        directDependencies: successPayload.dependencySnapshot.summary.directDependencies + 4,
        totalDependencies: successPayload.dependencySnapshot.summary.totalDependencies + 4
      }
    },
    detectedFiles: {
      ...successPayload.detectedFiles,
      lockfiles: [
        ...successPayload.detectedFiles.lockfiles,
        {
          kind: "go.sum",
          path: "go.sum"
        },
        {
          kind: "Cargo.lock",
          path: "Cargo.lock"
        },
        {
          kind: "gradle.lockfile",
          path: "gradle.lockfile"
        },
        {
          kind: "Gemfile.lock",
          path: "Gemfile.lock"
        }
      ],
      manifests: [
        ...successPayload.detectedFiles.manifests,
        {
          kind: "go.mod",
          path: "go.mod"
        },
        {
          kind: "Cargo.toml",
          path: "Cargo.toml"
        },
        {
          kind: "build.gradle",
          path: "build.gradle"
        },
        {
          kind: "Gemfile",
          path: "Gemfile"
        }
      ]
    },
    ecosystems: [
      ...successPayload.ecosystems,
      {
        ecosystem: "go",
        lockfiles: ["go.sum"],
        manifests: ["go.mod"],
        packageManagers: ["go-mod"]
      },
      {
        ecosystem: "rust",
        lockfiles: ["Cargo.lock"],
        manifests: ["Cargo.toml"],
        packageManagers: ["cargo"]
      },
      {
        ecosystem: "jvm",
        lockfiles: ["gradle.lockfile"],
        manifests: ["build.gradle"],
        packageManagers: ["gradle"]
      },
      {
        ecosystem: "ruby",
        lockfiles: ["Gemfile.lock"],
        manifests: ["Gemfile"],
        packageManagers: ["bundler"]
      }
    ],
    treeSummary: {
      ...successPayload.treeSummary,
      samplePaths: [
        ...successPayload.treeSummary.samplePaths,
        "go.mod",
        "Cargo.toml",
        "build.gradle",
        "Gemfile"
      ]
    }
  });
}

function createMixedTraceabilityPayload(): AnalyzeRepoResponse {
  const workflowFindingId = successPayload.codeReviewFindings[0]!.id;

  return AnalyzeRepoResponseSchema.parse({
    ...successPayload,
    issueCandidates: [
      ...successPayload.issueCandidates,
      {
        acceptanceCriteria: [
          "Declare explicit workflow permissions.",
          "Confirm the workflow still runs with least privilege."
        ],
        affectedPackages: [],
        affectedPaths: [".github/workflows/ci.yml"],
        candidateType: "workflow-hardening",
        confidence: "medium",
        id: "issue:workflow-hardening:.github/workflows/ci.yml",
        labels: ["workflow", "security"],
        relatedFindingIds: [workflowFindingId],
        scope: "workflow-file",
        severity: "low",
        suggestedBody: "## Summary\nHarden workflow permissions.",
        summary: "The CI workflow should declare explicit permissions.",
        title: "Harden workflow permissions",
        whyItMatters: "Explicit workflow permissions reduce token blast radius."
      }
    ],
    prCandidates: [
      ...successPayload.prCandidates,
      {
        affectedPackages: [],
        affectedPaths: [".github/workflows/ci.yml"],
        candidateType: "workflow-hardening",
        confidence: "medium",
        expectedFileChanges: [
          {
            changeType: "edit",
            path: ".github/workflows/ci.yml",
            reason: "Declare explicit workflow permissions."
          }
        ],
        id: "pr:workflow-hardening:.github/workflows/ci.yml",
        labels: ["candidate-pr", "workflow", "security"],
        linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        rationale: "The change stays inside one workflow file.",
        readiness: "ready_with_warnings",
        relatedFindingIds: [workflowFindingId],
        riskLevel: "low",
        rollbackNote: "Restore the previous workflow permissions if jobs fail.",
        severity: "low",
        summary: "Harden the CI workflow with explicit permissions.",
        testPlan: ["Run the workflow after the permissions change."],
        title: "Harden .github/workflows/ci.yml"
      }
    ],
    prPatchPlans: [
      ...successPayload.prPatchPlans,
      {
        affectedPackages: [],
        affectedPaths: [".github/workflows/ci.yml"],
        candidateType: "workflow-hardening",
        confidence: "medium",
        id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
        linkedIssueCandidateIds: ["issue:workflow-hardening:.github/workflows/ci.yml"],
        patchPlan: {
          constraints: ["Keep edits inside the workflow file."],
          filesPlanned: [
            {
              changeType: "edit",
              path: ".github/workflows/ci.yml",
              reason: "Declare explicit workflow permissions."
            }
          ],
          patchStrategy: "Add explicit least-privilege workflow permissions.",
          requiredHumanReview: [
            "Confirm each workflow job still has the permissions it needs."
          ],
          requiredValidationSteps: [
            "Run the workflow after the permissions change."
          ]
        },
        patchWarnings: [],
        patchability: "patch_candidate",
        prCandidateId: "pr:workflow-hardening:.github/workflows/ci.yml",
        readiness: "ready_with_warnings",
        relatedFindingIds: [workflowFindingId],
        riskLevel: "low",
        severity: "low",
        title: "Harden .github/workflows/ci.yml",
        validationNotes: ["Validation has not been executed in this step."],
        validationStatus: "ready_with_warnings",
        writeBackEligibility: {
          approvalRequired: true,
          details: [
            "Workflow hardening remains blocked in this fixture.",
            "Patchability: patch_candidate."
          ],
          status: "blocked",
          summary: "Workflow hardening remains blocked in this fixture."
        }
      }
    ],
    prPatchPlanSummary: {
      byPatchability: [
        {
          count: 2,
          patchability: "patch_candidate"
        }
      ],
      byValidationStatus: [
        {
          count: 1,
          validationStatus: "ready"
        },
        {
          count: 1,
          validationStatus: "ready_with_warnings"
        }
      ],
      totalPatchCandidates: 2,
      totalPlans: 2
    }
  });
}

function createExecutionPlanResponse() {
  return ExecutionPlanResponseSchema.parse({
    planId: "plan-1",
    planHash: "sha256:abc123plan",
    approvalToken: "mock-token",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    repository: {
      owner: "openai",
      repo: "openai-node",
      defaultBranch: "main"
    },
    summary: {
      totalSelections: 2,
      issueSelections: 1,
      prSelections: 1,
      totalActions: 2,
      eligibleActions: 2,
      blockedActions: 0,
      skippedActions: 0,
      approvalRequiredActions: 2
    },
    actions: createExecutionResult("dry_run").actions,
    approval: {
      required: true,
      confirmationText: "I approve this GitHub write-back plan."
    }
  });
}

function createExecutionResult(mode: "dry_run" | "execute_approved" = "dry_run") {
  const isExecute = mode === "execute_approved";

  return ExecutionResultSchema.parse({
    actions: [
      {
        actionType: "create_issue",
        affectedPackages: ["react"],
        affectedPaths: ["package.json", "package-lock.json"],
        approvalNotes: [
          isExecute
            ? "Approval was explicitly granted for this write action."
            : "Approval is required before this action can write to GitHub."
        ],
        approvalRequired: true,
        approvalStatus: isExecute ? "granted" : "required",
        attempted: isExecute,
        blocked: false,
        branchName: null,
        commitSha: null,
        eligibility: "eligible",
        errorMessage: null,
        id: "action:create-issue:issue:dependency-upgrade:react",
        issueNumber: isExecute ? 42 : null,
        issueUrl: isExecute
          ? "https://github.com/openai/openai-node/issues/42"
          : null,
        linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
        linkedPRCandidateIds: [],
        plannedSteps: ["Create a GitHub Issue from the selected issue candidate."],
        pullRequestNumber: null,
        pullRequestUrl: null,
        reason: isExecute
          ? "Created GitHub Issue #42."
          : "Dry-run would create a GitHub Issue for the selected issue candidate.",
        succeeded: isExecute,
        targetId: "issue:dependency-upgrade:react",
        targetType: "issue_candidate",
        title: "Create issue: Upgrade react to address dependency advisories"
      },
      {
        actionType: "create_pr",
        affectedPackages: ["react"],
        affectedPaths: ["package.json", "package-lock.json"],
        approvalNotes: [
          isExecute
            ? "Approval was explicitly granted for this write action."
            : "Approval is required before this action can write to GitHub."
        ],
        approvalRequired: true,
        approvalStatus: isExecute ? "granted" : "required",
        attempted: isExecute,
        blocked: false,
        branchName: isExecute ? "repo-guardian/dependency-upgrade-react" : null,
        commitSha: isExecute ? "abc123" : null,
        eligibility: "eligible",
        errorMessage: null,
        id: "action:create-pr:pr:dependency-upgrade:react",
        issueNumber: null,
        issueUrl: null,
        linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
        linkedPRCandidateIds: ["pr:dependency-upgrade:react"],
        plannedSteps: [
          "Create a branch from the default branch.",
          "Commit the bounded patch.",
          "Open a pull request."
        ],
        pullRequestNumber: isExecute ? 43 : null,
        pullRequestUrl: isExecute
          ? "https://github.com/openai/openai-node/pull/43"
          : null,
        reason: isExecute
          ? "Opened GitHub Pull Request #43."
          : "Dry-run would create a branch, commit the patch, and open a pull request.",
        succeeded: isExecute,
        targetId: "pr:dependency-upgrade:react",
        targetType: "pr_candidate",
        title: "Open PR: Upgrade react and refresh dependency locks"
      }
    ],
    approvalNotes: [
      isExecute
        ? "Approval was explicitly granted for selected write actions."
        : "Dry-run planning does not perform GitHub write actions."
    ],
    approvalRequired: true,
    approvalStatus: isExecute ? "granted" : "required",
    completedAt: "2026-04-06T11:35:00.000Z",
    errors: [],
    executionId: isExecute ? "execution-approved-1" : "execution-dry-run-1",
    mode,
    startedAt: "2026-04-06T11:35:00.000Z",
    status: isExecute ? "completed" : "planned",
    summary: {
      approvalRequiredActions: 2,
      blockedActions: 0,
      eligibleActions: 2,
      issueSelections: 1,
      prSelections: 1,
      skippedActions: 0,
      totalActions: 2,
      totalSelections: 2
    },
    warnings: []
  });
}

function createTrackedRepositoryFixture(overrides: Record<string, unknown> = {}) {
  return TrackedRepositorySchema.parse({
    canonicalUrl: "https://github.com/openai/openai-node",
    createdAt: "2026-04-12T10:00:00.000Z",
    fullName: "openai/openai-node",
    id: "tracked_one",
    isActive: true,
    label: "Weekly review",
    lastQueuedAt: "2026-04-12T10:00:00.000Z",
    owner: "openai",
    repo: "openai-node",
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  });
}

function createAnalysisJobFixture(overrides: Record<string, unknown> = {}) {
  return AnalysisJobSchema.parse({
    attemptCount: 0,
    completedAt: null,
    errorMessage: null,
    failedAt: null,
    jobId: "job_one",
    jobKind: "analyze_repository",
    label: "Weekly review",
    maxAttempts: 1,
    planId: null,
    queuedAt: "2026-04-12T10:00:00.000Z",
    repoInput: "openai/openai-node",
    repositoryFullName: "openai/openai-node",
    requestedByUserId: "usr_authenticated",
    runId: null,
    scheduledSweepId: null,
    startedAt: null,
    status: "queued",
    trackedRepositoryId: "tracked_one",
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  });
}

function createSweepScheduleFixture(overrides: Record<string, unknown> = {}) {
  return SweepScheduleSchema.parse({
    cadence: "weekly",
    createdAt: "2026-04-12T10:00:00.000Z",
    isActive: true,
    label: "Weekly sweep",
    lastTriggeredAt: null,
    nextRunAt: "2026-04-19T10:00:00.000Z",
    scheduleId: "sweep_one",
    selectionStrategy: "all_executable_prs",
    updatedAt: "2026-04-12T10:00:00.000Z",
    ...overrides
  });
}

function createFleetStatusFixture() {
  const trackedRepository = createTrackedRepositoryFixture();
  const latestJob = createAnalysisJobFixture();

  return FleetStatusResponseSchema.parse({
    generatedAt: "2026-04-12T10:05:00.000Z",
    recentJobs: [
      latestJob,
      createAnalysisJobFixture({
        errorMessage: "rate limited",
        failedAt: "2026-04-12T10:04:00.000Z",
        jobId: "job_failed",
        jobKind: "generate_execution_plan",
        planId: "plan_failed",
        status: "failed",
        trackedRepositoryId: null
      }),
      createAnalysisJobFixture({
        completedAt: "2026-04-12T10:03:00.000Z",
        jobId: "job_complete",
        planId: "plan_complete",
        runId: "run_complete",
        status: "completed"
      })
    ],
    summary: {
      blockedPatchPlans: 1,
      executablePatchPlans: 4,
      failedJobs: 1,
      mergedPullRequests: 1,
      openPullRequests: 1,
      stalePatchPlans: 2,
      staleRepositories: 1,
      trackedRepositories: 1
    },
    trackedPullRequests: [
      {
        branchName: "repo-guardian/harden-workflow",
        closedAt: null,
        createdAt: "2026-04-12T10:01:00.000Z",
        executionId: "exec_one",
        lifecycleStatus: "open",
        mergedAt: null,
        owner: "openai",
        planId: "plan_one",
        pullRequestNumber: 19,
        pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
        repo: "openai-node",
        repositoryFullName: "openai/openai-node",
        title: "Harden workflow permissions",
        trackedPullRequestId: "tpr_one",
        updatedAt: "2026-04-12T10:04:00.000Z"
      },
      {
        branchName: "repo-guardian/upgrade-react",
        closedAt: "2026-04-12T10:06:00.000Z",
        createdAt: "2026-04-12T09:00:00.000Z",
        executionId: "exec_two",
        lifecycleStatus: "merged",
        mergedAt: "2026-04-12T10:06:00.000Z",
        owner: "openai",
        planId: "plan_two",
        pullRequestNumber: 21,
        pullRequestUrl: "https://github.com/openai/openai-node/pull/21",
        repo: "openai-node",
        repositoryFullName: "openai/openai-node",
        title: "Upgrade react",
        trackedPullRequestId: "tpr_two",
        updatedAt: "2026-04-12T10:06:00.000Z"
      }
    ],
    trackedRepositories: [
      {
        latestAnalysisJob: latestJob,
        latestPlanId: "plan_one",
        latestPlanStatus: "planned",
        latestRun: {
          blockedPatchPlans: 1,
          createdAt: "2026-04-12T10:02:00.000Z",
          defaultBranch: "main",
          executablePatchPlans: 4,
          fetchedAt: "2026-04-12T10:02:00.000Z",
          highSeverityFindings: 1,
          id: "run_one",
          issueCandidates: 1,
          label: "Weekly review",
          prCandidates: 2,
          repositoryFullName: "openai/openai-node",
          totalFindings: 3
        },
        patchPlanCounts: {
          blocked: 1,
          executable: 4,
          stale: 2
        },
        stale: true,
        trackedRepository
      }
    ]
  });
}


describe("App", () => {
  beforeEach(() => {
    let store: Record<string, string> = {
      "repo-guardian-token": "dev-secret-key-do-not-use-in-production"
    };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the idle state before the first submit", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Repo Guardian" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Start with one repository snapshot/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Accepted forms: full GitHub URL/i)
    ).toBeInTheDocument();
  });

  it("renders a successful analyze flow", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /Repository summary/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /PR write-back readiness/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("openai/openai-node").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot fetched/i)).toBeInTheDocument();
  }, 10000);

  it("shows a loading state during submit", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredResponse();
    vi.stubGlobal("fetch", mockAuthenticatedFetch(async () => deferred.promise));

    render(<App />);

    await submitRepository(user);

    expect(screen.getByRole("button", { name: /Analyzing/i })).toBeDisabled();
    expect(
      screen.getByText(/Fetching the repository snapshot, recursive tree, and ecosystem signals/i)
    ).toBeInTheDocument();

    deferred.resolve(createJsonResponse(successPayload));

    await screen.findByRole("heading", { name: /Repository summary/i });
  });

  it("shows an inline API error state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () =>
        createJsonResponse(
          {
            dependencySnapshot: successPayload.dependencySnapshot,
            error: "Repository not found or not publicly accessible"
          },
          false,
          404
        )
      )
    );

    render(<App />);

    await submitRepository(user, "openai/missing-repo");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Repository not found or not publicly accessible");
  });

  it("shows the partial-analysis banner when the backend marks the snapshot partial", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse({
          ...successPayload,
          isPartial: true,
          treeSummary: {
            ...successPayload.treeSummary,
            truncated: true
          },
          warnings: [
            "GitHub returned a truncated recursive tree; the repository snapshot is partial."
          ]
        })
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /Partial analysis/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Partial snapshot/i).length).toBeGreaterThan(0);
  });

  it("renders ecosystems and detected files from a successful payload", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    await waitFor(() => {
      expect(screen.getAllByText("Node.js").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Python").length).toBeGreaterThan(0);
    expect(screen.getAllByText("package.json").length).toBeGreaterThan(0);
    expect(screen.getAllByText("package-lock.json").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dockerfile")).not.toBeInTheDocument();
    expect(screen.getAllByText(".github/workflows/ci.yml").length).toBeGreaterThan(0);
  });

  it("renders additional ecosystem cards and file groups for expanded coverage", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createExpandedEcosystemPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    await waitFor(() => {
      expect(screen.getAllByText("Go").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Rust").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Java / JVM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ruby").length).toBeGreaterThan(0);
    expect(screen.getAllByText("go.mod").length).toBeGreaterThan(0);
    expect(screen.getAllByText("go.sum").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cargo.toml").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cargo.lock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("build.gradle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gradle.lockfile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gemfile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gemfile.lock").length).toBeGreaterThan(0);
  });

  it("renders executable dependency write-back readiness details", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText(/Eligible for approved deterministic npm dependency write-back/i))
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approval required/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Existing lockfile metadata for react@19.0.1 was found uniquely/i)
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 executable/i).length).toBeGreaterThan(0);
  });

  it("renders matched workflow permission patterns before approval", async () => {
    const user = userEvent.setup();
    const workflowPayload = createMixedTraceabilityPayload();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse({
          ...workflowPayload,
          prPatchPlans: workflowPayload.prPatchPlans.map((plan) =>
            plan.candidateType === "workflow-hardening"
              ? {
                  ...plan,
                  writeBackEligibility: {
                    approvalRequired: true,
                    details: [
                      "Approval is still required before Repo Guardian performs any GitHub write-back.",
                      "The PR candidate is patch-capable for the current workflow-hardening write-back slice.",
                      "Supported workflow finding categories: workflow-permissions.",
                      "Matched deterministic workflow permission patterns: inline permissions: { contents: write }.",
                      "Affected file scope: .github/workflows/ci.yml."
                    ],
                    matchedPatterns: ["inline permissions: { contents: write }"],
                    status: "executable",
                    summary: "Eligible for approved workflow write-back."
                  }
                }
              : plan
          )
        })
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText("inline permissions: { contents: write }")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Eligible for approved workflow write-back/i).length
    ).toBeGreaterThan(0);
  });

  it("selects candidates and previews a dry-run execution plan", async () => {
    const user = userEvent.setup();
    let executionRequestBody: unknown = null;
    const fetchMock = mockAuthenticatedFetch(async (url, init) => {
      if (url === "/api/analyze") return createJsonResponse(successPayload);
      if (url === "/api/execution/plan") {
        executionRequestBody = JSON.parse(String(init?.body ?? "{}"));
        return createJsonResponse(createExecutionPlanResponse());
      }
      return createJsonResponse({ error: "Unexpected URL: " + url }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(screen.getByRole("checkbox", { name: /Select issue candidate/i }));
    await user.click(screen.getByRole("checkbox", { name: /Select PR candidate/i }));
    await user.click(screen.getByRole("button", { name: /Generate plan/i }));

    // This matches the plannedSteps in createExecutionResult
    expect(
      await screen.findByText(
        /Create a GitHub Issue from the selected issue candidate/i
      )
    ).toBeInTheDocument();
    expect(executionRequestBody).toMatchObject({
      analysisRunId: expect.any(String),
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });
    expect(screen.getByText(/2 actions/i)).toBeInTheDocument();
    expect(screen.getByText(/2 eligible/i)).toBeInTheDocument();
  }, 15000);

  it("requires explicit approval before submitting approved execution", async () => {
    const user = userEvent.setup();
    let executionRequestBody: unknown = null;
    const fetchMock = mockAuthenticatedFetch(async (url, init) => {
      if (url === "/api/analyze") return createJsonResponse(successPayload);
      if (url === "/api/execution/plan") {
        executionRequestBody = JSON.parse(String(init?.body ?? "{}"));
        return createJsonResponse(createExecutionPlanResponse());
      }
      if (url === "/api/execution/execute") {
        executionRequestBody = JSON.parse(String(init?.body ?? "{}"));
        return createJsonResponse(createExecutionResult("execute_approved"));
      }
      return createJsonResponse({ error: "Unexpected URL: " + url }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(screen.getByRole("checkbox", { name: /Select issue candidate/i }));
    await user.click(screen.getByRole("checkbox", { name: /Select PR candidate/i }));

    // Phase 1: Plan
    await user.click(screen.getByRole("button", { name: /Generate plan/i }));

    // Verify Phase 1 request
    expect(executionRequestBody).toMatchObject({
      analysisRunId: expect.any(String),
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });

    // Phase 2: Execute
    const executeButton = screen.getByRole("button", {
      name: /Execute approved actions/i
    });

    expect(executeButton).toBeDisabled();
    // String must match createExecutionPlanResponse()
    await user.click(
      screen.getByRole("checkbox", { name: /I approve this GitHub write-back plan/i })
    );
    expect(executeButton).not.toBeDisabled();
    await user.click(executeButton);

    // Verify Phase 2 request
    expect(executionRequestBody).toMatchObject({
      planId: "plan-1",
      planHash: "sha256:abc123plan",
      approvalToken: "mock-token",
      confirm: true,
      confirmationText: "I approve this GitHub write-back plan."
    });

    expect(await screen.findByText(/Created GitHub Issue #42/i)).toBeInTheDocument();
  }, 10000);

  it("shows execution API errors without fabricating results", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAuthenticatedFetch(async (url, _init) => {
      if (url === "/api/analyze") {
        return createJsonResponse(successPayload);
      }

      if (url === "/api/execution/plan") {
        return createJsonResponse(
          {
            error: "Execution service unavailable"
          },
          false,
          503
        );
      }

      return createJsonResponse({ error: "Unexpected URL: " + url }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(screen.getByRole("checkbox", { name: /Select issue candidate/i }));
    await user.click(screen.getByRole("checkbox", { name: /Select PR candidate/i }));

    await user.click(screen.getByRole("button", { name: /Generate plan/i }));

    // Exact string from the mock error
    expect(await screen.findByText("Execution service unavailable")).toBeInTheDocument();
  }, 10000);
  it("renders same-page traceability anchors for patch plans, candidates, issues, and findings", async () => {
    const user = userEvent.setup();
    const patchPlanId = successPayload.prPatchPlans[0]!.id;
    const prCandidateId = successPayload.prCandidates[0]!.id;
    const issueCandidateId = successPayload.issueCandidates[0]!.id;
    const findingId = successPayload.dependencyFindings[0]!.id;

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse({
          ...successPayload,
          issueCandidates: [
            ...successPayload.issueCandidates,
            {
              ...successPayload.issueCandidates[0]!,
              id: "issue:unreferenced:docs",
              title: "Unreferenced docs issue"
            }
          ]
        })
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /PR candidate traceability/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Issue candidate traceability/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Linked findings/i })
    ).toBeInTheDocument();

    expectTraceabilityMapCounts({
      findings: 1,
      issueCandidates: 1,
      patchPlans: 1,
      prCandidates: 1
    });
    const traceabilityMap = document.querySelector(
      '[aria-label="Traceability map summary"]'
    );
    expect(
      traceabilityMap?.querySelector('a[href="#traceability-patch-plans"]')
    ).not.toBeNull();
    expect(
      traceabilityMap?.querySelector('a[href="#traceability-pr-candidates"]')
    ).not.toBeNull();
    expect(
      traceabilityMap?.querySelector('a[href="#traceability-issue-candidates"]')
    ).not.toBeNull();
    expect(
      traceabilityMap?.querySelector('a[href="#traceability-findings"]')
    ).not.toBeNull();

    expect(document.getElementById(buildAnchorId("patch-plan", patchPlanId))).not.toBeNull();
    expect(document.getElementById(buildAnchorId("pr-candidate", prCandidateId))).not.toBeNull();
    expect(document.getElementById(buildAnchorId("issue-candidate", issueCandidateId))).not.toBeNull();
    expect(document.getElementById(buildAnchorId("finding", findingId))).not.toBeNull();

    expect(
      document.querySelector(`a[href="#${buildAnchorId("patch-plan", patchPlanId)}"]`)
    ).not.toBeNull();
    expect(
      document.querySelector(`a[href="#${buildAnchorId("pr-candidate", prCandidateId)}"]`)
    ).not.toBeNull();
    expect(
      document.querySelector(`a[href="#${buildAnchorId("issue-candidate", issueCandidateId)}"]`)
    ).not.toBeNull();
    expect(
      document.querySelector(`a[href="#${buildAnchorId("finding", findingId)}"]`)
    ).not.toBeNull();
    expect(
      screen.queryByText("Workflow does not declare explicit permissions")
    ).not.toBeInTheDocument();
    expect(
      within(getPanelByHeading(/Issue candidate traceability/i)).queryByText(
        "Unreferenced docs issue"
      )
    ).not.toBeInTheDocument();
  }, 20000);

  it("filters blocked readiness cards and recomputes traceability panels", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText(/Eligible for approved deterministic npm dependency write-back/i))
        .length
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Eligibility"), {
      target: {
        value: "blocked"
      }
    });

    await waitFor(() => {
      expect(
        within(document.getElementById("traceability-patch-plans")!).queryByText(
          /Eligible for approved deterministic npm dependency write-back/i
        )
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getAllByText(/Workflow hardening remains blocked in this fixture/i).length
    ).toBeGreaterThan(0);
    expect(
      within(getPanelByHeading(/PR candidate traceability/i)).queryByText(
        "Upgrade react and refresh dependency locks"
      )
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Harden .github/workflows/ci.yml").length).toBeGreaterThan(0);
    expectTraceabilityMapCounts({
      findings: 1,
      issueCandidates: 1,
      patchPlans: 1,
      prCandidates: 1
    });
    expect(
      within(getPanelByHeading(/Issue candidate traceability/i)).queryByText(
        "Upgrade react to address dependency advisories"
      )
    ).not.toBeInTheDocument();
    expect(
      within(getPanelByHeading(/Issue candidate traceability/i)).getByText(
        "Harden workflow permissions"
      )
    ).toBeInTheDocument();
  });

  it("filters by candidate type and keeps traceability synchronized", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText(/Eligible for approved deterministic npm dependency write-back/i))
        .length
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Candidate type"), {
      target: {
        value: "workflow-hardening"
      }
    });

    await waitFor(() => {
      expect(
        within(document.getElementById("traceability-patch-plans")!).queryByText(
          /Eligible for approved deterministic npm dependency write-back/i
        )
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Harden .github/workflows/ci.yml").length).toBeGreaterThan(0);
    expect(
      within(getPanelByHeading(/Issue candidate traceability/i)).getByText(
        "Harden workflow permissions"
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Workflow does not declare explicit permissions").length
    ).toBeGreaterThan(0);
    expectTraceabilityMapCounts({
      findings: 1,
      issueCandidates: 1,
      patchPlans: 1,
      prCandidates: 1
    });
  }, 10000);

  it("shows a scoped empty state when filters match no patch plans", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText(/Eligible for approved deterministic npm dependency write-back/i))
        .length
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Eligibility"), {
      target: {
        value: "blocked"
      }
    });

    expect(
      screen.getByText("No PR patch plans match the active readiness filters.")
    ).toBeInTheDocument();
    expectTraceabilityMapCounts({
      findings: 0,
      issueCandidates: 0,
      patchPlans: 0,
      prCandidates: 0
    });
    expect(
      screen.getByText("No PR candidates are referenced by the current readiness cards.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No issue candidates are referenced by the current readiness cards.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No findings are referenced by the current readiness cards.")
    ).toBeInTheDocument();
  });

  it("supports inline expansion for patch-plan, candidate, issue, and finding detail cards", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      (await screen.findAllByText(/Eligible for approved deterministic npm dependency write-back/i))
        .length
    ).toBeGreaterThan(0);

    const patchPlanDetails = screen.getByText("Patch-plan detail").closest("details");
    const candidateDetails = screen.getByText("Candidate detail").closest("details");
    const issueDetails = screen.getByText("Issue detail").closest("details");
    const findingDetails = screen.getByText("Finding detail").closest("details");

    expect(patchPlanDetails).not.toHaveAttribute("open");
    expect(candidateDetails).not.toHaveAttribute("open");
    expect(issueDetails).not.toHaveAttribute("open");
    expect(findingDetails).not.toHaveAttribute("open");

    await user.click(screen.getByText("Patch-plan detail"));
    await user.click(screen.getByText("Candidate detail"));
    await user.click(screen.getByText("Issue detail"));
    await user.click(screen.getByText("Finding detail"));

    expect(patchPlanDetails).toHaveAttribute("open");
    expect(candidateDetails).toHaveAttribute("open");
    expect(issueDetails).toHaveAttribute("open");
    expect(findingDetails).toHaveAttribute("open");
    expect(
      screen.getAllByText(
        /The repository directly depends on react, so the advisory exposure is more likely/i
      ).length
    ).toBeGreaterThan(0);
  });

  it(
    "renders blocked dependency write-back reasons when eligibility is blocked",
    async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse({
          ...successPayload,
          prPatchPlans: successPayload.prPatchPlans.map((plan) => ({
            ...plan,
            writeBackEligibility: {
              approvalRequired: true,
              details: [
                "Repo Guardian could not recover unique lockfile metadata for react@19.0.1.",
                "Patchability: patch_candidate.",
                "Validation status: ready."
              ],
              status: "blocked",
              summary:
                "Repo Guardian could not recover unique lockfile metadata for react@19.0.1."
            }
          }))
        })
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findAllByText(/Repo Guardian could not recover unique lockfile metadata for react@19.0.1./i)
    ).toHaveLength(4);
    expect(screen.getAllByText(/1 blocked/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Patchability: patch_candidate./i).length).toBeGreaterThan(0);
    expect(
      document.querySelector(
        `a[href="#${buildAnchorId("patch-plan", successPayload.prPatchPlans[0]!.id)}"]`
      )
    ).not.toBeNull();
    expect(
      document.querySelector(
        `a[href="#${buildAnchorId("pr-candidate", successPayload.prCandidates[0]!.id)}"]`
      )
    ).not.toBeNull();
    expect(
      document.querySelector(
        `a[href="#${buildAnchorId("issue-candidate", successPayload.issueCandidates[0]!.id)}"]`
      )
    ).not.toBeNull();
    },
    15000
  );

  it(
    "renders the Guardian Graph and inspects a high-severity finding",
    async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /Visual traceability map/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian Graph summary")).toHaveTextContent(
      "1 dependency findings"
    );
    expect(screen.getByLabelText("Guardian Graph summary")).toHaveTextContent(
      "1 executable patch plans"
    );
    expect(
      screen.queryByText(
        /Hover workflow nodes and eligible-for edges to preview write-back status./i
      )
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /dependency-finding: react is affected by GHSA-test-1234/i
      })
    );

    const inspector = screen.getByLabelText("Guardian Graph inspector");
    expect(
      within(inspector).getByText("react is affected by GHSA-test-1234")
    ).toBeInTheDocument();
    expect(within(inspector).getByText("Package: react")).toBeInTheDocument();
    expect(within(inspector).getByText("Linked issues: 1")).toBeInTheDocument();
    expect(within(inspector).getByText("Linked PRs: 1")).toBeInTheDocument();
    expect(
      within(inspector).getByText(
        /Upgrade react and refresh dependency locks: executable - Eligible for approved deterministic npm dependency write-back./i
      )
    ).toBeInTheDocument();
    expect(
      within(inspector).getByRole("link", { name: /Jump to report detail/i })
    ).toHaveAttribute(
      "href",
      `#${buildAnchorId(
        "finding",
        "dependency:GHSA-test-1234:react:19.0.0:.:direct"
      )}`
    );
    },
    15000
  );

  it("shows the graph hover hint and legend when workflow hover hints exist", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByText(
        /Hover workflow nodes and eligible-for edges to preview write-back status./i
      )
    ).toBeInTheDocument();

    const legend = screen.getByLabelText("Guardian Graph legend");
    expect(legend).toHaveTextContent("Findings");
    expect(legend).toHaveTextContent("Issue candidates");
    expect(legend).toHaveTextContent("PR candidates");
    expect(legend).toHaveTextContent("Patch plans");
    expect(legend).toHaveTextContent("eligible-for edge");
    expect(legend).toHaveTextContent(
      "Hover reveals workflow write-back status when available."
    );
  });

  it(
    "surfaces matched workflow patterns in the Guardian Graph inspector",
    async () => {
      const user = userEvent.setup();
      const baseWorkflowPayload = createMixedTraceabilityPayload();
      const workflowPayload = AnalyzeRepoResponseSchema.parse({
        ...baseWorkflowPayload,
        prPatchPlans: baseWorkflowPayload.prPatchPlans.map((plan) =>
          plan.candidateType === "workflow-hardening"
            ? {
                ...plan,
                writeBackEligibility: {
                  approvalRequired: true,
                  details: [
                    "Approval is still required before Repo Guardian performs any GitHub write-back.",
                    "The PR candidate is patch-capable for the current workflow-hardening write-back slice.",
                    "Matched deterministic workflow permission patterns: inline permissions: { contents: write }."
                  ],
                  matchedPatterns: ["inline permissions: { contents: write }"],
                  status: "executable",
                  summary: "Eligible for approved workflow write-back."
                }
              }
            : plan
        )
      });
      const workflowFindingTitle = workflowPayload.codeReviewFindings[0]!.title;

      vi.stubGlobal(
        "fetch",
        mockAuthenticatedFetch(async () => createJsonResponse(workflowPayload))
      );

      render(<App />);

      await submitRepository(user);

      await user.click(
        await screen.findByRole("button", {
          name: `code-finding: ${workflowFindingTitle}`
        })
      );

      const inspector = screen.getByLabelText("Guardian Graph inspector");

      expect(within(inspector).getByText("Workflow write-back hint")).toBeInTheDocument();
      expect(
        within(inspector).getAllByText(/Eligible for approved workflow write-back./i).length
      ).toBeGreaterThan(0);
      expect(
        within(inspector).getByText("inline permissions: { contents: write }")
      ).toBeInTheDocument();
    },
    15000
  );

  it(
    "surfaces blocked workflow hints in the Guardian Graph inspector",
    async () => {
      const user = userEvent.setup();
      const workflowPayload = createMixedTraceabilityPayload();
      const workflowFindingTitle = workflowPayload.codeReviewFindings[0]!.title;

      vi.stubGlobal(
        "fetch",
        mockAuthenticatedFetch(async () => createJsonResponse(workflowPayload))
      );

      render(<App />);

      await submitRepository(user);

      await user.click(
        await screen.findByRole("button", {
          name: `code-finding: ${workflowFindingTitle}`
        })
      );

      const inspector = screen.getByLabelText("Guardian Graph inspector");

      expect(within(inspector).getByText("Workflow write-back hint")).toBeInTheDocument();
      expect(
        within(inspector).getAllByText(/Workflow hardening remains blocked in this fixture./i)
          .length
      ).toBeGreaterThan(0);
    },
    15000
  );

  it("uses Guardian Graph summary chips as quick filters and toggles them off", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    const workflowPatchPlan = await screen.findByRole("button", {
      name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
    });
    const dependencyPatchPlan = screen.getByRole("button", {
      name: /patch-plan: Upgrade react and refresh dependency locks/i
    });

    expect(workflowPatchPlan).toBeInTheDocument();
    expect(dependencyPatchPlan).toBeInTheDocument();

    const highSeverityButton = screen.getByRole("button", {
      name: /1 high-severity findings/i
    });
    fireEvent.click(highSeverityButton);

    expect(highSeverityButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).toBeInTheDocument();

    fireEvent.click(highSeverityButton);

    expect(highSeverityButton).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    ).toBeInTheDocument();

    const blockedButton = screen.getByRole("button", {
      name: /1 blocked patch plans/i
    });
    fireEvent.click(blockedButton);

    expect(blockedButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    ).toBeInTheDocument();

    fireEvent.click(blockedButton);

    expect(blockedButton).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).toBeInTheDocument();
  }, 10000);

  it("searches the Guardian Graph and clears selection when the selected node becomes hidden", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    await user.click(
      await screen.findByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    );

    expect(screen.getByLabelText("Guardian Graph inspector")).toHaveTextContent(
      /Harden \.github\/workflows\/ci\.yml/i
    );

    fireEvent.change(screen.getByLabelText("Search graph"), {
      target: {
        value: "react"
      }
    });

    expect(
      screen.queryByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian Graph inspector")).toHaveTextContent(
      /Select a graph node/i
    );
  });

  it(
    "surfaces executable workflow write-back tooltips on graph PR nodes and edges",
    async () => {
      const user = userEvent.setup();
      const baseWorkflowPayload = createMixedTraceabilityPayload();
      const workflowPayload = AnalyzeRepoResponseSchema.parse({
        ...baseWorkflowPayload,
        prPatchPlans: baseWorkflowPayload.prPatchPlans.map((plan) =>
          plan.candidateType === "workflow-hardening"
            ? {
                ...plan,
                writeBackEligibility: {
                  approvalRequired: true,
                  details: [
                    "Approval is still required before Repo Guardian performs any GitHub write-back.",
                    "The PR candidate is patch-capable for the current workflow-hardening write-back slice.",
                    "Matched deterministic workflow permission patterns: inline permissions: { contents: write }."
                  ],
                  matchedPatterns: ["inline permissions: { contents: write }"],
                  status: "executable",
                  summary: "Eligible for approved workflow write-back."
                }
              }
            : plan
        )
      });

      vi.stubGlobal(
        "fetch",
        mockAuthenticatedFetch(async () => createJsonResponse(workflowPayload))
      );

      render(<App />);

      await submitRepository(user);

      const workflowPRNode = await screen.findByRole("button", {
        name: /pr-candidate: Harden \.github\/workflows\/ci\.yml/i
      });
      const graph = screen.getByRole("img", { name: "Guardian Graph visual map" });
      const workflowEdgeTooltips = Array.from(graph.querySelectorAll("line > title")).map(
        (element) => element.textContent ?? ""
      );

      expect(workflowPRNode.querySelector("title")).toHaveTextContent(
        /Workflow write-back: executable/i
      );
      expect(workflowPRNode.querySelector("title")).toHaveTextContent(
        /Eligible for approved workflow write-back\./i
      );
      expect(workflowPRNode.querySelector("title")).toHaveTextContent(
        /Matched patterns: inline permissions: \{ contents: write \}/i
      );
      expect(
        graph.querySelectorAll(".guardian-graph-node-status-marker-executable").length
      ).toBeGreaterThan(0);
      expect(
        Array.from(
          graph.querySelectorAll(".guardian-graph-node-status-marker-executable text")
        ).some((element) => element.textContent === "exec")
      ).toBe(true);
      expect(
        graph.querySelectorAll(".guardian-graph-edge-status-marker-executable").length
      ).toBeGreaterThan(0);
      expect(
        Array.from(
          graph.querySelectorAll(".guardian-graph-edge-status-marker-executable text")
        ).some((element) => element.textContent === "exec")
      ).toBe(true);
      expect(
        workflowEdgeTooltips.some(
          (text) =>
            text.includes("Workflow write-back: executable") &&
            text.includes("Eligible for approved workflow write-back.") &&
            text.includes("Matched patterns: inline permissions: { contents: write }")
        )
      ).toBe(true);
    },
    15000
  );

  it(
    "surfaces blocked workflow write-back tooltips on graph PR nodes and edges",
    async () => {
      const user = userEvent.setup();
      const workflowPayload = createMixedTraceabilityPayload();

      vi.stubGlobal(
        "fetch",
        mockAuthenticatedFetch(async () => createJsonResponse(workflowPayload))
      );

      render(<App />);

      await submitRepository(user);

      const workflowPRNode = await screen.findByRole("button", {
        name: /pr-candidate: Harden \.github\/workflows\/ci\.yml/i
      });
      const graph = screen.getByRole("img", { name: "Guardian Graph visual map" });
      const workflowEdgeTooltips = Array.from(graph.querySelectorAll("line > title")).map(
        (element) => element.textContent ?? ""
      );

      expect(workflowPRNode.querySelector("title")).toHaveTextContent(
        /Workflow write-back: blocked/i
      );
      expect(workflowPRNode.querySelector("title")).toHaveTextContent(
        /Workflow hardening remains blocked in this fixture\./i
      );
      expect(
        graph.querySelectorAll(".guardian-graph-node-status-marker-blocked").length
      ).toBeGreaterThan(0);
      expect(
        Array.from(
          graph.querySelectorAll(".guardian-graph-node-status-marker-blocked text")
        ).some((element) => element.textContent === "blocked")
      ).toBe(true);
      expect(
        graph.querySelectorAll(".guardian-graph-edge-status-marker-blocked").length
      ).toBeGreaterThan(0);
      expect(
        Array.from(
          graph.querySelectorAll(".guardian-graph-edge-status-marker-blocked text")
        ).some((element) => element.textContent === "blocked")
      ).toBe(true);
      expect(
        workflowEdgeTooltips.some(
          (text) =>
            text.includes("Workflow write-back: blocked") &&
            text.includes("Workflow hardening remains blocked in this fixture.")
        )
      ).toBe(true);
    },
    15000
  );

  it("surfaces generic relationship tooltips on non-workflow graph edges", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    const graph = await screen.findByRole("img", {
      name: "Guardian Graph visual map"
    });
    const edgeTooltips = Array.from(graph.querySelectorAll("line > title")).map(
      (element) => element.textContent ?? ""
    );
    const detectedInEdge = graph.querySelector(".guardian-graph-edge-detected-in");
    const groupedIntoEdge = graph.querySelector(".guardian-graph-edge-grouped-into");
    const remediatedByEdge = graph.querySelector(".guardian-graph-edge-remediated-by");
    const eligibleForEdge = graph.querySelector(".guardian-graph-edge-eligible-for");

    expect(
      edgeTooltips.some((text) =>
        text.includes("dependency finding grouped into issue candidate")
      )
    ).toBe(true);
    expect(
      edgeTooltips.some((text) =>
        text.includes("issue candidate remediated by pr candidate")
      )
    ).toBe(true);
    expect(detectedInEdge).toHaveAttribute(
      "marker-end",
      "url(#guardian-graph-arrow-detected-in)"
    );
    expect(groupedIntoEdge).toHaveAttribute(
      "marker-end",
      "url(#guardian-graph-arrow-grouped-into)"
    );
    expect(remediatedByEdge).toHaveAttribute(
      "marker-end",
      "url(#guardian-graph-arrow-remediated-by)"
    );
    expect(eligibleForEdge).toHaveAttribute(
      "marker-end",
      "url(#guardian-graph-arrow-eligible-for)"
    );
  });

  function estimateRenderedEdgeLabelRect(element: Element) {
    const text = element.textContent ?? "";
    const x = Number.parseFloat(element.getAttribute("x") ?? "0");
    const y = Number.parseFloat(element.getAttribute("y") ?? "0");
    const width = Math.max(56, text.length * 6.4 + 16);
    const height = 16;

    return {
      bottom: y + height / 2,
      label: text,
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2
    };
  }

  function renderedEdgeLabelRectsOverlap(
    left: ReturnType<typeof estimateRenderedEdgeLabelRect>,
    right: ReturnType<typeof estimateRenderedEdgeLabelRect>
  ) {
    const padding = 4;

    return !(
      left.right + padding < right.left ||
      left.left - padding > right.right ||
      left.bottom + padding < right.top ||
      left.top - padding > right.bottom
    );
  }

  function readGuardianGraphViewport(
    graph: HTMLElement
  ): { scale: number; translateX: number; translateY: number } {
    const viewport = graph.querySelector(".guardian-graph-viewport");

    expect(viewport).not.toBeNull();

    const transform = viewport?.getAttribute("transform") ?? "";
    const match = transform.match(
      /^matrix\(([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+)\)$/
    );

    expect(match).not.toBeNull();

    return {
      scale: Number.parseFloat(match?.[1] ?? "1"),
      translateX: Number.parseFloat(match?.[3] ?? "0"),
      translateY: Number.parseFloat(match?.[4] ?? "0")
    };
  }

  it("toggles visible relationship labels on the Guardian Graph", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    const graph = await screen.findByRole("img", {
      name: "Guardian Graph visual map"
    });
    const relationshipToggle = screen.getByLabelText("Show relationship labels");

    expect(relationshipToggle).not.toBeChecked();
    expect(graph.querySelectorAll(".guardian-graph-edge-label")).toHaveLength(0);

    await user.click(relationshipToggle);

    const initialLabels = Array.from(
      graph.querySelectorAll(".guardian-graph-edge-label")
    ).map((element) => element.textContent ?? "");

    expect(initialLabels.length).toBeGreaterThan(0);
    expect(initialLabels).toContain("detected in");
    expect(initialLabels).toContain("remediated by");

    fireEvent.change(screen.getByLabelText("Search graph"), {
      target: {
        value: "react"
      }
    });

    expect(graph.querySelectorAll(".guardian-graph-edge-label").length).toBeLessThan(
      initialLabels.length
    );

    await user.click(screen.getByLabelText("Show relationship labels"));

    expect(graph.querySelectorAll(".guardian-graph-edge-label")).toHaveLength(0);
  });

  it("places visible relationship labels without overlap in the current graph fixture", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);
    await screen.findByRole("img", { name: "Guardian Graph visual map" });
    await user.click(screen.getByLabelText("Show relationship labels"));

    const graph = await screen.findByRole("img", {
      name: "Guardian Graph visual map"
    });
    const labelRects = Array.from(
      graph.querySelectorAll(".guardian-graph-edge-label")
    ).map((element) => estimateRenderedEdgeLabelRect(element));
    const overlappingPairs: string[] = [];

    for (let index = 0; index < labelRects.length; index += 1) {
      const currentRect = labelRects[index];

      if (!currentRect) {
        continue;
      }

      for (let otherIndex = index + 1; otherIndex < labelRects.length; otherIndex += 1) {
        const otherRect = labelRects[otherIndex];

        if (!otherRect) {
          continue;
        }

        if (renderedEdgeLabelRectsOverlap(currentRect, otherRect)) {
          overlappingPairs.push(`${currentRect.label} <> ${otherRect.label}`);
        }
      }
    }

    expect(overlappingPairs).toEqual([]);
  });

  it("supports zoom, drag pan, and reset on the Guardian Graph canvas", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    const graph = await screen.findByRole("img", {
      name: "Guardian Graph visual map"
    });
    const zoomInButton = screen.getByRole("button", { name: "Zoom in graph" });
    const resetButton = screen.getByRole("button", { name: "Reset graph view" });

    expect(readGuardianGraphViewport(graph)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
    expect(resetButton).toBeDisabled();

    fireEvent.wheel(graph, {
      clientX: 460,
      clientY: 260,
      deltaY: -160
    });

    const zoomedViewport = readGuardianGraphViewport(graph);

    expect(zoomedViewport.scale).toBeGreaterThan(1);
    expect(resetButton).toBeEnabled();

    fireEvent.pointerDown(graph, {
      button: 0,
      clientX: 460,
      clientY: 260,
      pointerId: 1
    });
    fireEvent.pointerMove(graph, {
      button: 0,
      clientX: 400,
      clientY: 220,
      pointerId: 1
    });
    fireEvent.pointerUp(graph, {
      button: 0,
      clientX: 400,
      clientY: 220,
      pointerId: 1
    });

    const pannedViewport = readGuardianGraphViewport(graph);

    expect(pannedViewport.translateX).not.toBe(zoomedViewport.translateX);
    expect(pannedViewport.translateY).not.toBe(zoomedViewport.translateY);

    await user.click(zoomInButton);

    expect(readGuardianGraphViewport(graph).scale).toBeGreaterThan(zoomedViewport.scale);

    await user.click(resetButton);

    expect(readGuardianGraphViewport(graph)).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
    expect(resetButton).toBeDisabled();
  });

  it("keeps workflow edge tooltips and status markers when relationship labels are shown", async () => {
    const user = userEvent.setup();
    const workflowPayload = createMixedTraceabilityPayload();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => createJsonResponse(workflowPayload))
    );

    render(<App />);

    await submitRepository(user);
    await screen.findByRole("img", { name: "Guardian Graph visual map" });
    await user.click(screen.getByLabelText("Show relationship labels"));

    const graph = screen.getByRole("img", { name: "Guardian Graph visual map" });
    const relationshipLabels = Array.from(
      graph.querySelectorAll(".guardian-graph-edge-label")
    ).map((element) => element.textContent ?? "");
    const workflowEdgeTooltips = Array.from(graph.querySelectorAll("line > title")).map(
      (element) => element.textContent ?? ""
    );

    expect(relationshipLabels).toContain("eligible for");
    expect(
      graph.querySelectorAll(".guardian-graph-edge-status-marker-blocked").length
    ).toBeGreaterThan(0);
    expect(
      workflowEdgeTooltips.some(
        (text) =>
          text.includes("Workflow write-back: blocked") &&
          text.includes("Workflow hardening remains blocked in this fixture.")
      )
    ).toBe(true);
  });

  it("filters Guardian Graph nodes by write-back eligibility", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async () => 
        createJsonResponse(createMixedTraceabilityPayload())
      )
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Graph write-back eligibility"), {
      target: {
        value: "blocked"
      }
    });

    expect(
      screen.queryByRole("button", {
        name: /patch-plan: Upgrade react and refresh dependency locks/i
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /patch-plan: Harden \.github\/workflows\/ci\.yml/i
      })
    ).toBeInTheDocument();
  });

  it("defaults to repository analysis mode and loads fleet admin on toggle", async () => {
    const user = userEvent.setup();
    const fleetStatus = createFleetStatusFixture();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async (url) => {
        if (url === "/api/tracked-repositories") {
          return createJsonResponse(
            ListTrackedRepositoriesResponseSchema.parse({
              repositories: [createTrackedRepositoryFixture()]
            })
          );
        }

        if (url === "/api/fleet/status") {
          return createJsonResponse(fleetStatus);
        }

        if (url === "/api/analyze/jobs") {
          return createJsonResponse(
            ListAnalysisJobsResponseSchema.parse({
              jobs: fleetStatus.recentJobs
            })
          );
        }

        if (url === "/api/sweep-schedules") {
          return createJsonResponse(
            ListSweepSchedulesResponseSchema.parse({
              schedules: [createSweepScheduleFixture()]
            })
          );
        }

        return createJsonResponse({ error: "Unhandled" }, false, 500);
      })
    );

    render(<App />);

    expect(
      screen.getByRole("tab", { name: /Repository Analysis/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: /Analyze a public GitHub repository/i })
    ).toBeInTheDocument();

    await openFleetAdmin(user);

    expect(screen.getByRole("heading", { name: /Fleet status/i })).toBeInTheDocument();
    expect(screen.getByText("Executable Plans")).toBeInTheDocument();
    expect(screen.getByText("Tracked repositories")).toBeInTheDocument();
    expect(screen.getByText("Tracked pull requests")).toBeInTheDocument();
    expect(
      within(getPanelByHeading(/Tracked pull requests/i)).getByRole("link", {
        name: /Harden workflow permissions/i
      })
    ).toBeInTheDocument();
  });

  it("registers a tracked repository and enqueues manual analysis from fleet admin", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAuthenticatedFetch(async (url, init) => {
      if (url === "/api/tracked-repositories" && init?.method === "POST") {
        return createJsonResponse({
          repository: createTrackedRepositoryFixture({
            id: "tracked_new",
            label: "Security weekly",
            lastQueuedAt: null
          })
        }, true, 201);
      }

      if (url === "/api/analyze/jobs" && init?.method === "POST") {
        return createJsonResponse({
          job: createAnalysisJobFixture({
            jobId: "job_new",
            trackedRepositoryId: "tracked_one"
          })
        }, true, 202);
      }

      if (url === "/api/tracked-repositories") {
        return createJsonResponse(
          ListTrackedRepositoriesResponseSchema.parse({
            repositories: [createTrackedRepositoryFixture()]
          })
        );
      }

      if (url === "/api/fleet/status") {
        return createJsonResponse(createFleetStatusFixture());
      }

      if (url === "/api/analyze/jobs") {
        return createJsonResponse(
          ListAnalysisJobsResponseSchema.parse({
            jobs: createFleetStatusFixture().recentJobs
          })
        );
      }

      if (url === "/api/sweep-schedules") {
        return createJsonResponse(
          ListSweepSchedulesResponseSchema.parse({
            schedules: [createSweepScheduleFixture()]
          })
        );
      }

      return createJsonResponse({ error: "Unhandled" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await openFleetAdmin(user);

    await user.type(screen.getByLabelText("Repository input"), "openai/openai-node");
    await user.type(screen.getByLabelText("Label"), "Security weekly");
    await user.click(screen.getByRole("button", { name: /Register tracked repo/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tracked-repositories",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /Enqueue analysis/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analyze/jobs",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("filters jobs and triggers retry or cancel actions from fleet admin", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAuthenticatedFetch(async (url, init) => {
      if (url === "/api/analyze/jobs/job_failed/retry" && init?.method === "POST") {
        return createJsonResponse({
          job: createAnalysisJobFixture({
            jobId: "job_failed",
            jobKind: "generate_execution_plan",
            status: "queued",
            trackedRepositoryId: null
          })
        });
      }

      if (url === "/api/analyze/jobs/job_one/cancel" && init?.method === "POST") {
        return createJsonResponse({
          job: createAnalysisJobFixture({
            completedAt: "2026-04-12T10:07:00.000Z",
            jobId: "job_one",
            status: "cancelled"
          })
        });
      }

      if (url === "/api/tracked-repositories") {
        return createJsonResponse(
          ListTrackedRepositoriesResponseSchema.parse({
            repositories: [createTrackedRepositoryFixture()]
          })
        );
      }

      if (url === "/api/fleet/status") {
        return createJsonResponse(createFleetStatusFixture());
      }

      if (url === "/api/analyze/jobs") {
        return createJsonResponse(
          ListAnalysisJobsResponseSchema.parse({
            jobs: createFleetStatusFixture().recentJobs
          })
        );
      }

      if (url === "/api/sweep-schedules") {
        return createJsonResponse(
          ListSweepSchedulesResponseSchema.parse({
            schedules: [createSweepScheduleFixture()]
          })
        );
      }

      return createJsonResponse({ error: "Unhandled" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await openFleetAdmin(user);

    fireEvent.change(screen.getByLabelText("Status filter"), {
      target: {
        value: "failed"
      }
    });

    const jobsPanel = within(getPanelByHeading(/Analysis jobs/i));

    expect(jobsPanel.getByText("rate limited")).toBeInTheDocument();
    expect(jobsPanel.queryByText(/job_one/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analyze/jobs/job_failed/retry",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    fireEvent.change(screen.getByLabelText("Status filter"), {
      target: {
        value: "queued"
      }
    });

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analyze/jobs/job_one/cancel",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("creates and triggers sweep schedules while rendering tracked PR lifecycle", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAuthenticatedFetch(async (url, init) => {
      if (url === "/api/sweep-schedules" && init?.method === "POST") {
        return createJsonResponse({
          schedule: createSweepScheduleFixture({
            label: "Dependency review"
          })
        }, true, 201);
      }

      if (url === "/api/sweep-schedules/sweep_one/trigger" && init?.method === "POST") {
        return createJsonResponse({
          job: createAnalysisJobFixture({
            jobId: "job_sweep",
            jobKind: "run_scheduled_sweep",
            repositoryFullName: "[scheduled-sweep]",
            repoInput: "[scheduled-sweep]",
            scheduledSweepId: "sweep_one",
            trackedRepositoryId: null
          }),
          schedule: createSweepScheduleFixture()
        });
      }

      if (url === "/api/tracked-repositories") {
        return createJsonResponse(
          ListTrackedRepositoriesResponseSchema.parse({
            repositories: [createTrackedRepositoryFixture()]
          })
        );
      }

      if (url === "/api/fleet/status") {
        return createJsonResponse(createFleetStatusFixture());
      }

      if (url === "/api/analyze/jobs") {
        return createJsonResponse(
          ListAnalysisJobsResponseSchema.parse({
            jobs: createFleetStatusFixture().recentJobs
          })
        );
      }

      if (url === "/api/sweep-schedules") {
        return createJsonResponse(
          ListSweepSchedulesResponseSchema.parse({
            schedules: [createSweepScheduleFixture()]
          })
        );
      }

      return createJsonResponse({ error: "Unhandled" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await openFleetAdmin(user);

    const trackedPullRequestsPanel = within(getPanelByHeading(/Tracked pull requests/i));

    expect(
      trackedPullRequestsPanel.getByRole("link", {
        name: /Harden workflow permissions/i
      })
    ).toBeInTheDocument();
    expect(
      trackedPullRequestsPanel.getByRole("link", {
        name: /Upgrade react/i
      })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Schedule label"), "Dependency review");
    await user.click(screen.getByRole("button", { name: /Create weekly sweep/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sweep-schedules",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /Trigger now/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sweep-schedules/sweep_one/trigger",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("preserves the loaded analysis when switching between analysis and fleet admin modes", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      mockAuthenticatedFetch(async (url, init) => {
        if (url === "/api/analyze") {
          return createJsonResponse(successPayload);
        }

        if (url === "/api/tracked-repositories") {
          return createJsonResponse(
            ListTrackedRepositoriesResponseSchema.parse({
              repositories: [createTrackedRepositoryFixture()]
            })
          );
        }

        if (url === "/api/fleet/status") {
          return createJsonResponse(createFleetStatusFixture());
        }

        if (url === "/api/analyze/jobs") {
          return createJsonResponse(
            ListAnalysisJobsResponseSchema.parse({
              jobs: createFleetStatusFixture().recentJobs
            })
          );
        }

        if (url === "/api/sweep-schedules") {
          return createJsonResponse(
            ListSweepSchedulesResponseSchema.parse({
              schedules: [createSweepScheduleFixture()]
            })
          );
        }

        if (url === "/api/runs") {
          if (init?.method === "POST") {
            return createJsonResponse({
              summary: {
                id: "run-default",
                repositoryFullName: "openai/openai-node",
                defaultBranch: "main",
                fetchedAt: "2026-04-08T00:00:00.000Z",
                createdAt: "2026-04-08T00:00:00.000Z",
                totalFindings: 0,
                highSeverityFindings: 0,
                issueCandidates: 0,
                prCandidates: 0,
                executablePatchPlans: 0,
                blockedPatchPlans: 0,
                label: "Auto-saved"
              },
              run: {
                id: "run-default",
                analysis: successPayload,
                createdAt: "2026-04-08T00:00:00.000Z",
                label: "Auto-saved"
              }
            }, true, 201);
          }

          return createJsonResponse({ runs: [] });
        }

        return createJsonResponse({ error: "Unhandled" }, false, 500);
      })
    );

    render(<App />);

    await submitRepository(user);
    expect(
      await screen.findByRole("heading", { name: /Repository summary/i })
    ).toBeInTheDocument();

    await openFleetAdmin(user);
    expect(screen.getByRole("heading", { name: /Fleet status/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Repository Analysis/i }));
    expect(
      await screen.findByRole("heading", { name: /Repository summary/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Repository input/i)).toHaveValue("openai/openai-node");
  });
});
