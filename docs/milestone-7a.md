# Milestone 7A: Durable Execution Backbone

Milestone 7A replaces the current local file-backed run and plan persistence with a durable database-backed execution backbone while keeping the existing supervised execution model intact.

Goals:

- keep `/api/analyze`, `/api/execution/plan`, `/api/execution/execute`, and `/api/runs*` stable at the public-contract level
- replace file-backed analysis run and execution plan storage with durable database persistence
- formalize execution plan lifecycle state transitions (`planned`, `executing`, `completed`, `failed`, `expired`, `cancelled`)
- introduce idempotency and concurrency protections so the same approved plan cannot execute twice
- persist execution attempts, action-level outcomes, and audit events for later inspection
- preserve the current approval-gated write model and bounded write-back slices without broadening execution scope

Guardrails:

- do not introduce new write-back categories or broaden patch synthesis in this milestone
- do not introduce background scheduling or queue workers yet
- do not introduce multi-tenant scopes, GitHub App installations, or role-based access controls yet
- do not change top-level API response shapes without a compatibility reason
- keep route handlers thin and keep persistence and lifecycle logic in library packages
- keep filesystem-backed stores out of the production path once the database implementation lands

Acceptance criteria:

- every saved analysis run and execution plan survives process restart and can be reopened from durable storage
- concurrent execution requests for the same plan cannot produce duplicate write attempts
- execution plan state transitions are explicit, validated, and queryable
- action-level execution outcomes are persisted with timestamps, repository identity, and actor placeholder metadata
- the system can answer “what happened, when, and for which repository?” for every execution plan
- compare mode and saved-run reopening continue to work against the durable store
- the current public API contract remains compatible for existing web flows
- production execution no longer depends on local JSON files for plans or runs

Follow-on milestone:

- `Milestone 7B` adds background queueing, tracked repositories, and scheduled plan generation on top of the durable backbone