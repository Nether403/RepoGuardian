import {
  RepositoryIntakeSnapshotSchema,
  type RepositoryIntakeSnapshot,
  type NormalizedRepoInput
} from "@repo-guardian/shared-types";
import { ZodError } from "zod";
import { GitHubReadError } from "./errors.js";
import {
  createTreePayload,
  mapGitHubCommitResponse,
  mapGitHubRefResponse,
  mapGitHubRepositoryResponse,
  mapGitHubTreeResponse
} from "./mappers.js";

type GitHubReadClientOptions = {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  token?: string;
  userAgent?: string;
};

type FetchJsonOptions = {
  accept?: string;
};

export class GitHubReadClient {
  private readonly apiBaseUrl: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly token?: string;
  private readonly userAgent: string;

  constructor(options: GitHubReadClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.fetchImpl = options.fetchImpl;
    this.token = options.token;
    this.userAgent = options.userAgent ?? "repo-guardian";
  }

  async fetchRepositoryIntake(
    input: NormalizedRepoInput,
    options: { maxTreeEntries?: number } = {}
  ): Promise<RepositoryIntakeSnapshot> {
    try {
      const repositoryPayload = await this.fetchJson(
        `/repos/${input.owner}/${input.repo}`
      );
      const repository = mapGitHubRepositoryResponse(repositoryPayload);

      const refPayload = await this.fetchJson(
        `/repos/${repository.owner}/${repository.repo}/git/ref/heads/${encodeURIComponent(
          repository.defaultBranch
        )}`
      );
      const { commitSha } = mapGitHubRefResponse(refPayload);

      const commitPayload = await this.fetchJson(
        `/repos/${repository.owner}/${repository.repo}/git/commits/${commitSha}`
      );
      const { treeSha } = mapGitHubCommitResponse(commitPayload);

      const treePayload = await this.fetchJson(
        `/repos/${repository.owner}/${repository.repo}/git/trees/${treeSha}?recursive=1`
      );
      const { entries, summary } = mapGitHubTreeResponse(treePayload);
      const tree = createTreePayload(entries, summary, options.maxTreeEntries ?? 5000);

      return RepositoryIntakeSnapshotSchema.parse({
        repository,
        treeSummary: summary,
        treeEntries: tree.entries,
        warnings: tree.warnings,
        fetchedAt: new Date().toISOString(),
        isPartial: tree.isPartial
      });
    } catch (error) {
      if (error instanceof GitHubReadError) {
        throw error;
      }

      if (error instanceof ZodError) {
        throw new GitHubReadError(
          "upstream_invalid_response",
          "GitHub returned an unexpected response shape",
          {
            cause: error
          }
        );
      }

      throw new GitHubReadError(
        "network_error",
        "Failed to reach the GitHub API",
        {
          cause: error
        }
      );
    }
  }

  private async fetchJson(path: string, options: FetchJsonOptions = {}): Promise<unknown> {
    const fetchImpl = this.fetchImpl ?? fetch;

    let response: Response;

    try {
      response = await fetchImpl(`${this.apiBaseUrl}${path}`, {
        headers: this.buildHeaders(options.accept)
      });
    } catch (error) {
      throw new GitHubReadError("network_error", "Failed to reach the GitHub API", {
        cause: error
      });
    }

    if (!response.ok) {
      await this.throwForResponse(response);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new GitHubReadError(
        "upstream_invalid_response",
        "GitHub returned invalid JSON",
        {
          cause: error
        }
      );
    }
  }

  private buildHeaders(accept = "application/vnd.github+json"): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async throwForResponse(response: Response): Promise<never> {
    if (response.status === 404) {
      throw new GitHubReadError(
        "not_found",
        "Repository not found or not publicly accessible"
      );
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");

    if (
      response.status === 429 ||
      ((response.status === 403 || response.status === 429) &&
        (remaining === "0" || reset !== null))
    ) {
      throw new GitHubReadError("rate_limited", "GitHub API rate limit exceeded", {
        details: {
          resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null
        }
      });
    }

    const body = await response.text().catch(() => "");

    throw new GitHubReadError(
      "upstream_error",
      `GitHub API request failed with status ${response.status}`,
      {
        details: {
          body: body || null,
          status: response.status
        }
      }
    );
  }
}
