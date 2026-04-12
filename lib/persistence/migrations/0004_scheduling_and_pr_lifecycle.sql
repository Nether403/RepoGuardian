CREATE TABLE IF NOT EXISTS sweep_schedules (
  schedule_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly')),
  selection_strategy TEXT NOT NULL CHECK (selection_strategy IN ('all_executable_prs')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sweep_schedules_active_next_run
  ON sweep_schedules (is_active, next_run_at ASC);

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS scheduled_sweep_id TEXT NULL REFERENCES sweep_schedules(schedule_id) ON DELETE SET NULL;

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS plan_id TEXT NULL REFERENCES execution_plans(plan_id) ON DELETE SET NULL;

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS job_payload JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE analysis_jobs
  DROP CONSTRAINT IF EXISTS analysis_jobs_job_kind_check;

ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_job_kind_check
  CHECK (job_kind IN ('analyze_repository', 'generate_execution_plan', 'run_scheduled_sweep'));

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_scheduled_sweep_queued_at
  ON analysis_jobs (scheduled_sweep_id, queued_at DESC)
  WHERE scheduled_sweep_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_plan_id
  ON analysis_jobs (plan_id)
  WHERE plan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tracked_pull_requests (
  tracked_pull_request_id TEXT PRIMARY KEY,
  repository_full_name TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_repo TEXT NOT NULL,
  pull_request_number INTEGER NOT NULL,
  pull_request_url TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  title TEXT NOT NULL,
  plan_id TEXT NULL REFERENCES execution_plans(plan_id) ON DELETE SET NULL,
  execution_id TEXT NULL REFERENCES execution_attempts(execution_id) ON DELETE SET NULL,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('open', 'closed', 'merged')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NULL,
  merged_at TIMESTAMPTZ NULL,
  UNIQUE (repository_full_name, pull_request_number)
);

CREATE INDEX IF NOT EXISTS idx_tracked_pull_requests_repository_updated_at
  ON tracked_pull_requests (repository_full_name, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracked_pull_requests_lifecycle_status
  ON tracked_pull_requests (lifecycle_status, updated_at DESC);
