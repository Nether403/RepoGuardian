CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  github_user_id BIGINT NOT NULL UNIQUE,
  github_login TEXT NOT NULL UNIQUE,
  display_name TEXT NULL,
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  membership_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'maintainer', 'reviewer', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS github_installations (
  installation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  github_installation_id BIGINT NOT NULL UNIQUE,
  target_type TEXT NOT NULL CHECK (target_type IN ('Organization', 'User')),
  target_id BIGINT NOT NULL,
  target_login TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
  permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  repository_selection TEXT NOT NULL CHECK (repository_selection IN ('all', 'selected')),
  installed_at TIMESTAMPTZ NOT NULL,
  suspended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS github_installation_repositories (
  installation_repository_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES github_installations(installation_id) ON DELETE CASCADE,
  repository_node_id TEXT NULL,
  github_repository_id BIGINT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  full_name TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  default_branch TEXT NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_selected BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (installation_id, github_repository_id)
);

INSERT INTO workspaces (
  workspace_id,
  name,
  slug,
  is_default,
  created_at,
  updated_at
)
VALUES (
  'workspace_local_default',
  'Local Workspace',
  'local-workspace',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO users (
  user_id,
  github_user_id,
  github_login,
  display_name,
  avatar_url,
  created_at,
  updated_at
)
VALUES (
  'usr_local_default',
  0,
  'local-dev',
  'Local Dev',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO workspace_memberships (
  membership_id,
  workspace_id,
  user_id,
  role,
  created_at,
  updated_at
)
VALUES (
  'membership_local_default',
  'workspace_local_default',
  'usr_local_default',
  'owner',
  NOW(),
  NOW()
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

ALTER TABLE execution_plans
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE execution_plans
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

ALTER TABLE execution_attempts
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;

ALTER TABLE execution_audit_events
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE execution_audit_events
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

ALTER TABLE tracked_repositories
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE tracked_repositories
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;
ALTER TABLE tracked_repositories
  ADD COLUMN IF NOT EXISTS installation_repository_id TEXT NULL REFERENCES github_installation_repositories(installation_repository_id) ON DELETE SET NULL;
ALTER TABLE tracked_repositories
  DROP CONSTRAINT IF EXISTS tracked_repositories_repository_full_name_key;

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

ALTER TABLE sweep_schedules
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE sweep_schedules
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

ALTER TABLE tracked_pull_requests
  ADD COLUMN IF NOT EXISTS workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT;
ALTER TABLE tracked_pull_requests
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT NULL REFERENCES github_installations(installation_id) ON DELETE SET NULL;

UPDATE analysis_runs
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE execution_plans
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE execution_attempts
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE execution_audit_events
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE tracked_repositories
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE analysis_jobs
SET
  workspace_id = 'workspace_local_default',
  requested_by_user_id = CASE
    WHEN requested_by_user_id IS NULL THEN NULL
    ELSE 'usr_local_default'
  END
WHERE workspace_id IS NULL
   OR requested_by_user_id IS NOT NULL;

UPDATE execution_plans
SET actor_user_id = CASE
  WHEN actor_user_id IS NULL THEN NULL
  ELSE 'usr_local_default'
END
WHERE actor_user_id IS NOT NULL;

UPDATE execution_attempts
SET actor_user_id = CASE
  WHEN actor_user_id IS NULL THEN NULL
  ELSE 'usr_local_default'
END
WHERE actor_user_id IS NOT NULL;

UPDATE execution_audit_events
SET actor_user_id = CASE
  WHEN actor_user_id IS NULL THEN NULL
  ELSE 'usr_local_default'
END
WHERE actor_user_id IS NOT NULL;

UPDATE sweep_schedules
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

UPDATE tracked_pull_requests
SET workspace_id = 'workspace_local_default'
WHERE workspace_id IS NULL;

ALTER TABLE analysis_runs
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE execution_plans
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE execution_attempts
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE execution_audit_events
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE tracked_repositories
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE analysis_jobs
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE sweep_schedules
  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE tracked_pull_requests
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_runs_workspace_created_at
  ON analysis_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_plans_workspace_created_at
  ON execution_plans (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_events_workspace_created_at
  ON execution_audit_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_workspace_updated_at
  ON tracked_repositories (workspace_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_repositories_workspace_full_name_unique
  ON tracked_repositories (workspace_id, repository_full_name);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_workspace_queued_at
  ON analysis_jobs (workspace_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_sweep_schedules_workspace_next_run
  ON sweep_schedules (workspace_id, next_run_at ASC);
CREATE INDEX IF NOT EXISTS idx_tracked_pull_requests_workspace_updated_at
  ON tracked_pull_requests (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_installation_repositories_workspace_full_name
  ON github_installation_repositories (workspace_id, full_name);
