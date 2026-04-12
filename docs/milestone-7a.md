# Milestone 7A: Durable Execution Backbone

Milestone 7A replaces filesystem-backed runs and plans with a Postgres-backed execution backbone while keeping the supervised two-phase execution contract stable.

## Implemented scope

- `analysis_runs` stores the full saved analysis payload plus denormalized summary columns used by `/api/runs*`
- `execution_plans` stores durable plan metadata, lifecycle state, approval metadata, timestamps, and repository identity
- `execution_plan_actions` stores one row per action plus per-action start and completion timestamps
- `execution_attempts` enforces one durable execution attempt per approved plan
- `execution_audit_events` stores ordered plan and action history for later inspection

## Public contract

Canonical routes remain:

- `POST /api/analyze`
- `POST /api/execution/plan`
- `POST /api/execution/execute`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

Additive read routes introduced in 7A:

- `GET /api/execution/plans/{planId}`
- `GET /api/execution/plans/{planId}/events`

Compatibility notes:

- `/api/runs*` stays shape-compatible
- `SavedAnalysisRunSummary` now allows optional execution summary metadata:
  `latestPlanId`, `latestPlanStatus`, and `latestExecutionCompletedAt`
- full execution history stays plan-centric and is not embedded into run payloads

## Lifecycle rules

Plan lifecycle values:

- `planned`
- `executing`
- `completed`
- `failed`
- `expired`
- `cancelled`

Allowed transitions:

- `planned -> executing`
- `planned -> expired`
- `planned -> cancelled`
- `executing -> completed`
- `executing -> failed`
- `executing -> cancelled`

Operational behavior:

- plan creation persists the plan, its actions, and an initial `plan_created` audit event
- execution claims the plan transactionally and records `execution_started`
- action start and completion events are persisted as execution proceeds
- expired plans are transitioned lazily on read/execute, not by a background worker
- raw approval tokens are never stored

## Operations

Required environment:

- `DATABASE_URL`

Commands:

```bash
pnpm --filter @repo-guardian/api run db:migrate
pnpm --filter @repo-guardian/api run db:import-legacy
```

Legacy import rules:

- saved runs import idempotently by run id
- only legacy `planned` plan files are imported
- legacy `executing`, `completed`, and `failed` plans are skipped because 7A cannot reconstruct trustworthy execution history from them

## Validation

Current validation layers:

- shared-type coverage for additive run and execution read models
- persistence unit tests for lifecycle and legacy import behavior
- API route tests for plan creation, execution, plan detail reads, audit event reads, and duplicate execution rejection
- optional real-Postgres repository tests gated by `TEST_DATABASE_URL`

Milestone 7B builds queue-backed orchestration and scheduled planning on top of this durable foundation.
