# Repo Guardian Roadmap

## Current status

Repo Guardian has completed Milestone 9A fleet remediation intelligence and policy gates. The implemented contract is centered on a security-hardened, two-phase supervised execution model, with fleet orchestration, workspace-scoped GitHub App access, fleet health metrics, and policy-decision audit history layered alongside it:

- `GET /api/auth/session`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `POST /api/auth/logout`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/{workspaceId}/installations`
- `POST /api/workspaces/{workspaceId}/installations/{installationId}/sync`
- `POST /api/github/webhooks`
- `POST /api/analyze`
- `POST /api/execution/plan` (Planning)
- `POST /api/execution/execute` (Execution)
- `GET /api/execution/plans/{planId}`
- `GET /api/execution/plans/{planId}/events`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`
- `GET /api/tracked-repositories`
- `POST /api/tracked-repositories`
- `GET /api/tracked-repositories/{trackedRepositoryId}/history`
- `GET /api/tracked-repositories/{trackedRepositoryId}/timeline`
- `GET /api/tracked-repositories/{trackedRepositoryId}/timeline/{activityId}`
- `GET /api/fleet/status`
- `GET /api/policy-decisions`
- `GET /api/analyze/jobs`
- `POST /api/analyze/jobs`
- `GET /api/analyze/jobs/{jobId}`
- `POST /api/analyze/jobs/{jobId}/retry`
- `POST /api/analyze/jobs/{jobId}/cancel`
- `GET /api/sweep-schedules`
- `POST /api/sweep-schedules`
- `POST /api/sweep-schedules/{scheduleId}/trigger`

Production access is based on GitHub OAuth session context, workspace membership, and installation-scoped repository visibility. The legacy `Authorization: Bearer <API_SECRET_KEY>` path remains as a local-development fallback.

The current platform focus is still bounded, deterministic, and approval-gated:

- deterministic repository analysis across the currently supported ecosystems
- deterministic patch planning for bounded issue and PR candidate slices
- explicit approval before any GitHub write-capable execution step
- durable saved-run history, plan detail reads, and execution audit history for supervised review workflows
- tracked repositories, async analysis jobs, and sweep schedules for multi-repository oversight
- Fleet Admin web surfaces for fleet status, remediation health, attention queues, job control, schedule control, and repository timeline drill-downs
- cursor-native repository timelines with on-demand typed event detail expansion
- workspace, membership, installation, and installation-repository persistence for the first 8A boundary
- server-side filtered and paginated policy-decision history

## Current priorities

The next work should turn the current installation-aware alpha into a measurable, policy-governed fleet product rather than broaden the write surface prematurely.

Immediate priorities:

- preserve stability of the current two-phase execution contract
- validate and harden workspace, role, and installation boundaries
- finish production-grade GitHub App installation-to-workspace linking
- add fleet remediation metrics on top of durable execution history
- add explicit policy gates for analysis, planning, scheduling, and execution decisions
- keep deterministic write-back bounded while the product foundation matures
- keep tenant and actor boundaries ahead of broader write-back

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

### Milestone 7B: Fleet Queueing and Scheduled Planning [COMPLETE]

Milestone 7B builds asynchronous orchestration on top of the durable execution backbone.

Focus:

- background queue-backed analysis and planning jobs
- tracked repository registration
- scheduled plan-only sweeps such as recurring dependency review runs
- fleet-level status for recent analyses, blocked plans, executable plans, and failed jobs
- persisted PR lifecycle tracking for Repo Guardian-opened remediation PRs
- Fleet Admin inspector drill-downs for jobs, runs, plans, tracked repositories, and tracked PR context
- cursor-native repository timelines with filterable, expandable activity events

This milestone keeps write execution supervised and approval-gated. It does **not** enable unattended GitHub writes.

### Milestone 8A: GitHub App Installations and Tenant Scopes [COMPLETE]

Milestone 8A replaces the current shared-secret and generic-token assumptions with installation-scoped access and tenant-aware product boundaries.

Focus:

- GitHub App installation flow
- installation-scoped repository access
- tenant-aware repository, run, and execution ownership
- actor-aware approval metadata
- basic role-based access controls for review and execution workflows

Implemented foundation:

- workspace, user, membership, installation, and installation-repository persistence
- GitHub OAuth session routes with signed session cookies and callback state validation
- installation repository sync and installation-backed tracked repository selection
- active-workspace enforcement for explicit analysis workspace ids
- generated API-client coverage for workspace and installation read/sync helpers

This milestone does **not** broaden patch synthesis or introduce semantic code migration.

### Milestone 9A: Fleet Remediation Intelligence and Policy Gates [COMPLETE]

Milestone 9A turns the durable fleet foundation into an operator-facing remediation control plane.

Implemented:

- workspace-scoped fleet remediation metrics: tracked repositories, stale analyses, finding severity mix, ecosystem coverage, executable plans, blocked plans, failed jobs, open PR lifecycle, and installation coverage
- default policy records for workspace, repository, and installation-aware decision scopes
- policy evaluation for analysis, scheduled plan-only sweeps, PR candidate generation, and write execution
- durable policy-decision events with actor, workspace, repository, installation, decision, and reason
- server-side policy-decision filtering and pagination via `GET /api/policy-decisions`
- Fleet Overview UI that prioritizes attention queues and remediation health over broad analytics
- installation and webhook boundary hardening where policy decisions depend on installation trust

This milestone does **not** enable unattended GitHub writes. It creates the measurement and policy layer required before controlled autonomy can be safe.

### Milestone 9B: Autonomy Simulation and Recommendations

Milestone 9B uses the 9A policy layer to show what Repo Guardian would do under proposed autonomy rules without doing it.

Focus:

- dry-run autonomy simulations for tracked repositories and sweep schedules
- recommended policy changes with evidence, blast-radius estimates, and expected action counts
- "would allow / would block / manual review required" previews for candidate actions
- per-repository autonomy readiness based on recent failures, validation gaps, installation coverage, and policy conflicts
- audit-friendly comparison between current manual flow and simulated autonomous flow

This milestone still performs no unattended GitHub writes.

### Milestone 9C: Supervised Batch Execution

Milestone 9C introduces higher-throughput supervised operation without crossing into default autonomy.

Focus:

- batch review queues for policy-allowed, deterministic actions
- explicit user approval for a bounded batch of selected plans
- batch-level limits, confirmation text, actor attribution, and audit events
- partial success and retry handling that preserves one concern per PR candidate
- clear separation between plan-only scheduling, candidate generation, and write execution

This milestone keeps write execution human-approved, but reduces repetitive approval work for well-understood deterministic actions.

### Milestone 9D: Opt-in Controlled Autonomy

Milestone 9D may enable tightly bounded unattended actions only after 9A-9C prove that policy, observability, and audit trails are reliable.

Focus:

- opt-in autonomy profiles scoped by workspace, repository, installation, action type, ecosystem, severity, and risk level
- default autonomy limited to analysis and plan-only sweeps
- optional policy-gated PR opening only for deterministic, low-risk recipes with passing validation signals
- hard budgets, cooldowns, repository allowlists, notification hooks, and a workspace-level kill switch
- automatic downgrade to manual review on validation failure, policy conflict, stale installation state, missing evidence, or repeated execution failure
- durable autonomy audit events and dashboard visibility for every autonomous decision

This milestone does **not** allow auto-merge, broad refactors, force-pushes, or open-ended repository rewriting.

## Longer-horizon direction

After the durable foundation, queue-backed fleet operation, tenant-aware GitHub access, and policy-gated remediation intelligence are in place, the longer product direction should remain disciplined:

- controlled autonomy by policy rather than default unattended execution
- fleet dashboards and remediation metrics on top of durable execution history
- recipe-based semantic migrations only after policy-gated autonomy and auditability are established
- no open-ended autonomous repository rewriting

Repo Guardian should remain deterministic by default, autonomous by policy, and semantic only by recipe.
