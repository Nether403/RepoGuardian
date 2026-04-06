import {
  type NormalizedRepoInput,
  NormalizedRepoInputSchema
} from "@repo-guardian/shared-types";
import { GitHubReadError } from "./errors.js";

const githubHosts = new Set(["github.com", "www.github.com"]);

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

export function buildCanonicalGitHubUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

export function normalizeRepoSegments(
  owner: string,
  repo: string
): NormalizedRepoInput {
  const normalizedOwner = owner.trim().replace(/^\/+|\/+$/g, "");
  const normalizedRepo = stripGitSuffix(repo.trim().replace(/^\/+|\/+$/g, ""));

  if (!normalizedOwner || !normalizedRepo || normalizedRepo.includes("/")) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository input must resolve to owner/repo"
    );
  }

  return NormalizedRepoInputSchema.parse({
    owner: normalizedOwner,
    repo: normalizedRepo,
    fullName: `${normalizedOwner}/${normalizedRepo}`,
    canonicalUrl: buildCanonicalGitHubUrl(normalizedOwner, normalizedRepo)
  });
}

function normalizeUrlInput(input: string): NormalizedRepoInput {
  const urlLikeInput =
    input.startsWith("http://") || input.startsWith("https://")
      ? input
      : `https://${input}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlLikeInput);
  } catch (error) {
    throw new GitHubReadError("invalid_repo_input", "Repository input is not a valid GitHub URL", {
      cause: error
    });
  }

  if (!githubHosts.has(parsedUrl.hostname.toLowerCase())) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository input must point to github.com"
    );
  }

  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository URL must include owner and repo"
    );
  }

  const owner = segments.at(0);
  const repo = segments.at(1);

  if (!owner || !repo) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository URL must include owner and repo"
    );
  }

  return normalizeRepoSegments(owner, repo);
}

export function normalizeRepoInput(input: string): NormalizedRepoInput {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository input is required"
    );
  }

  if (
    trimmedInput.includes("://") ||
    trimmedInput.startsWith("github.com/") ||
    trimmedInput.startsWith("www.github.com/")
  ) {
    return normalizeUrlInput(trimmedInput);
  }

  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(trimmedInput);

  if (!match) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository input must be a GitHub URL or owner/repo"
    );
  }

  const owner = match[1];
  const repo = match[2];

  if (!owner || !repo) {
    throw new GitHubReadError(
      "invalid_repo_input",
      "Repository input must be a GitHub URL or owner/repo"
    );
  }

  return normalizeRepoSegments(owner, repo);
}
