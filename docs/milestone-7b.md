# Milestone 7B: Fleet Queueing and Scheduled Planning

Milestone 7B builds asynchronous orchestration on top of the durable execution backbone so Repo Guardian can analyze and plan across multiple repositories without turning request/response routes into long-running job handlers.

Goals:

- add background queue-backed analysis and planning jobs for multi-repository operation
- introduce a tracked-repository model for repositories that should participate in repeat analysis
- support scheduled plan-only sweeps such as weekly dependency review runs
- expose fleet-level status for recent analyses, executable patch plans, blocked plans, and failed jobs
- persist PR lifecycle status so opened remediation PRs can be tracked through merge or closure
- keep scheduled work bounded to analysis and plan generation unless a later policy layer explicitly enables more

Guardrails:

- do not enable unattended GitHub write execution in this milestone
- do not auto-merge pull requests
- do not broaden deterministic patch synthesis scope beyond the existing bounded write-back slices
- do not introduce semantic code migration or LLM-driven code rewrite behavior
- keep approval required for every write-capable execution path
- keep queue semantics explicit, observable, and retry-safe rather than “best effort” background magic

Acceptance criteria:

- analysis and execution-plan generation can run asynchronously outside the request thread
- a scheduled sweep can analyze multiple tracked repositories and persist plan-only results without manual per-repo triggering
- fleet status can show the latest known run outcome per tracked repository
- fleet status can show how many patch plans are executable, blocked, or stale across tracked repositories
- failed jobs, retries, and cancellations are visible and queryable
- merge/closed state for Repo Guardian-opened PRs is persisted and reflected in fleet reporting
- long-running repo analysis no longer depends on keeping the initiating HTTP request open
- scheduled jobs do not perform GitHub writes unless a later milestone explicitly expands policy controls

Follow-on milestone:

- `Milestone 8A` introduces GitHub App installations, tenant scopes, and actor-aware approval flows so fleet operations can move from lab-tool assumptions to production SaaS boundaries