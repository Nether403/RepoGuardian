# Milestone 8A: GitHub App Installations and Tenant Scopes

Milestone 8A replaces the current shared-secret and generic-token assumptions with installation-scoped GitHub App access and the first production-ready tenancy boundaries for Repo Guardian.

Goals:

- introduce GitHub App installation flow as the primary repository access model
- scope repository access to installations instead of broad generic tokens
- add tenant-aware workspace or organization boundaries around repositories, runs, plans, and executions
- add actor-aware approval metadata so execution events can be attributed to a real user identity
- introduce basic role-based access controls for repository and execution review workflows
- preserve the existing supervised execution philosophy while making access and approval boundaries production-ready

Guardrails:

- do not introduce billing complexity in this milestone
- do not introduce SSO edge-case expansion beyond what is needed for a first tenant-aware product foundation
- do not broaden write-back categories or semantic patch scope in this milestone
- do not enable unattended write execution simply because installation auth exists
- keep auditability first-class: access decisions, approvals, and executions must remain attributable
- keep current approval-gated execution intact even as auth and tenancy layers change underneath it

Acceptance criteria:

- a GitHub organization or user can install Repo Guardian as a GitHub App and limit access to selected repositories
- repository access in analysis and execution flows can be attributed to a specific installation scope
- runs, plans, executions, and audit events are associated with a tenant/workspace boundary
- actor identity is persisted for approvals and execution-triggering actions
- at least a basic role split exists for owner, maintainer, reviewer, and viewer behavior
- users cannot view or act on repositories outside their tenant scope
- the current supervised plan -> approve -> execute model continues to work with installation-scoped auth
- generic shared-secret behavior is no longer the primary production auth path

Follow-on milestone:

- the next milestone should decide whether to prioritize controlled autonomy policies for scheduled write execution or keep expanding enterprise controls before autonomy is introduced