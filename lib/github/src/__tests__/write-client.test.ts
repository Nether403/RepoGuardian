import { describe, expect, it, vi } from "vitest";
import { GitHubWriteClient } from "../write-client.js";

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: init?.status ?? 200,
    ...(init ?? {})
  });
}

describe("GitHubWriteClient", () => {
  it("creates issues, branches, commits file changes, and opens pull requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          html_url: "https://github.com/openai/openai-node/issues/10",
          number: 10,
          url: "https://api.github.com/repos/openai/openai-node/issues/10"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          object: {
            sha: "base-commit-sha",
            type: "commit"
          }
        })
      )
      .mockResolvedValueOnce(createJsonResponse({ ref: "refs/heads/test-branch" }, { status: 201 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          object: {
            sha: "base-commit-sha",
            type: "commit"
          }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          tree: {
            sha: "base-tree-sha"
          }
        })
      )
      .mockResolvedValueOnce(createJsonResponse({ sha: "new-tree-sha" }, { status: 201 }))
      .mockResolvedValueOnce(createJsonResponse({ sha: "new-commit-sha" }, { status: 201 }))
      .mockResolvedValueOnce(createJsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          html_url: "https://github.com/openai/openai-node/pull/25",
          number: 25,
          url: "https://api.github.com/repos/openai/openai-node/pulls/25"
        })
      );

    const client = new GitHubWriteClient({ fetchImpl: fetchMock });

    await expect(
      client.createIssue({
        body: "issue body",
        repository: {
          owner: "openai",
          repo: "openai-node"
        },
        title: "Create issue"
      })
    ).resolves.toEqual({
      issueNumber: 10,
      issueUrl: "https://github.com/openai/openai-node/issues/10"
    });

    await expect(
      client.createBranchFromDefaultBranch({
        branchName: "repo-guardian/test-branch",
        repository: {
          defaultBranch: "main",
          owner: "openai",
          repo: "openai-node"
        }
      })
    ).resolves.toEqual({
      baseCommitSha: "base-commit-sha",
      branchName: "repo-guardian/test-branch"
    });

    await expect(
      client.commitFileChanges({
        branchName: "repo-guardian/test-branch",
        commitMessage: "commit message",
        fileChanges: [
          {
            content: "name: CI\npermissions:\n  contents: read\n",
            path: ".github/workflows/ci.yml"
          }
        ],
        repository: {
          owner: "openai",
          repo: "openai-node"
        }
      })
    ).resolves.toEqual({
      branchName: "repo-guardian/test-branch",
      commitSha: "new-commit-sha"
    });

    await expect(
      client.openPullRequest({
        baseBranch: "main",
        body: "pr body",
        headBranch: "repo-guardian/test-branch",
        repository: {
          owner: "openai",
          repo: "openai-node"
        },
        title: "Open PR"
      })
    ).resolves.toEqual({
      pullRequestNumber: 25,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/25"
    });
  });

  it("surfaces GitHub write errors", async () => {
    const client = new GitHubWriteClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValueOnce(
        createJsonResponse(
          {
            message: "Bad credentials"
          },
          {
            status: 401
          }
        )
      )
    });

    await expect(
      client.createIssue({
        body: "issue body",
        repository: {
          owner: "openai",
          repo: "openai-node"
        },
        title: "Create issue"
      })
    ).rejects.toMatchObject({
      code: "unauthorized"
    });
  });
});
