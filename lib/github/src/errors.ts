export type GitHubReadErrorCode =
  | "invalid_repo_input"
  | "network_error"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "upstream_invalid_response";

type GitHubReadErrorOptions = {
  cause?: unknown;
  details?: Record<string, string | number | boolean | null>;
};

export class GitHubReadError extends Error {
  readonly code: GitHubReadErrorCode;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: GitHubReadErrorCode,
    message: string,
    options?: GitHubReadErrorOptions
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "GitHubReadError";
    this.code = code;
    this.details = options?.details;
  }
}

export function isGitHubReadError(error: unknown): error is GitHubReadError {
  return error instanceof GitHubReadError;
}
