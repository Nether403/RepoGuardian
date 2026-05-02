#!/bin/bash
# Post-merge setup for the Repo Guardian pnpm monorepo.
# Runs after a task is merged. Must be idempotent and non-interactive.
set -euo pipefail

export COREPACK_ENABLE_STRICT=0

echo "[post-merge] installing workspace dependencies"
pnpm install --prefer-offline

# Apply any pending Postgres schema migrations. The runner tracks applied
# migrations in a dedicated table, so re-running is a no-op when the schema
# is already up to date. Skipped automatically if DATABASE_URL is unset
# (e.g. local sandbox without a database) so the merge does not fail.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[post-merge] applying database migrations"
  pnpm --filter @repo-guardian/api run db:migrate
else
  echo "[post-merge] DATABASE_URL not set; skipping db:migrate"
fi

echo "[post-merge] done"
