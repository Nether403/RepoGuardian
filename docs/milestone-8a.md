# Milestone 8A: GitHub App Installations and Tenant Scopes

Milestone 8A replaces the current shared-secret and generic-token assumptions with installation-scoped GitHub App access and the first production-ready tenancy boundaries for Repo Guardian.

Goals:

- introduce GitHub App installation flow as the primary production repository access model
- scope repository access to specific GitHub App installations instead of broad generic tokens
- add tenant-aware workspace or organization boundaries around tracked repositories, runs, plans, executions, jobs, schedules, and audit events
- introduce actor-aware approval metadata so execution events and approval actions can be attributed to a real user identity
- introduce a basic membership and role model for tenant-scoped review and execution workflows
- add installation-linked repository discovery or sync so tracked repositories can be associated with the correct installation boundary
- preserve the existing supervised execution philosophy while making access and approval boundaries production-ready

Guardrails:

- do not introduce billing complexity in this milestone
- do not introduce organization invitations, advanced enterprise org management, or full SSO edge-case expansion beyond what is needed for a first tenant-aware product foundation
- do not broaden write-back categories or semantic patch scope in this milestone
- do not enable unattended write execution simply because installation auth exists
- keep auditability first-class: access decisions, approvals, role checks, and executions must remain attributable
- keep current approval-gated execution intact even as auth and tenancy layers change underneath it
- keep shared-secret auth as a local-development or controlled fallback path only, not the primary production path

Suggested implementation shape:

- `tenants` or `workspaces` as the top-level product boundary
- `github_installations` linked to a tenant boundary
- `tenant_memberships` or equivalent role-mapping table for actor-to-tenant access
- tracked repositories linked to both tenant scope and installation scope
- actor identity propagated into plan creation, approval, job enqueueing, and execution audit events
- read and write GitHub operations resolved through installation-scoped credentials rather than generic tokens

Acceptance criteria:

- a GitHub organization or user can install Repo Guardian as a GitHub App and limit access to selected repositories
- repository access in analysis, planning, and execution flows can be attributed to a specific installation scope
- tracked repositories can be associated with the correct installation boundary and surfaced only within the owning tenant scope
- runs, plans, executions, jobs, schedules, and audit events are associated with a tenant or workspace boundary
- actor identity is persisted for approvals, job-triggering actions, and execution-triggering actions
- at least a basic role split exists for owner, maintainer, reviewer, and viewer behavior within a tenant boundary
- users cannot view or act on repositories, runs, plans, or jobs outside their tenant scope
- authorization failures are explicit and auditable
- the current supervised plan -> approve -> execute model continues to work with installation-scoped auth
- generic shared-secret behavior is no longer the primary production auth path

Non-goals:

- billing and subscription controls
- advanced SSO and SCIM provisioning
- multi-provider source control support
- unattended write execution policies
- new write-back categories or semantic migration scope

Follow-on milestone:

- the next milestone should decide whether to prioritize controlled autonomy policies for scheduled write execution or keep expanding enterprise controls before autonomy is introduced