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
      ecosystems: [
        {
          ecosystem: "node",
          lockfiles: ["package-lock.json"],
          manifests: ["package.json"],
          packageManagers: ["npm"]
        }
      ],
      fetchedAt: expect.any(String),
      isPartial: false,
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
      warnings: []
    });
    expect(AnalyzeRepoResponseSchema.safeParse(response.body).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
      "GitHub returned a truncated recursive tree; the repository snapshot is partial.",
      "Manifest without lockfile: package.json"
    ]);
    expect(AnalyzeRepoResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
