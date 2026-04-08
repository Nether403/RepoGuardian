import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzeRepoResponseSchema } from "@repo-guardian/shared-types";
import app from "../app.js";

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: init?.status ?? 200,
    statusText: init?.statusText,
    ...(init ?? {})
  });
}

function createTextResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    ...(init ?? {})
  });
}

describe("POST /api/analyze", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the current analysis payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          default_branch: "main",
          description: "SDK repository",
          forks_count: 12,
          full_name: "openai/openai-node",
          html_url: "https://github.com/openai/openai-node",
          language: "TypeScript",
          name: "openai-node",
          owner: {
            login: "openai"
          },
          stargazers_count: 42
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          object: {
            sha: "commit-sha",
            type: "commit"
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          tree: {
            sha: "tree-sha"
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          tree: [
            {
              path: ".github",
              type: "tree"
            },
            {
              path: ".github/workflows/ci.yml",
              type: "blob"
            },
            {
              path: "package-lock.json",
              type: "blob"
            },
            {
              path: "package.json",
              type: "blob"
            }
          ],
          truncated: false
        })
      )
      .mockResolvedValueOnce(
        createTextResponse(
          JSON.stringify({
            packages: {
              "": {
                dependencies: {
                  react: "^19.0.0"
                }
              },
              "node_modules/react": {
                name: "react",
                version: "19.0.0"
              }
            }
          })
        )
      )
      .mockResolvedValueOnce(
        createTextResponse(
          JSON.stringify({
            dependencies: {
              react: "^19.0.0"
            }
          })
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-test-1234",
                  modified: "2026-04-06T11:30:00.000Z"
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: {
                severity: "HIGH"
              },
              package: {
                ecosystem: "npm",
                name: "react"
              },
              ranges: [
                {
                  events: [
                    {
                      introduced: "0"
                    },
                    {
                      fixed: "19.0.1"
                    }
                  ],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GHSA-test-1234",
          references: [
            {
              type: "ADVISORY",
              url: "https://osv.dev/vulnerability/GHSA-test-1234"
            }
          ],
          summary: "React test advisory"
        })
      )
      .mockResolvedValueOnce(
        createTextResponse(
          [
            "name: ci",
            "on: pull_request_target",
            "permissions: write-all",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest",
            "    steps:",
            "      - uses: actions/checkout@v4"
          ].join("\n")
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "github.com/openai/openai-node" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
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
      dependencySnapshot: {
        dependencies: [
          {
            dependencyType: "production",
            ecosystem: "node",
            isDirect: true,
            name: "react",
            packageManager: "npm",
            parseConfidence: "high",
            sourceFile: "package-lock.json",
            version: "19.0.0",
            workspacePath: "."
          },
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
          },
          {
            dependencyCount: 1,
            ecosystem: "node",
            kind: "package-lock.json",
            packageManager: "npm",
            path: "package-lock.json"
          }
        ],
        filesSkipped: [],
        isPartial: false,
        parseWarningDetails: [],
        parseWarnings: [],
        summary: {
          byEcosystem: [
            {
              directDependencies: 2,
              ecosystem: "node",
              totalDependencies: 2
            }
          ],
          directDependencies: 2,
          parsedFileCount: 2,
          skippedFileCount: 0,
          totalDependencies: 2,
          transitiveDependencies: 0
        }
      },
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
          id: "dependency:GHSA-test-1234:react:19.0.0:.:direct",
          installedVersion: "19.0.0",
          isDirect: true,
          packageName: "react",
          paths: ["package-lock.json", "package.json"],
          recommendedAction:
            "Upgrade react to 19.0.1 or later and refresh the lockfile.",
          referenceUrls: ["https://osv.dev/vulnerability/GHSA-test-1234"],
          remediationType: "upgrade",
          remediationVersion: "19.0.1",
          severity: "high",
          sourceType: "dependency",
          title: "react is affected by GHSA-test-1234"
        }
      ],
      codeReviewFindingSummary: {
        findingsBySeverity: {
          critical: 0,
          high: 2,
          info: 0,
          low: 0,
          medium: 0
        },
        isPartial: true,
        reviewedFileCount: 1,
        totalFindings: 2
      },
      codeReviewFindings: [
        {
          candidateIssue: false,
          candidatePr: false,
          category: "workflow-permissions",
          confidence: "high",
          paths: [".github/workflows/ci.yml"],
          severity: "high",
          sourceType: "workflow",
          title: "Broad GitHub Actions permissions detected"
        },
        {
          candidateIssue: false,
          candidatePr: false,
          category: "workflow-trigger-risk",
          confidence: "high",
          paths: [".github/workflows/ci.yml"],
          severity: "high",
          sourceType: "workflow",
          title: "Risky workflow trigger detected"
        }
      ],
      issueCandidateSummary: {
        bySeverity: {
          critical: 0,
          high: 2,
          info: 0,
          low: 0,
          medium: 0
        },
        byType: [
          {
            candidateType: "dependency-upgrade",
            count: 1
          },
          {
            candidateType: "workflow-hardening",
            count: 1
          }
        ],
        totalCandidates: 2
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
          relatedFindingIds: [
            "dependency:GHSA-test-1234:react:19.0.0:.:direct"
          ],
          scope: "package",
          severity: "high",
          summary:
            "react is affected by a dependency advisory in the current repository snapshot.",
          title: "Upgrade react to address dependency advisories",
          whyItMatters:
            "The repository directly depends on react, so the advisory exposure is more likely to affect production behavior or build outputs."
        },
        {
          acceptanceCriteria: [
            "Reduce the workflow token permissions to the minimum set required for its jobs.",
            "Review high-risk workflow triggers and gate privileged steps for untrusted pull requests.",
            "Re-run the affected workflow after hardening changes to confirm behavior still matches expectations."
          ],
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          confidence: "high",
          id: "issue:workflow-hardening:.github/workflows/ci.yml",
          labels: ["high", "security", "workflow"],
          relatedFindingIds: [
            "review:workflow-permissions:.github/workflows/ci.yml:3-3",
            "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2"
          ],
          scope: "workflow-file",
          severity: "high",
          summary:
            "The workflow file .github/workflows/ci.yml has multiple hardening findings that likely share one remediation pass.",
          title: "Harden workflow .github/workflows/ci.yml",
          whyItMatters:
            "Workflow misconfiguration can expand token privileges or expose privileged automation to untrusted pull request content."
        }
      ],
      prCandidateSummary: {
        byReadiness: [
          {
            count: 2,
            readiness: "ready"
          }
        ],
        byRiskLevel: [
          {
            count: 2,
            riskLevel: "low"
          }
        ],
        byType: [
          {
            candidateType: "dependency-upgrade",
            count: 1
          },
          {
            candidateType: "workflow-hardening",
            count: 1
          }
        ],
        totalCandidates: 2
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
          rationale:
            "The remediation path is bounded to react version updates and the matching manifest or lockfile entries already identified in the repository snapshot.",
          readiness: "ready",
          relatedFindingIds: [
            "dependency:GHSA-test-1234:react:19.0.0:.:direct"
          ],
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
        },
        {
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          confidence: "high",
          expectedFileChanges: [
            {
              changeType: "edit",
              path: ".github/workflows/ci.yml",
              reason:
                "Tighten workflow permissions and adjust high-risk trigger behavior in the workflow definition."
            }
          ],
          id: "pr:workflow-hardening:.github/workflows/ci.yml",
          labels: ["candidate-pr", "high", "security", "workflow"],
          linkedIssueCandidateIds: [
            "issue:workflow-hardening:.github/workflows/ci.yml"
          ],
          rationale:
            "The findings are localized to .github/workflows/ci.yml, so the remediation can stay inside one workflow file and one review concern.",
          readiness: "ready",
          relatedFindingIds: [
            "review:workflow-permissions:.github/workflows/ci.yml:3-3",
            "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2"
          ],
          riskLevel: "low",
          rollbackNote:
            "Revert the workflow file change if the hardened permissions or trigger rules block expected automation.",
          severity: "high",
          summary:
            "Harden .github/workflows/ci.yml by tightening permissions and revisiting the risky trigger behavior already flagged in analysis.",
          testPlan: [
            "Run the workflow or its equivalent validation after the permission change.",
            "Confirm privileged steps still have the minimum access they need.",
            "Verify untrusted pull request paths no longer reach the risky trigger pattern."
          ],
          title: "Harden .github/workflows/ci.yml"
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
          relatedFindingIds: [
            "dependency:GHSA-test-1234:react:19.0.0:.:direct"
          ],
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
              "Deterministic dependency write-back currently supports only package-lock.json lockfileVersion 2 or 3.",
              "Patchability: patch_candidate.",
              "Validation status: ready.",
              "Affected package: react.",
              "The dependency write-back slice remains limited to a direct npm upgrade for repo-root package.json and package-lock.json."
            ],
            status: "blocked",
            summary:
              "Deterministic dependency write-back currently supports only package-lock.json lockfileVersion 2 or 3."
          }
        },
        {
          affectedPackages: [],
          affectedPaths: [".github/workflows/ci.yml"],
          candidateType: "workflow-hardening",
          confidence: "high",
          id: "patch-plan:pr:workflow-hardening:.github/workflows/ci.yml",
          linkedIssueCandidateIds: [
            "issue:workflow-hardening:.github/workflows/ci.yml"
          ],
          patchPlan: {
            constraints: [
              "Keep edits inside the identified workflow file.",
              "Do not change unrelated jobs, steps, or release automation behavior."
            ],
            filesPlanned: [
              {
                changeType: "edit",
                path: ".github/workflows/ci.yml",
                reason:
                  "Tighten workflow permissions and adjust high-risk trigger behavior in the workflow definition."
              }
            ],
            patchStrategy:
              "Edit the single workflow file to reduce permissions and narrow risky trigger behavior.",
            requiredHumanReview: [
              "Verify the workflow still has the minimum permissions needed for legitimate jobs.",
              "Confirm the trigger hardening still matches the repository's contribution model."
            ],
            requiredValidationSteps: [
              "Run the workflow or its equivalent validation after the permission change.",
              "Confirm privileged steps still have the minimum access they need.",
              "Verify untrusted pull request paths no longer reach the risky trigger pattern."
            ]
          },
          patchWarnings: [
            "Targeted review inspected 1 of 3 repository files; full-repo review was not performed."
          ],
          patchability: "patch_candidate",
          prCandidateId: "pr:workflow-hardening:.github/workflows/ci.yml",
          readiness: "ready",
          relatedFindingIds: [
            "review:workflow-permissions:.github/workflows/ci.yml:3-3",
            "review:workflow-trigger-risk:.github/workflows/ci.yml:2-2"
          ],
          riskLevel: "low",
          severity: "high",
          title: "Harden .github/workflows/ci.yml",
          validationNotes: [
            "Validation has not been executed in this step.",
            "Standard validation steps are identified, but warnings reduce confidence for later patch synthesis."
          ],
          validationStatus: "ready_with_warnings",
          writeBackEligibility: {
            approvalRequired: true,
            details: [
              "Workflow trigger-risk findings remain blocked for real write-back because the trigger change is not deterministic enough yet.",
              "Patchability: patch_candidate.",
              "Validation status: ready_with_warnings."
            ],
            status: "blocked",
            summary:
              "Workflow trigger-risk findings remain blocked for real write-back because the trigger change is not deterministic enough yet."
          }
        }
      ],
      ecosystems: [
        {
          ecosystem: "node",
          lockfiles: ["package-lock.json"],
          manifests: ["package.json"],
          packageManagers: ["npm"]
        }
      ],
      fetchedAt: expect.any(String),
      isPartial: true,
      repository: {
        canonicalUrl: "https://github.com/openai/openai-node",
        defaultBranch: "main",
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
          "package.json"
        ],
        totalDirectories: 1,
        totalFiles: 3,
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
      warningDetails: [
        expect.objectContaining({
          code: "REVIEW_SCOPE_LIMITED"
        })
      ],
      warnings: [
        "Targeted review inspected 1 of 3 repository files; full-repo review was not performed."
      ]
    });
    expect(AnalyzeRepoResponseSchema.safeParse(response.body).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it("surfaces executable dependency write-back readiness when lock metadata is deterministic", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          default_branch: "main",
          description: "SDK repository",
          forks_count: 12,
          full_name: "openai/openai-node",
          html_url: "https://github.com/openai/openai-node",
          language: "TypeScript",
          name: "openai-node",
          owner: {
            login: "openai"
          },
          stargazers_count: 42
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          object: {
            sha: "commit-sha",
            type: "commit"
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          tree: {
            sha: "tree-sha"
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          tree: [
            {
              path: "package-lock.json",
              type: "blob"
            },
            {
              path: "package.json",
              type: "blob"
            }
          ],
          truncated: false
        })
      )
      .mockResolvedValueOnce(
        createTextResponse(
          JSON.stringify({
            dependencies: {
              react: {
                version: "19.0.0"
              }
            },
            lockfileVersion: 2,
            packages: {
              "": {
                dependencies: {
                  react: "^19.0.0"
                }
              },
              "node_modules/react": {
                name: "react",
                version: "19.0.0"
              },
              "node_modules/example/node_modules/react": {
                integrity: "sha512-example",
                name: "react",
                resolved: "https://registry.npmjs.org/react/-/react-19.0.1.tgz",
                version: "19.0.1"
              }
            }
          })
        )
      )
      .mockResolvedValueOnce(
        createTextResponse(
          JSON.stringify({
            dependencies: {
              react: "^19.0.0"
            }
          })
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-test-1234",
                  modified: "2026-04-06T11:30:00.000Z"
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: {
                severity: "HIGH"
              },
              package: {
                ecosystem: "npm",
                name: "react"
              },
              ranges: [
                {
                  events: [
                    {
                      introduced: "0"
                    },
                    {
                      fixed: "19.0.1"
                    }
                  ],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GHSA-test-1234",
          references: [
            {
              type: "ADVISORY",
              url: "https://osv.dev/vulnerability/GHSA-test-1234"
            }
          ],
          summary: "React test advisory"
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "github.com/openai/openai-node" });

    expect(response.status).toBe(200);
    expect(response.body.prPatchPlans).toHaveLength(1);
    expect(response.body.prPatchPlans[0]).toMatchObject({
      id: "patch-plan:pr:dependency-upgrade:react",
      prCandidateId: "pr:dependency-upgrade:react",
      writeBackEligibility: {
        approvalRequired: true,
        status: "executable",
        summary: "Eligible for approved deterministic npm dependency write-back."
      }
    });
    expect(response.body.prPatchPlans[0].writeBackEligibility.details).toContain(
      "The change scope is limited to repo-root package.json and package-lock.json."
    );
    expect(response.body.prPatchPlans[0].writeBackEligibility.details).toContain(
      'package-lock.json uses supported lockfileVersion 2 and includes packages[""].'
    );
    expect(response.body.prPatchPlans[0].writeBackEligibility.details).toContain(
      "Existing lockfile metadata for react@19.0.1 was found uniquely and can be copied deterministically."
    );
    expect(AnalyzeRepoResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("returns 400 for invalid repo input", async () => {
    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "not a repo" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      details: null,
      error: "Repository input must be a GitHub URL or owner/repo"
    });
  });

  it("returns 404 when the repository is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse(
          {
            message: "Not Found"
          },
          {
            status: 404
          }
        )
      )
    );

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "openai/missing-repo" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      details: null,
      error: "Repository not found or not publicly accessible"
    });
  });

  it("returns 429 for GitHub rate limiting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse(
          {
            message: "API rate limit exceeded"
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1710000000"
            },
            status: 403
          }
        )
      )
    );

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "openai/openai-node" });

    expect(response.status).toBe(429);
    expect(response.body.error).toBe("GitHub API rate limit exceeded");
    expect(response.body.details).toMatchObject({
      resetAt: expect.any(String)
    });
  });

  it("returns 502 for malformed upstream data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse({
          html_url: "https://github.com/openai/openai-node",
          name: "openai-node"
        })
      )
    );

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "openai/openai-node" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      details: null,
      error: "GitHub returned an unexpected response shape"
    });
  });

  it("returns a successful partial response for truncated trees", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>()
        .mockResolvedValueOnce(
          createJsonResponse({
            default_branch: "main",
            description: "SDK repository",
            forks_count: 12,
            full_name: "openai/openai-node",
            html_url: "https://github.com/openai/openai-node",
            language: "TypeScript",
            name: "openai-node",
            owner: {
              login: "openai"
            },
            stargazers_count: 42
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            object: {
              sha: "commit-sha",
              type: "commit"
            }
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            tree: {
              sha: "tree-sha"
            }
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            tree: [
              {
                path: "package.json",
                type: "blob"
              }
            ],
            truncated: true
          })
        )
        .mockResolvedValueOnce(
          createTextResponse(
            JSON.stringify({
              dependencies: {
                react: "^19.0.0"
              }
            })
          )
        )
    );

    const response = await request(app)
      .post("/api/analyze")
      .send({ repoInput: "openai/openai-node" });

    expect(response.status).toBe(200);
    expect(response.body.isPartial).toBe(true);
    expect(response.body.treeSummary).toEqual({
      samplePaths: ["package.json"],
      totalDirectories: 0,
      totalFiles: 1,
      truncated: true
    });
    expect(response.body.warnings).toEqual([
      "Declaration-only advisory coverage for react in package.json; no exact resolved version was available.",
      "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
      "Manifest without lockfile: package.json",
      "Targeted review did not inspect any files from the 1-file repository snapshot; full-repo review was not performed."
    ]);
    expect(response.body.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DECLARATION_ONLY_VERSION"
        }),
        expect.objectContaining({
          code: "TREE_TRUNCATED"
        }),
        expect.objectContaining({
          code: "MANIFEST_WITHOUT_LOCKFILE"
        })
      ])
    );
    expect(response.body.dependencySnapshot.isPartial).toBe(true);
    expect(response.body.dependencySnapshot.parseWarningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MANIFEST_WITHOUT_LOCKFILE"
        })
      ])
    );
    expect(response.body.dependencySnapshot.parseWarnings).toEqual([
      "Manifest without lockfile: package.json"
    ]);
    expect(response.body.dependencyFindings).toEqual([]);
    expect(response.body.codeReviewFindings).toEqual([]);
    expect(response.body.issueCandidates).toEqual([]);
    expect(response.body.issueCandidateSummary).toEqual({
      bySeverity: {
        critical: 0,
        high: 0,
        info: 0,
        low: 0,
        medium: 0
      },
      byType: [],
      totalCandidates: 0
    });
    expect(response.body.prCandidates).toEqual([]);
    expect(response.body.prCandidateSummary).toEqual({
      byReadiness: [],
      byRiskLevel: [],
      byType: [],
      totalCandidates: 0
    });
    expect(response.body.prPatchPlans).toEqual([]);
    expect(response.body.prPatchPlanSummary).toEqual({
      byPatchability: [],
      byValidationStatus: [],
      totalPatchCandidates: 0,
      totalPlans: 0
    });
    expect(response.body.reviewCoverage).toEqual({
      candidateFileCount: 0,
      isPartial: true,
      reviewedFileCount: 0,
      selectedFileCount: 0,
      selectedPaths: [],
      skippedFileCount: 0,
      skippedPaths: [],
      strategy: "targeted"
    });
    expect(response.body.codeReviewFindingSummary).toEqual({
      findingsBySeverity: {
        critical: 0,
        high: 0,
        info: 0,
        low: 0,
        medium: 0
      },
      isPartial: true,
      reviewedFileCount: 0,
      totalFindings: 0
    });
    expect(response.body.dependencyFindingSummary).toEqual({
      findingsBySeverity: {
        critical: 0,
        high: 0,
        info: 0,
        low: 0,
        medium: 0
      },
      isPartial: true,
      totalFindings: 0,
      vulnerableDirectCount: 0,
      vulnerableTransitiveCount: 0
    });
    expect(AnalyzeRepoResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
