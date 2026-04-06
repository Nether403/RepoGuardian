import type { RepositoryMetadata } from "@repo-guardian/shared-types";
import { z } from "zod";
import { GitHubWriteError } from "./errors.js";
import { mapGitHubCommitResponse, mapGitHubRefResponse } from "./mappers.js";

type GitHubWriteClientOptions = {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  token?: string;
  userAgent?: string;
};

type RepositoryRef = Pick<
  RepositoryMetadata,
  "defaultBranch" | "owner" | "repo"
>;

type FileCommitChange = {
  content: string;
  path: string;
};

type CreateIssueRequest = {
  body: string;
  labels?: string[];
  repository: Pick<RepositoryMetadata, "owner" | "repo">;
  title: string;
};

type CreateBranchRequest = {
  branchName: string;
  repository: RepositoryRef;
};

type CommitFileChangesRequest = {
  branchName: string;
  commitMessage: string;
  fileChanges: FileCommitChange[];
  repository: Pick<RepositoryMetadata, "owner" | "repo">;
};

type CreatePullRequestRequest = {
  baseBranch: string;
  body: string;
  headBranch: string;
  repository: Pick<RepositoryMetadata, "owner" | "repo">;
  title: string;
};

const issueResponseSchema = z.object({
  html_url: z.string().url(),
  number: z.number().int().positive(),
  url: z.string().url()
});

const pullRequestResponseSchema = issueResponseSchema;

const treeResponseSchema = z.object({
  sha: z.string().min(1)
});

const commitResponseSchema = z.object({
  sha: z.string().min(1)
});

function encodeRef(ref: string): string {
  return encodeURIComponent(ref);
}

export class GitHubWriteClient {
  private readonly apiBaseUrl: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly token?: string;
  private readonly userAgent: string;

  constructor(options: GitHubWriteClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.fetchImpl = options.fetchImpl;
    this.token = options.token;
    this.userAgent = options.userAgent ?? "repo-guardian";
  }

  async createIssue(
    request: CreateIssueRequest
  ): Promise<{ issueNumber: number; issueUrl: string }> {
    const payload = await this.sendJson(
      "POST",
      `/repos/${request.repository.owner}/${request.repository.repo}/issues`,
      {
        body: request.body,
        labels:
          request.labels && request.labels.length > 0 ? request.labels : undefined,
        title: request.title
      }
    );
    const issue = this.parseResponse(issueResponseSchema, payload);

    return {
      issueNumber: issue.number,
      issueUrl: issue.html_url
    };
  }

  async createBranchFromDefaultBranch(
    request: CreateBranchRequest
  ): Promise<{ baseCommitSha: string; branchName: string }> {
    const baseCommitSha = await this.fetchBranchHeadSha(
      request.repository,
      request.repository.defaultBranch
    );

    await this.sendJson(
      "POST",
      `/repos/${request.repository.owner}/${request.repository.repo}/git/refs`,
      {
        ref: `refs/heads/${request.branchName}`,
        sha: baseCommitSha
      }
    );

    return {
      baseCommitSha,
      branchName: request.branchName
    };
  }

  async commitFileChanges(
    request: CommitFileChangesRequest
  ): Promise<{ branchName: string; commitSha: string }> {
    const parentCommitSha = await this.fetchBranchHeadSha(
      request.repository,
      request.branchName
    );
    const parentCommitPayload = await this.fetchJson(
      `/repos/${request.repository.owner}/${request.repository.repo}/git/commits/${parentCommitSha}`
    );
    const { treeSha: baseTreeSha } = mapGitHubCommitResponse(parentCommitPayload);
    const treePayload = await this.sendJson(
      "POST",
      `/repos/${request.repository.owner}/${request.repository.repo}/git/trees`,
      {
        base_tree: baseTreeSha,
        tree: request.fileChanges.map((change) => ({
          content: change.content,
          mode: "100644",
          path: change.path,
          type: "blob"
        }))
      }
    );
    const tree = this.parseResponse(treeResponseSchema, treePayload);
    const commitPayload = await this.sendJson(
      "POST",
      `/repos/${request.repository.owner}/${request.repository.repo}/git/commits`,
      {
        message: request.commitMessage,
        parents: [parentCommitSha],
        tree: tree.sha
      }
    );
    const commit = this.parseResponse(commitResponseSchema, commitPayload);

    await this.sendJson(
      "PATCH",
      `/repos/${request.repository.owner}/${request.repository.repo}/git/refs/heads/${encodeRef(
        request.branchName
      )}`,
      {
        force: false,
        sha: commit.sha
      }
    );

    return {
      branchName: request.branchName,
      commitSha: commit.sha
    };
  }

  async openPullRequest(
    request: CreatePullRequestRequest
  ): Promise<{ pullRequestNumber: number; pullRequestUrl: string }> {
    const payload = await this.sendJson(
      "POST",
      `/repos/${request.repository.owner}/${request.repository.repo}/pulls`,
      {
        base: request.baseBranch,
        body: request.body,
        head: request.headBranch,
        title: request.title
      }
    );
    const pullRequest = this.parseResponse(pullRequestResponseSchema, payload);

    return {
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url
    };
  }

  private async fetchBranchHeadSha(
    repository: Pick<RepositoryMetadata, "owner" | "repo">,
    branch: string
  ): Promise<string> {
    const payload = await this.fetchJson(
      `/repos/${repository.owner}/${repository.repo}/git/ref/heads/${encodeRef(branch)}`
    );
    const { commitSha } = mapGitHubRefResponse(payload);

    return commitSha;
  }

  private parseResponse<T extends z.ZodTypeAny>(
    schema: T,
    payload: unknown
  ): z.infer<T> {
    try {
      return schema.parse(payload);
    } catch (error) {
      throw new GitHubWriteError(
        "upstream_invalid_response",
        "GitHub returned an unexpected write response shape",
        {
          cause: error
        }
      );
    }
  }

  private async fetchJson(path: string): Promise<unknown> {
    const fetchImpl = this.fetchImpl ?? fetch;

    let response: Response;

    try {
      response = await fetchImpl(`${this.apiBaseUrl}${path}`, {
        headers: this.buildHeaders()
      });
    } catch (error) {
      throw new GitHubWriteError("network_error", "Failed to reach the GitHub API", {
        cause: error
      });
    }

    if (!response.ok) {
      await this.throwForResponse(response);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new GitHubWriteError(
        "upstream_invalid_response",
        "GitHub returned invalid JSON",
        {
          cause: error
        }
      );
    }
  }

  private async sendJson(
    method: "PATCH" | "POST",
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const fetchImpl = this.fetchImpl ?? fetch;

    let response: Response;

    try {
      response = await fetchImpl(`${this.apiBaseUrl}${path}`, {
        body: JSON.stringify(body),
        headers: {
          ...this.buildHeaders(),
          "Content-Type": "application/json"
        },
        method
      });
    } catch (error) {
      throw new GitHubWriteError("network_error", "Failed to reach the GitHub API", {
        cause: error
      });
    }

    if (!response.ok) {
      await this.throwForResponse(response);
    }

    if (response.status === 204) {
      return {};
    }

    try {
      return await response.json();
    } catch (error) {
      throw new GitHubWriteError(
        "upstream_invalid_response",
        "GitHub returned invalid JSON",
        {
          cause: error
        }
      );
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async throwForResponse(response: Response): Promise<never> {
    if (response.status === 401) {
      throw new GitHubWriteError(
        "unauthorized",
        "GitHub rejected the write request credentials"
      );
    }

    if (response.status === 404) {
      throw new GitHubWriteError(
        "not_found",
        "Repository not found or write target is unavailable"
      );
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");

    if (
      response.status === 429 ||
      ((response.status === 403 || response.status === 429) &&
        (remaining === "0" || reset !== null))
    ) {
      throw new GitHubWriteError("rate_limited", "GitHub API rate limit exceeded", {
        details: {
          resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null
        }
      });
    }

    const body = await response.text().catch(() => "");

    throw new GitHubWriteError(
      "upstream_error",
      `GitHub API write request failed with status ${response.status}`,
      {
        details: {
          body: body || null,
          status: response.status
        }
      }
    );
  }
}
