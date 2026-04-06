import {
  type RepositoryMetadata,
  type RepositoryTreeEntry,
  type RepositoryTreeSummary
} from "@repo-guardian/shared-types";
import { z } from "zod";

const gitHubRepositoryResponseSchema = z.object({
  default_branch: z.string().min(1),
  description: z.string().nullable(),
  forks_count: z.number().int().nonnegative(),
  full_name: z.string().min(3),
  html_url: z.string().url(),
  language: z.string().nullable(),
  name: z.string().min(1),
  owner: z.object({
    login: z.string().min(1)
  }),
  stargazers_count: z.number().int().nonnegative()
});

const gitHubTreeEntryResponseSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["blob", "commit", "tree"])
});

const gitHubTreeResponseSchema = z.object({
  tree: z.array(gitHubTreeEntryResponseSchema),
  truncated: z.boolean()
});

const gitHubRefResponseSchema = z.object({
  object: z.object({
    sha: z.string().min(1),
    type: z.literal("commit")
  })
});

const gitHubCommitResponseSchema = z.object({
  tree: z.object({
    sha: z.string().min(1)
  })
});

type GitHubTreeEntryKind = RepositoryTreeEntry["kind"];

export function mapGitHubRepositoryResponse(payload: unknown): RepositoryMetadata {
  const repository = gitHubRepositoryResponseSchema.parse(payload);

  return {
    owner: repository.owner.login,
    repo: repository.name,
    canonicalUrl: `https://github.com/${repository.owner.login}/${repository.name}`,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    description: repository.description,
    primaryLanguage: repository.language,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    htmlUrl: repository.html_url
  };
}

export function mapGitHubRefResponse(payload: unknown): { commitSha: string } {
  const ref = gitHubRefResponseSchema.parse(payload);

  return {
    commitSha: ref.object.sha
  };
}

export function mapGitHubCommitResponse(payload: unknown): { treeSha: string } {
  const commit = gitHubCommitResponseSchema.parse(payload);

  return {
    treeSha: commit.tree.sha
  };
}

function mapGitHubTreeEntryKind(kind: "blob" | "commit" | "tree"): GitHubTreeEntryKind {
  switch (kind) {
    case "blob":
      return "file";
    case "commit":
      return "submodule";
    case "tree":
      return "directory";
  }
}

export function mapGitHubTreeResponse(payload: unknown): {
  entries: RepositoryTreeEntry[];
  summary: RepositoryTreeSummary;
} {
  const tree = gitHubTreeResponseSchema.parse(payload);

  const entries = tree.tree
    .map((entry) => ({
      kind: mapGitHubTreeEntryKind(entry.type),
      path: entry.path
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const summary: RepositoryTreeSummary = {
    entryCount: entries.length,
    fileCount: entries.filter((entry) => entry.kind === "file").length,
    directoryCount: entries.filter((entry) => entry.kind === "directory").length,
    submoduleCount: entries.filter((entry) => entry.kind === "submodule").length,
    truncated: tree.truncated
  };

  return {
    entries,
    summary
  };
}

export function createTreePayload(
  entries: RepositoryTreeEntry[],
  summary: RepositoryTreeSummary,
  maxEntries: number
): {
  entries: RepositoryTreeEntry[];
  isPartial: boolean;
  warnings: string[];
} {
  const safeMaxEntries = Math.max(1, maxEntries);
  const limitedEntries = entries.slice(0, safeMaxEntries);
  const payloadCapped = limitedEntries.length < entries.length;
  const warnings: string[] = [];

  if (summary.truncated) {
    warnings.push(
      "GitHub returned a truncated recursive tree; the repository snapshot is partial."
    );
  }

  if (payloadCapped) {
    warnings.push(
      `Returned the first ${safeMaxEntries} tree entries to keep the payload UI-friendly.`
    );
  }

  return {
    entries: limitedEntries,
    isPartial: summary.truncated || payloadCapped,
    warnings
  };
}
