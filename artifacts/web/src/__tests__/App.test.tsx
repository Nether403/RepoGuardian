import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyzeRepoResponseSchema } from "@repo-guardian/shared-types";
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
  user: ReturnType<typeof userEvent.setup>,
  value = "openai/openai-node"
) {
  const input = screen.getByLabelText(/Repository input/i);

  fireEvent.change(input, {
    target: {
      value
    }
  });
  await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));
}

function buildAnchorId(prefix: string, rawId: string): string {
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `${prefix}-${normalized || "item"}`;
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
  });

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
      await screen.findByText(/Eligible for approved deterministic npm dependency write-back/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Approval required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Existing lockfile metadata for react@19.0.1 was found uniquely/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/1 executable/i)).toBeInTheDocument();
  });

  it("renders same-page traceability anchors for patch plans, candidates, and findings", async () => {
    const user = userEvent.setup();
    const patchPlanId = successPayload.prPatchPlans[0]!.id;
    const prCandidateId = successPayload.prCandidates[0]!.id;
    const findingId = successPayload.dependencyFindings[0]!.id;

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    expect(
      await screen.findByRole("heading", { name: /PR candidate traceability/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Linked findings/i })
    ).toBeInTheDocument();

    expect(document.getElementById(buildAnchorId("patch-plan", patchPlanId))).not.toBeNull();
    expect(document.getElementById(buildAnchorId("pr-candidate", prCandidateId))).not.toBeNull();
    expect(document.getElementById(buildAnchorId("finding", findingId))).not.toBeNull();

    expect(
      screen
        .getAllByRole("link", { name: patchPlanId })
        .some((link) => link.getAttribute("href") === `#${buildAnchorId("patch-plan", patchPlanId)}`)
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: prCandidateId })
        .some(
          (link) => link.getAttribute("href") === `#${buildAnchorId("pr-candidate", prCandidateId)}`
        )
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: findingId })
        .some((link) => link.getAttribute("href") === `#${buildAnchorId("finding", findingId)}`)
    ).toBe(true);
    expect(
      screen.queryByText("Workflow does not declare explicit permissions")
    ).not.toBeInTheDocument();
  });

  it("supports inline expansion for patch-plan, candidate, and finding detail cards", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await submitRepository(user);

    await screen.findByText(/Eligible for approved deterministic npm dependency write-back/i);

    const patchPlanDetails = screen.getByText("Patch-plan detail").closest("details");
    const candidateDetails = screen.getByText("Candidate detail").closest("details");
    const findingDetails = screen.getByText("Finding detail").closest("details");

    expect(patchPlanDetails).not.toHaveAttribute("open");
    expect(candidateDetails).not.toHaveAttribute("open");
    expect(findingDetails).not.toHaveAttribute("open");

    await user.click(screen.getByText("Patch-plan detail"));
    await user.click(screen.getByText("Candidate detail"));
    await user.click(screen.getByText("Finding detail"));

    expect(patchPlanDetails).toHaveAttribute("open");
    expect(candidateDetails).toHaveAttribute("open");
    expect(findingDetails).toHaveAttribute("open");
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
    ).toHaveLength(2);
    expect(screen.getByText(/1 blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/Patchability: patch_candidate./i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: successPayload.prPatchPlans[0]!.id }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: successPayload.prCandidates[0]!.id }).length
    ).toBeGreaterThan(0);
  });
});
