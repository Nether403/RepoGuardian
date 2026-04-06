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

  it("returns the Milestone 1 analysis payload", async () => {
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
