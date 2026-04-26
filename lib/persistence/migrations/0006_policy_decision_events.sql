CREATE TABLE IF NOT EXISTS policy_decision_events (
  policy_decision_event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  actor_user_id TEXT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL,
  repository_full_name TEXT NULL,
  run_id TEXT NULL REFERENCES analysis_runs(run_id) ON DELETE SET NULL,
  plan_id TEXT NULL REFERENCES execution_plans(plan_id) ON DELETE SET NULL,
  job_id TEXT NULL REFERENCES analysis_jobs(job_id) ON DELETE SET NULL,
  sweep_schedule_id TEXT NULL REFERENCES sweep_schedules(schedule_id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'analyze_repository',
    'schedule_sweep',
    'generate_pr_candidates',
    'execute_write'
  )),
  decision TEXT NOT NULL CHECK (decision IN (
    'allowed',
    'denied',
    'manual_review'
  )),
  scope_type TEXT NOT NULL CHECK (scope_type IN (
    'workspace',
    'installation',
    'repository'
  )),
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_decision_events_workspace_created_at
  ON policy_decision_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_decision_events_workspace_action_created_at
  ON policy_decision_events (workspace_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_decision_events_workspace_repository_created_at
  ON policy_decision_events (workspace_id, repository_full_name, created_at DESC)
  WHERE repository_full_name IS NOT NULL;
