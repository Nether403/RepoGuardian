# Milestone 7B: Fleet Queueing and Scheduled Planning

Milestone 7B is now implemented. It adds asynchronous orchestration, tracked repositories, fleet reporting, and Fleet Admin drill-downs on top of the durable execution backbone so Repo Guardian can supervise multiple repositories without turning request/response routes into long-running handlers.

Implemented backend capabilities:

- durable tracked repository registration and listing
- durable async analysis jobs with list, read, retry, and cancel flows
- async execution-plan job support for plan generation outside the request thread
- weekly sweep schedules for plan-only tracked-repository review passes
- fleet status reporting for latest repository state, patch-plan counts, recent jobs, and tracked PR lifecycle
- persisted tracked remediation PR lifecycle state
- tracked-repository history aggregation for runs, jobs, plans, and tracked PRs
- dedicated activity and timeline reads for repository-level fleet inspection
- cursor-native timeline paging with server-side filtering and sorting
- on-demand timeline event expansion without inflating default timeline payloads

Implemented web/admin capabilities:

- Fleet Admin mode inside the existing single-page app
- tracked repository registration and manual analysis enqueue
- job operations for refresh, retry, and cancel
- sweep schedule creation and manual triggering
- tracked PR visibility and fleet summary metrics
- shared inspector panel for repository, job, run, and plan drill-downs
- repository timeline filters, saved filter state, sorting presets, and paging
- typed timeline detail rendering for execution events, execution plans, tracked PRs, analysis jobs, and analysis runs

Guardrails that still apply:

- GitHub write execution remains approval-gated through `POST /api/execution/plan` and `POST /api/execution/execute`
- scheduled work is limited to analysis and plan generation
- there is no unattended GitHub issue or PR write path
- deterministic patch synthesis scope remains bounded to the existing supported write-back slices
- queue and timeline state remain explicit, queryable, and retry-safe rather than opaque background behavior

Known limitations of the current 7B implementation:

- the worker and scheduler are still in-process rather than separate durable multi-instance services
- sweep cadence is currently weekly
- timeline compatibility routes still exist alongside the newer cursor-native timeline route
- some legacy or unknown activity records still fall back to a generic timeline detail variant

Follow-on milestone:

- `Milestone 8A` introduces GitHub App installations, tenant scopes, and actor-aware approval flows so fleet operations can move from lab-tool assumptions to production SaaS boundaries
