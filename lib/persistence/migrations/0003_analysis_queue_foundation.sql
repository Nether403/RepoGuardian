CREATE TABLE IF NOT EXISTS tracked_repositories (
  tracked_repository_id TEXT PRIMARY KEY,
  repository_full_name TEXT NOT NULL UNIQUE,
  repository_owner TEXT NOT NULL,
  repository_repo TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  label TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_queued_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_tracked_repositories_active_updated_at
  ON tracked_repositories (is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  job_id TEXT PRIMARY KEY,
  job_kind TEXT NOT NULL CHECK (job_kind IN ('analyze_repository')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  repo_input TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  tracked_repository_id TEXT NULL REFERENCES tracked_repositories(tracked_repository_id) ON DELETE SET NULL,
  requested_by_user_id TEXT NULL,
  label TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  run_id TEXT NULL REFERENCES analysis_runs(run_id) ON DELETE SET NULL,
  error_message TEXT NULL,
  queued_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_queued_at
  ON analysis_jobs (status, queued_at ASC);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_queued_at
  ON analysis_jobs (repository_full_name, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_tracked_repository_queued_at
  ON analysis_jobs (tracked_repository_id, queued_at DESC)
  WHERE tracked_repository_id IS NOT NULL;
