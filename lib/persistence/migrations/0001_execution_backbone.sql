CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  run_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  label TEXT NULL,
  repository_full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  total_findings INTEGER NOT NULL,
  high_severity_findings INTEGER NOT NULL,
  issue_candidates INTEGER NOT NULL,
  pr_candidates INTEGER NOT NULL,
  executable_patch_plans INTEGER NOT NULL,
  blocked_patch_plans INTEGER NOT NULL,
  analysis_payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_repository_created_at
  ON analysis_runs (repository_full_name, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_plans (
  plan_id TEXT PRIMARY KEY,
  plan_hash TEXT NOT NULL,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(run_id) ON DELETE CASCADE,
  repository_full_name TEXT NOT NULL,
  repository_owner TEXT NOT NULL,
  repository_repo TEXT NOT NULL,
  repository_default_branch TEXT NOT NULL,
  actor_user_id TEXT NULL,
  selected_issue_candidate_ids JSONB NOT NULL,
  selected_pr_candidate_ids JSONB NOT NULL,
  approval_required BOOLEAN NOT NULL,
  approval_confirmation_text TEXT NOT NULL,
  approval_status TEXT NOT NULL CHECK (approval_status IN ('required', 'not_required', 'granted', 'denied')),
  approval_notes JSONB NOT NULL,
  approval_verified_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'executing', 'completed', 'failed', 'expired', 'cancelled')),
  summary_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_plans_analysis_run_created_at
  ON execution_plans (analysis_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_plans_repository_created_at
  ON execution_plans (repository_full_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_plans_planned_expiry
  ON execution_plans (expires_at)
  WHERE status = 'planned';

CREATE TABLE IF NOT EXISTS execution_plan_actions (
  plan_id TEXT NOT NULL REFERENCES execution_plans(plan_id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,
  action_index INTEGER NOT NULL,
  action_payload JSONB NOT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (plan_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_plan_actions_plan_order
  ON execution_plan_actions (plan_id, action_index);

CREATE TABLE IF NOT EXISTS execution_attempts (
  execution_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL UNIQUE REFERENCES execution_plans(plan_id) ON DELETE CASCADE,
  actor_user_id TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('executing', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS execution_audit_events (
  event_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES execution_plans(plan_id) ON DELETE CASCADE,
  execution_id TEXT NULL REFERENCES execution_attempts(execution_id) ON DELETE SET NULL,
  action_id TEXT NULL,
  event_type TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  actor_user_id TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_audit_events_plan_created_at
  ON execution_audit_events (plan_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_execution_audit_events_repository_created_at
  ON execution_audit_events (repository_full_name, created_at DESC);
