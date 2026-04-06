import { describe, expect, it } from "vitest";
import type {
  CodeReviewFinding,
  DependencyFinding,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan,
  RepositoryMetadata
} from "@repo-guardian/shared-types";
import { explainPRWriteBackEligibility } from "../patch-synthesis.js";

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
    severity: "high",
    sourceType: "dependency",
    summary: "react is affected by a dependency advisory.",
    title: "react is affected by GHSA-test-1234",
    ...overrides
  };
}

function dependencyCandidate(
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
        reason: "Refresh package-lock.json."
      },
      {
        changeType: "edit",
        path: "package.json",
        reason: "Update package.json."
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
    testPlan: [],
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
    linkedIssueCandidateIds: ["issue:dependency-upgrade:react"],
    patchPlan: {
      constraints: ["Keep the change scoped to the identified package and files."],
      filesPlanned: [
        {
          changeType: "edit",
          path: "package-lock.json",
          reason: "Refresh package-lock.json."
        },
        {
          changeType: "edit",
          path: "package.json",
          reason: "Update package.json."
        }
      ],
      patchStrategy: "Update the manifest and matching root lockfile entries only.",
      requiredHumanReview: ["Review the lockfile diff for unintended package changes."],
      requiredValidationSteps: ["Run the repository validation commands."]
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

function workflowFinding(
  overrides: Partial<CodeReviewFinding> = {}
): CodeReviewFinding {
  return {
    candidateIssue: true,
    candidatePr: true,
    category: "workflow-permissions",
    confidence: "high",
    evidence: [],
    id: "review:workflow-permissions:.github/workflows/ci.yml:3-3",
    lineSpans: [],
    paths: [".github/workflows/ci.yml"],
    recommendedAction: "Replace write-all with the minimum explicit permission set.",
    severity: "high",
    sourceType: "workflow",
    summary: "Broad workflow permissions increase token blast radius.",
    title: "Broad GitHub Actions permissions detected",
    ...overrides
  };
}

function workflowCandidate(
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
        reason: "Tighten workflow permissions."
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
    testPlan: [],
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
          reason: "Tighten workflow permissions."
        }
      ],
      patchStrategy: "Replace broad workflow permissions with a minimal explicit block.",
      requiredHumanReview: ["Confirm the workflow still has the permissions it needs."],
      requiredValidationSteps: ["Run the workflow after the permissions change."]
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

function createAnalysisContext(input?: {
  codeReviewFindings?: CodeReviewFinding[];
  dependencyFindings?: DependencyFinding[];
  prCandidates?: PRCandidate[];
  prPatchPlans?: PRPatchPlan[];
}): ExecutionPlanningContext {
  return {
    codeReviewFindings: input?.codeReviewFindings ?? [],
    dependencyFindings: input?.dependencyFindings ?? [],
    issueCandidates: [],
    prCandidates: input?.prCandidates ?? [],
    prPatchPlans: input?.prPatchPlans ?? [],
    repository
  };
}

describe("explainPRWriteBackEligibility", () => {
  it("marks a deterministic npm dependency candidate executable", () => {
    const candidate = dependencyCandidate();
    const patchPlan = dependencyPatchPlan();
    const analysis = createAnalysisContext({
      dependencyFindings: [dependencyFinding()],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "package-lock.json": JSON.stringify({
          dependencies: {
            react: {
              version: "1.0.0"
            }
          },
          lockfileVersion: 3,
          packages: {
            "": {
              dependencies: {
                react: "^1.0.0"
              }
            },
            "node_modules/react": {
              name: "react",
              version: "1.0.0"
            },
            "node_modules/example/node_modules/react": {
              integrity: "sha512-example",
              name: "react",
              resolved: "https://registry.npmjs.org/react/-/react-2.0.0.tgz",
              version: "2.0.0"
            }
          }
        }),
        "package.json": JSON.stringify({
          dependencies: {
            react: "^1.0.0"
          }
        })
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic npm dependency write-back."
    });
    expect(result.details).toContain(
      "Existing lockfile metadata for react@2.0.0 was found uniquely and can be copied deterministically."
    );
  });

  it("blocks a dependency candidate with an unsupported manifest specifier", () => {
    const candidate = dependencyCandidate();
    const patchPlan = dependencyPatchPlan();
    const analysis = createAnalysisContext({
      dependencyFindings: [dependencyFinding()],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "package-lock.json": JSON.stringify({
          dependencies: {
            react: {
              version: "1.0.0"
            }
          },
          lockfileVersion: 3,
          packages: {
            "": {
              dependencies: {
                react: "workspace:*"
              }
            },
            "node_modules/example/node_modules/react": {
              name: "react",
              version: "2.0.0"
            }
          }
        }),
        "package.json": JSON.stringify({
          dependencies: {
            react: "workspace:*"
          }
        })
      },
      patchPlan
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe(
      "Deterministic dependency write-back supports only exact, ^, or ~ version specifiers for 2.0.0."
    );
  });

  it("blocks a dependency candidate when lock metadata is ambiguous", () => {
    const candidate = dependencyCandidate();
    const patchPlan = dependencyPatchPlan();
    const analysis = createAnalysisContext({
      dependencyFindings: [dependencyFinding()],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "package-lock.json": JSON.stringify({
          dependencies: {
            react: {
              version: "1.0.0"
            }
          },
          lockfileVersion: 3,
          packages: {
            "": {
              dependencies: {
                react: "^1.0.0"
              }
            },
            "node_modules/example/node_modules/react": {
              name: "react",
              version: "2.0.0"
            },
            "node_modules/other/node_modules/react": {
              name: "react",
              version: "2.0.0"
            }
          }
        }),
        "package.json": JSON.stringify({
          dependencies: {
            react: "^1.0.0"
          }
        })
      },
      patchPlan
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe(
      "Repo Guardian could not recover unique lockfile metadata for react@2.0.0."
    );
  });

  it("marks a supported workflow candidate executable", () => {
    const candidate = workflowCandidate();
    const patchPlan = workflowPatchPlan();
    const analysis = createAnalysisContext({
      codeReviewFindings: [workflowFinding()],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved workflow write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is patch-capable for the current workflow-hardening write-back slice."
    );
  });

  it("blocks workflow trigger-risk candidates", () => {
    const candidate = workflowCandidate({
      relatedFindingIds: [
        "review:workflow-permissions:.github/workflows/ci.yml:3-3",
        "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2"
      ]
    });
    const patchPlan = workflowPatchPlan({
      relatedFindingIds: [
        "review:workflow-permissions:.github/workflows/ci.yml:3-3",
        "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2"
      ]
    });
    const analysis = createAnalysisContext({
      codeReviewFindings: [
        workflowFinding(),
        workflowFinding({
          category: "workflow-trigger-risk",
          id: "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2",
          summary: "The workflow uses a risky trigger.",
          title: "Risky workflow trigger detected"
        })
      ],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      patchPlan
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe(
      "Workflow trigger-risk findings remain blocked for real write-back because the trigger change is not deterministic enough yet."
    );
  });
});
