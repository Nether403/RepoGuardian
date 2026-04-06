import { describe, expect, it } from "vitest";
import {
  createTreePayload,
  mapGitHubCommitResponse,
  mapGitHubRefResponse,
  mapGitHubRepositoryResponse,
  mapGitHubTreeResponse
} from "../mappers.js";

describe("GitHub response mappers", () => {
  it("maps repository metadata from GitHub", () => {
    expect(
      mapGitHubRepositoryResponse({
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
    ).toEqual({
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
    });
  });

  it("maps ref and commit payloads into SHAs", () => {
    expect(
      mapGitHubRefResponse({
        object: {
          sha: "commit-sha",
          type: "commit"
        }
      })
    ).toEqual({ commitSha: "commit-sha" });

    expect(
      mapGitHubCommitResponse({
        tree: {
          sha: "tree-sha"
        }
      })
    ).toEqual({ treeSha: "tree-sha" });
  });

  it("maps and summarizes recursive tree entries", () => {
    const result = mapGitHubTreeResponse({
      tree: [
        {
          path: "packages",
          type: "tree"
        },
        {
          path: "package.json",
          type: "blob"
        },
        {
          path: "vendor/submodule",
          type: "commit"
        }
      ],
      truncated: true
    });

    expect(result.entries).toEqual([
      {
        kind: "file",
        path: "package.json"
      },
      {
        kind: "directory",
        path: "packages"
      },
      {
        kind: "submodule",
        path: "vendor/submodule"
      }
    ]);
    expect(result.summary).toEqual({
      directoryCount: 1,
      entryCount: 3,
      fileCount: 1,
      submoduleCount: 1,
      truncated: true
    });
  });

  it("creates a capped payload and marks it partial", () => {
    const payload = createTreePayload(
      [
        {
          kind: "file",
          path: "a.ts"
        },
        {
          kind: "file",
          path: "b.ts"
        }
      ],
      {
        directoryCount: 0,
        entryCount: 2,
        fileCount: 2,
        submoduleCount: 0,
        truncated: false
      },
      1
    );

    expect(payload).toEqual({
      entries: [
        {
          kind: "file",
          path: "a.ts"
        }
      ],
      isPartial: true,
      warnings: [
        "Returned the first 1 tree entries to keep the payload UI-friendly."
      ]
    });
  });
});
