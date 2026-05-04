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
    reachability: { band: "unknown", referencedPaths: [], score: 0, signals: [] },
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
    id: "patch-plan:pr:dependency-upgrade:react",
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
    id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
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
    expect(result.details).toContain(
      'package-lock.json uses supported lockfileVersion 3 and includes packages[""].'
    );
  });

  it("marks a lockfileVersion 2 npm dependency candidate executable", () => {
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
          lockfileVersion: 2,
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
      'package-lock.json uses supported lockfileVersion 2 and includes packages[""].'
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
      fileContentsByPath: {
        ".github/workflows/ci.yml": [
          "name: ci",
          "on:",
          "  push:",
          "permissions: { contents: write }",
          "jobs:",
          "  test:",
          "    runs-on: ubuntu-latest"
        ].join("\n")
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      matchedPatterns: ["inline permissions: { contents: write }"],
      status: "executable",
      summary: "Eligible for approved workflow write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is patch-capable for the current workflow-hardening write-back slice."
    );
    expect(result.details).toContain(
      "Matched deterministic workflow permission patterns: inline permissions: { contents: write }."
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

  it("marks a deterministic Python requirements.txt candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:requests:1",
      packageName: "requests",
      paths: ["requirements.txt"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["requests"],
      affectedPaths: ["requirements.txt"],
      id: "pr:dependency-upgrade:requests",
      relatedFindingIds: ["dependency:requests:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["requests"],
      affectedPaths: ["requirements.txt"],
      id: "patch-plan:pr:dependency-upgrade:requests",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "requirements.txt",
            reason: "Update requirements.txt."
          }
        ]
      },
      prCandidateId: "pr:dependency-upgrade:requests",
      relatedFindingIds: ["dependency:requests:1"]
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "requirements.txt": "requests==2.25.1\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Python dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Python dependency upgrade for requests."
    );
    expect(result.details).toContain(
      "Matched deterministic requirement pattern: requests==2.25.1."
    );
  });

  it("marks a deterministic Maven pom.xml candidate executable", () => {
    const packageName = "com.google.guava:guava";
    const finding = dependencyFinding({
      id: "dependency:guava:1",
      packageName,
      paths: ["pom.xml"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: [packageName],
      affectedPaths: ["pom.xml"],
      id: "pr:dependency-upgrade:guava",
      relatedFindingIds: ["dependency:guava:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: [packageName],
      affectedPaths: ["pom.xml"],
      id: "patch-plan:pr:dependency-upgrade:guava",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "pom.xml",
            reason: "Update pom.xml."
          }
        ]
      },
      prCandidateId: "pr:dependency-upgrade:guava",
      relatedFindingIds: ["dependency:guava:1"]
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "pom.xml": [
          "<project>",
          "  <dependencies>",
          "    <dependency>",
          "      <groupId>com.google.guava</groupId>",
          "      <artifactId>guava</artifactId>",
          "      <version>30.1-jre</version>",
          "    </dependency>",
          "  </dependencies>",
          "</project>"
        ].join("\n")
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Maven dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Maven dependency upgrade for com.google.guava:guava."
    );
  });

  it("blocks Python write-back if version is not exact", () => {
    const finding = dependencyFinding({
      id: "dependency:requests:1",
      packageName: "requests",
      paths: ["requirements.txt"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["requests"],
      affectedPaths: ["requirements.txt"],
      id: "pr:dependency-upgrade:requests",
      relatedFindingIds: ["dependency:requests:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["requests"],
      affectedPaths: ["requirements.txt"],
      id: "patch-plan:pr:dependency-upgrade:requests",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "requirements.txt",
            reason: "Update requirements.txt."
          }
        ]
      },
      prCandidateId: "pr:dependency-upgrade:requests",
      relatedFindingIds: ["dependency:requests:1"]
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "requirements.txt": "requests>=2.25.1\n"
      },
      patchPlan
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe(
      "Repo Guardian could not find a deterministic exact-version requirement for requests in requirements.txt."
    );
  });

  it("blocks Maven write-back if version is a property", () => {
    const packageName = "com.google.guava:guava";
    const finding = dependencyFinding({
      packageName,
      paths: ["pom.xml"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: [packageName],
      affectedPaths: ["pom.xml"],
      relatedFindingIds: [finding.id]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: [packageName],
      affectedPaths: ["pom.xml"],
      id: "patch-plan:pr:dependency-upgrade:guava",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "pom.xml",
            reason: "Update pom.xml."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: [finding.id]
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "pom.xml": [
          "<project>",
          "  <dependencies>",
          "    <dependency>",
          "      <groupId>com.google.guava</groupId>",
          "      <artifactId>guava</artifactId>",
          "      <version>${guava.version}</version>",
          "    </dependency>",
          "  </dependencies>",
          "</project>"
        ].join("\n")
      },
      patchPlan
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe(
      "Repo Guardian could not find a deterministic explicit-version dependency for com.google.guava:guava in pom.xml."
    );
  });

  it("marks a deterministic Go go.mod candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:github.com/pkg/errors:1",
      packageName: "github.com/pkg/errors",
      paths: ["go.mod"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["github.com/pkg/errors"],
      affectedPaths: ["go.mod"],
      id: "pr:dependency-upgrade:pkg-errors",
      relatedFindingIds: ["dependency:github.com/pkg/errors:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["github.com/pkg/errors"],
      affectedPaths: ["go.mod"],
      id: "patch-plan:pr:dependency-upgrade:pkg-errors",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "go.mod",
            reason: "Update go.mod."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "go.mod": "module myapp\n\ngo 1.20\n\nrequire (\n\tgithub.com/pkg/errors v0.8.1\n)\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Go dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Go dependency upgrade for github.com/pkg/errors."
    );
  });

  it("marks a deterministic Rust Cargo.toml candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:serde:1",
      packageName: "serde",
      paths: ["Cargo.toml"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["serde"],
      affectedPaths: ["Cargo.toml"],
      id: "pr:dependency-upgrade:serde",
      relatedFindingIds: ["dependency:serde:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["serde"],
      affectedPaths: ["Cargo.toml"],
      id: "patch-plan:pr:dependency-upgrade:serde",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "Cargo.toml",
            reason: "Update Cargo.toml."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "Cargo.toml": "[package]\nname = \"myapp\"\nversion = \"0.1.0\"\n\n[dependencies]\nserde = \"1.0.100\"\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Rust dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Rust dependency upgrade for serde."
    );
  });

  it("marks a deterministic Ruby Gemfile candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:rails:1",
      packageName: "rails",
      paths: ["Gemfile"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["rails"],
      affectedPaths: ["Gemfile"],
      id: "pr:dependency-upgrade:rails",
      relatedFindingIds: ["dependency:rails:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["rails"],
      affectedPaths: ["Gemfile"],
      id: "patch-plan:pr:dependency-upgrade:rails",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "Gemfile",
            reason: "Update Gemfile."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "Gemfile": "source 'https://rubygems.org'\n\ngem 'rails', '6.0.3'\ngem 'puma', '~> 4.1'\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Ruby dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Ruby dependency upgrade for rails."
    );
  });

  it("marks a deterministic Python pyproject.toml candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:requests:1",
      packageName: "requests",
      paths: ["pyproject.toml"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["requests"],
      affectedPaths: ["pyproject.toml"],
      id: "pr:dependency-upgrade:requests",
      relatedFindingIds: ["dependency:requests:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["requests"],
      affectedPaths: ["pyproject.toml"],
      id: "patch-plan:pr:dependency-upgrade:requests",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "pyproject.toml",
            reason: "Update pyproject.toml."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "pyproject.toml": "[tool.poetry.dependencies]\npython = \"^3.8\"\nrequests = \"^2.25.1\"\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Python dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Python dependency upgrade for requests."
    );
  });

  it("marks a deterministic Infra Dockerfile candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:node:1",
      packageName: "node",
      paths: ["Dockerfile"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["node"],
      affectedPaths: ["Dockerfile"],
      id: "pr:dependency-upgrade:node",
      relatedFindingIds: ["dependency:node:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["node"],
      affectedPaths: ["Dockerfile"],
      id: "patch-plan:pr:dependency-upgrade:node",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "Dockerfile",
            reason: "Update Dockerfile."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "Dockerfile": "FROM node:14-alpine\nWORKDIR /app\nCOPY . .\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Infra dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Docker base image upgrade for node."
    );
  });

  it("marks a deterministic Gradle build build.gradle candidate executable", () => {
    const finding = dependencyFinding({
      id: "dependency:guava:1",
      packageName: "com.google.guava:guava",
      paths: ["build.gradle"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["com.google.guava:guava"],
      affectedPaths: ["build.gradle"],
      id: "pr:dependency-upgrade:guava",
      relatedFindingIds: ["dependency:guava:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["com.google.guava:guava"],
      affectedPaths: ["build.gradle"],
      id: "patch-plan:pr:dependency-upgrade:guava",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "build.gradle",
            reason: "Update build.gradle."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "build.gradle": "dependencies {\n  implementation 'com.google.guava:guava:31.0.1-jre'\n}\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Gradle dependency write-back."
    });
    expect(result.details).toContain(
      "The PR candidate is a direct Gradle dependency upgrade for com.google.guava:guava."
    );
  });

  it("blocks a Gradle build.gradle candidate if the version is variable-driven", () => {
    const finding = dependencyFinding({
      id: "dependency:guava:1",
      packageName: "com.google.guava:guava",
      paths: ["build.gradle"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["com.google.guava:guava"],
      affectedPaths: ["build.gradle"],
      id: "pr:dependency-upgrade:guava",
      relatedFindingIds: ["dependency:guava:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["com.google.guava:guava"],
      affectedPaths: ["build.gradle"],
      id: "patch-plan:pr:dependency-upgrade:guava",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "build.gradle",
            reason: "Update build.gradle."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "build.gradle": "dependencies {\n  implementation 'com.google.guava:guava:$guavaVersion'\n}\n"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "blocked",
      summary: "Repo Guardian blocked updating com.google.guava:guava because its version is centrally managed by a variable ($guavaVersion)."
    });
  });

  it("marks a Yarn package.json candidate executable while ignoring yarn.lock payload", () => {
    const finding = dependencyFinding({
      id: "dependency:react:1",
      packageName: "react",
      paths: ["package.json", "yarn.lock"]
    });
    const candidate = dependencyCandidate({
      affectedPackages: ["react"],
      affectedPaths: ["package.json", "yarn.lock"],
      id: "pr:dependency-upgrade:react",
      relatedFindingIds: ["dependency:react:1"]
    });
    const patchPlan = dependencyPatchPlan({
      affectedPackages: ["react"],
      affectedPaths: ["package.json", "yarn.lock"],
      id: "patch-plan:pr:dependency-upgrade:react",
      patchPlan: {
        ...dependencyPatchPlan().patchPlan!,
        filesPlanned: [
          {
            changeType: "edit",
            path: "package.json",
            reason: "Update package.json."
          }
        ]
      },
      prCandidateId: candidate.id,
      relatedFindingIds: candidate.relatedFindingIds
    });
    const analysis = createAnalysisContext({
      dependencyFindings: [finding],
      prCandidates: [candidate],
      prPatchPlans: [patchPlan]
    });

    const result = explainPRWriteBackEligibility({
      analysis,
      candidate,
      fileContentsByPath: {
        "package.json": JSON.stringify({ dependencies: { react: "^1.0.0" } }),
        "yarn.lock": "some lock content"
      },
      patchPlan
    });

    expect(result).toMatchObject({
      approvalRequired: true,
      status: "executable",
      summary: "Eligible for approved deterministic Yarn dependency write-back."
    });
    expect(result.details).toContain(
      "The change scope is limited to package.json; yarn.lock will be naturally regenerated by CI actions."
    );
  });
});
