export type PersistenceErrorCode =
  | "invalid_run_id"
  | "invalid_plan_id"
  | "invalid_job_id"
  | "invalid_tracked_repository_id"
  | "not_found"
  | "conflict";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export function isPersistenceError(error: unknown): error is PersistenceError {
  return error instanceof PersistenceError;
}
