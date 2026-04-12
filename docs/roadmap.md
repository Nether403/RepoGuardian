# Repo Guardian Roadmap

## Current status

Repo Guardian is currently a post-`7A` alpha. The implemented contract is centered on a security-hardened, two-phase supervised execution model:

- `POST /api/analyze`
- `POST /api/execution/plan` (Planning)
- `POST /api/execution/execute` (Execution)
- `GET /api/execution/plans/{planId}`
- `GET /api/execution/plans/{planId}/events`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

All routes currently require `Authorization: Bearer <API_SECRET_KEY>`.

The current platform focus is still bounded, deterministic, and approval-gated:

- deterministic repository analysis across the currently supported ecosystems
- deterministic patch planning for bounded issue and PR candidate slices
- explicit approval before any GitHub write-capable execution step
- durable saved-run history, plan detail reads, and execution audit history for supervised review workflows

## Current priorities

The next work should harden Repo Guardian into a durable product foundation rather than broaden the write surface prematurely.

Immediate priorities:

- preserve stability of the current two-phase execution contract
- validate and harden the new durable execution backbone
- prepare the platform for asynchronous fleet-scale analysis and planning
- keep deterministic write-back bounded while the product foundation matures
- move next into queue-backed orchestration rather than broader write-back

## Next milestones

### Milestone 7A: Durable Execution Backbone

Milestone 7A replaces local file-backed run and plan persistence with a durable execution backbone.

Focus:

- durable database-backed storage for analysis runs, execution plans, and execution outcomes
- explicit execution plan lifecycle states
- idempotency and concurrency protections for approved execution
- persisted audit events and action-level execution history
- compatibility with the current public API and web flow

This milestone does **not** expand write-back categories, scheduling, or tenancy.

### Milestone 7B: Fleet Queueing and Scheduled Planning

Milestone 7B builds asynchronous orchestration on top of the durable execution backbone.

Focus:

- background queue-backed analysis and planning jobs
- tracked repository registration
- scheduled plan-only sweeps such as recurring dependency review runs
- fleet-level status for recent analyses, blocked plans, executable plans, and failed jobs
- persisted PR lifecycle tracking for Repo Guardian-opened remediation PRs

This milestone keeps write execution supervised and approval-gated. It does **not** enable unattended GitHub writes.

### Milestone 8A: GitHub App Installations and Tenant Scopes

Milestone 8A replaces the current shared-secret and generic-token assumptions with installation-scoped access and tenant-aware product boundaries.

Focus:

- GitHub App installation flow
- installation-scoped repository access
- tenant-aware repository, run, and execution ownership
- actor-aware approval metadata
- basic role-based access controls for review and execution workflows

This milestone does **not** broaden patch synthesis or introduce semantic code migration.

## Longer-horizon direction

After the durable foundation, queue-backed fleet operation, and tenant-aware GitHub access are in place, the next product direction should remain disciplined:

- controlled autonomy by policy rather than default unattended execution
- fleet dashboards and remediation metrics on top of durable execution history
- recipe-based semantic migrations only after durability, queueing, and enterprise boundaries are established
- no open-ended autonomous repository rewriting

Repo Guardian should remain deterministic by default, autonomous by policy, and semantic only by recipe.
