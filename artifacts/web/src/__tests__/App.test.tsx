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
  AnalyzeRepoResponseSchema,
  ExecutionResultSchema,
  type AnalyzeRepoResponse
} from "@repo-guardian/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    json: async () => body,
    ok,
    status
  } as Response;
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

  fireEvent.change(input, {
    target: {
      value
    }
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze Repository/i }));
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
          "package-lock.json uses lockfileVersion 3 and includes packages[\"\"].",
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

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}

describe("App", () => {
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
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /Repository summary/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /PR write-back readiness/i })
    ).toBeInTheDocument();
    expect(screen.getByText("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByDisplayValue("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot fetched/i)).toBeInTheDocument();
  }, 10000);

  it("shows a loading state during submit", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredResponse();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockReturnValue(deferred.promise));

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
      vi.fn<typeof fetch>().mockResolvedValue(
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
      vi.fn<typeof fetch>().mockResolvedValue(
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
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    await waitFor(() => {
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getAllByText("package.json").length).toBeGreaterThan(0);
    expect(screen.getAllByText("package-lock.json").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dockerfile")).not.toBeInTheDocument();
    expect(screen.getAllByText(".github/workflows/ci.yml").length).toBeGreaterThan(0);
  });

  it("renders executable dependency write-back readiness details", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
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
    expect(screen.getByText(/1 executable/i)).toBeInTheDocument();
  });

  it("selects candidates and previews a dry-run execution plan", async () => {
    const user = userEvent.setup();
    let executionRequestBody: unknown = null;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = getFetchUrl(input);

      if (url === "/api/analyze") {
        return createJsonResponse(successPayload);
      }

      if (url === "/api/execution/plan") {
        executionRequestBody = JSON.parse(String(init?.body ?? "{}"));
        return createJsonResponse(createExecutionResult("dry_run"));
      }

      return createJsonResponse({ error: "Unexpected URL" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(
      screen.getByRole("checkbox", { name: /Select issue candidate/i })
    );
    await user.click(screen.getByRole("checkbox", { name: /Select PR candidate/i }));
    await user.click(screen.getByRole("button", { name: /Preview dry-run plan/i }));

    expect(
      await screen.findByText(
        /Dry-run would create a GitHub Issue for the selected issue candidate/i
      )
    ).toBeInTheDocument();
    expect(executionRequestBody).toMatchObject({
      approvalGranted: false,
      mode: "dry_run",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });
    expect(screen.getByText(/2 actions/i)).toBeInTheDocument();
    expect(screen.getByText(/2 eligible/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requires explicit approval before submitting approved execution", async () => {
    const user = userEvent.setup();
    let executionRequestBody: unknown = null;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = getFetchUrl(input);

      if (url === "/api/analyze") {
        return createJsonResponse(successPayload);
      }

      if (url === "/api/execution/plan") {
        executionRequestBody = JSON.parse(String(init?.body ?? "{}"));
        return createJsonResponse(createExecutionResult("execute_approved"));
      }

      return createJsonResponse({ error: "Unexpected URL" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(
      screen.getByRole("checkbox", { name: /Select issue candidate/i })
    );
    await user.click(screen.getByRole("checkbox", { name: /Select PR candidate/i }));
    fireEvent.change(screen.getByLabelText("Mode"), {
      target: {
        value: "execute_approved"
      }
    });

    const executeButton = screen.getByRole("button", {
      name: /Execute approved actions/i
    });

    expect(executeButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /I explicitly approve Repo Guardian/i })
    );
    expect(executeButton).not.toBeDisabled();
    await user.click(executeButton);

    expect(await screen.findByText(/Created GitHub Issue #42/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute(
      "href",
      "https://github.com/openai/openai-node/issues/42"
    );
    expect(screen.getByRole("link", { name: "#43" })).toHaveAttribute(
      "href",
      "https://github.com/openai/openai-node/pull/43"
    );
    expect(screen.getByText("repo-guardian/dependency-upgrade-react")).toBeInTheDocument();
    expect(executionRequestBody).toMatchObject({
      approvalGranted: true,
      mode: "execute_approved",
      selectedIssueCandidateIds: ["issue:dependency-upgrade:react"],
      selectedPRCandidateIds: ["pr:dependency-upgrade:react"]
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows execution API errors without fabricating results", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = getFetchUrl(input);

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

      return createJsonResponse({ error: "Unexpected URL" }, false, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await submitRepository(user);

    await screen.findByRole("heading", { name: /Execution planner/i });
    await user.click(
      screen.getByRole("checkbox", { name: /Select issue candidate/i })
    );
    await user.click(screen.getByRole("button", { name: /Preview dry-run plan/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Execution service unavailable"
    );
    expect(
      screen.getByText(
        "Run a dry-run plan or approved execution to see action-by-action results."
      )
    ).toBeInTheDocument();
  });

  it("renders same-page traceability anchors for patch plans, candidates, issues, and findings", async () => {
    const user = userEvent.setup();
    const patchPlanId = successPayload.prPatchPlans[0]!.id;
    const prCandidateId = successPayload.prCandidates[0]!.id;
    const issueCandidateId = successPayload.issueCandidates[0]!.id;
    const findingId = successPayload.dependencyFindings[0]!.id;

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
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
  });

  it("filters blocked readiness cards and recomputes traceability panels", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
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
      vi.fn<typeof fetch>().mockResolvedValue(
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
  });

  it("shows a scoped empty state when filters match no patch plans", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
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
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
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

  it("renders blocked dependency write-back reasons when eligibility is blocked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
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
    expect(screen.getByText(/1 blocked/i)).toBeInTheDocument();
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
  });
});
