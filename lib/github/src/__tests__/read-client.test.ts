import { describe, expect, it, vi } from "vitest";
import { GitHubReadClient } from "../read-client.js";
import { normalizeRepoInput } from "../repo-input.js";

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: init?.status ?? 200,
    ...(init ?? {})
  });
}

describe("GitHubReadClient", () => {
  it("fetches repository intake with capped tree entries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          default_branch: "main",
          description: null,
          forks_count: 3,
          full_name: "openai/openai-node",
          html_url: "https://github.com/openai/openai-node",
          language: "TypeScript",
          name: "openai-node",
          owner: {
            login: "openai"
          },
          stargazers_count: 11
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
            },
            {
              path: "src",
              type: "tree"
            }
          ],
          truncated: false
        })
      );

    const client = new GitHubReadClient({ fetchImpl: fetchMock });
    const result = await client.fetchRepositoryIntake(
      normalizeRepoInput("openai/openai-node"),
      {
        maxTreeEntries: 1
      }
    );

    expect(result.isPartial).toBe(true);
    expect(result.treeSummary.entryCount).toBe(2);
    expect(result.treeEntries).toHaveLength(1);
    expect(result.warnings).toEqual([
      "Returned the first 1 tree entries to keep the payload UI-friendly."
    ]);
  });

  it("throws a not_found error for missing repositories", async () => {
    const client = new GitHubReadClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse(
          {
            message: "Not Found"
          },
          {
            status: 404
          }
        )
      )
    });

    await expect(
      client.fetchRepositoryIntake(normalizeRepoInput("openai/missing"))
    ).rejects.toMatchObject({
      code: "not_found"
    });
  });

  it("throws a rate_limited error when GitHub reports exhausted quota", async () => {
    const client = new GitHubReadClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse(
          {
            message: "rate limit"
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
    });

    await expect(
      client.fetchRepositoryIntake(normalizeRepoInput("openai/openai-node"))
    ).rejects.toMatchObject({
      code: "rate_limited",
      details: {
        resetAt: expect.any(String)
      }
    });
  });

  it("throws an upstream_invalid_response error for malformed GitHub data", async () => {
    const client = new GitHubReadClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse({
          default_branch: "main"
        })
      )
    });

    await expect(
      client.fetchRepositoryIntake(normalizeRepoInput("openai/openai-node"))
    ).rejects.toMatchObject({
      code: "upstream_invalid_response"
    });
  });

  it("throws a network_error when fetch fails", async () => {
    const client = new GitHubReadClient({
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("boom"))
    });

    await expect(
      client.fetchRepositoryIntake(normalizeRepoInput("openai/openai-node"))
    ).rejects.toMatchObject({
      code: "network_error"
    });
  });
});
