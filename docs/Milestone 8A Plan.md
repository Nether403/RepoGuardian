# Milestone 8A Plan: Workspaces, GitHub App Installations, and Actor-Scoped Access

## Summary
Implement Milestone 8A by replacing the current production-only `API_SECRET_KEY` trust model with GitHub OAuth user sessions plus workspace-scoped authorization, and by replacing generic `GITHUB_TOKEN` repository access with GitHub App installation credentials. Keep the existing canonical analysis and supervised execution routes intact, but make every read/write operation resolve through a workspace, a workspace member, and a linked GitHub App installation. Retain `API_SECRET_KEY` only as an explicit local-development fallback.

## Key Changes
- Add a first-class `workspaces` boundary and scope all tracked repositories, analysis runs, execution plans, execution attempts, audit events, analysis jobs, sweep schedules, tracked PRs, and repository-activity reads to `workspace_id`.
- Add identity and membership tables:
  - `users` keyed by GitHub user id/login.
  - `workspace_memberships` with roles `owner | maintainer | reviewer | viewer`.
  - Persist actor identity as `actor_user_id` and, where useful for audits, `actor_membership_id` or resolved role snapshot.
- Add installation tables:
  - `github_installations` linked to `workspace_id`, storing installation id, target account metadata, status, permissions snapshot, and timestamps.
  - `github_installation_repositories` mapping installation-visible repositories for sync and authorization.
- Update existing tables so repository-linked rows also carry `github_installation_id` where access resolution matters:
  - tracked repositories
  - analysis runs
  - execution plans / attempts / audit events
  - analysis jobs
  - sweep schedules
  - tracked pull requests
- Replace generic GitHub client construction with an installation-token resolver:
  - read operations accept `workspaceId + repositoryFullName` and fetch an installation token for that repository.
  - write operations accept `workspaceId + repositoryFullName + actorUserId`, verify workspace role and installation access, then mint installation-scoped credentials.
  - keep the bounded write categories unchanged.
- Introduce production auth/session foundations:
  - GitHub OAuth login endpoints and callback.
  - signed session cookie or equivalent session token for browser/API requests.
  - authenticated request context exposing `user`, `workspace`, and membership role.
  - retain `Authorization: Bearer <API_SECRET_KEY>` only behind an explicit local/dev mode branch.
- Add workspace-aware authorization middleware:
  - every fleet and canonical route resolves a workspace context before touching persistence.
  - repository, run, plan, job, schedule, and timeline reads must be filtered by workspace ownership.
  - write-plan and execute routes must also enforce role checks.
- Role behavior for 8A:
  - `owner`: manage workspace, installations, memberships, repository sync, all reads/writes.
  - `maintainer`: manage tracked repositories, jobs, schedules, plan generation, approve and execute writes.
  - `reviewer`: read workspace data, generate plans, approve plans, no execution.
  - `viewer`: read-only.
- Add GitHub App installation and sync flows:
  - installation callback/webhook handler to upsert installations and installation-repository visibility.
  - manual sync/list endpoint to refresh installation repositories on demand.
  - tracked repository creation must require selecting a repository visible through a workspace-linked installation.
- Update the web app for 8A essentials only:
  - GitHub sign-in state.
  - workspace selector if a user belongs to multiple workspaces.
  - installation status/repository sync panel in Fleet Admin.
  - tracked-repository create flow updated to choose from synced installation repositories instead of free-form repo input for production path.
  - preserve existing analysis and fleet surfaces, but ensure they only show current-workspace data.

## Public Interfaces
- Keep canonical routes and response shapes stable where possible:
  - `POST /api/analyze`
  - `POST /api/execution/plan`
  - `POST /api/execution/execute`
  - `/api/runs*`
  - fleet routes
- Add auth/workspace endpoints for 8A:
  - `GET /api/auth/session`
  - `GET /api/auth/github/start`
  - `GET /api/auth/github/callback`
  - `POST /api/auth/logout`
  - `GET /api/workspaces`
  - `POST /api/workspaces`
  - `GET /api/workspaces/{workspaceId}/installations`
  - `POST /api/workspaces/{workspaceId}/installations/{installationId}/sync`
- Add GitHub App webhook endpoint:
  - `POST /api/github/webhooks`
- Add required request context, not broad payload rewrites:
  - canonical and fleet routes infer workspace from session-selected workspace or explicit workspace header/query only if needed for multi-workspace UX.
  - do not reshape existing analysis/execution payload bodies unless required to disambiguate workspace in non-browser clients; if needed, add optional `workspaceId` compatibly.
- Extend shared types and OpenAPI for:
  - session/user/workspace/membership/installations
  - role enum
  - installation-linked tracked repository metadata
  - explicit authorization failure payloads with auditable reason codes

## Implementation Notes
- Persistence/migrations:
  - create a new migration that adds workspaces, users, memberships, installations, installation repositories, and foreign keys/indexes for workspace scoping.
  - backfill existing rows into a single default local workspace for migration compatibility.
  - set legacy rows with existing placeholder actor ids to the seeded local user only for dev/backfill paths.
- API wiring:
  - refactor `requireAuth` into layered auth:
    - session auth for production
    - optional API key fallback for local/dev
    - workspace membership resolver
  - route handlers stay thin; workspace and authorization resolution should live in reusable services/middleware.
- GitHub integration:
  - add GitHub App env config: app id, client id/secret, webhook secret, private key.
  - add installation token minting and caching helper behind `lib/github`.
  - repository discovery should use installation APIs, not generic token search.
- Execution/audit:
  - approval tokens remain in place, but token creation and verification must include real actor identity and workspace context.
  - persist who created plan, who approved it, and who executed it when those differ.
  - authorization denials and missing-installation denials should create auditable events where execution/approval was attempted.

## Test Plan
- Migration tests:
  - legacy data migrates into a default local workspace without losing run/plan/job visibility.
  - workspace foreign keys and installation mappings enforce integrity.
- Auth/session tests:
  - GitHub OAuth callback creates/updates user and session.
  - local dev API key fallback still works when explicitly enabled.
  - production rejects default dev API secret path.
- Authorization tests:
  - viewer cannot create tracked repositories, plans, approvals, or executions.
  - reviewer can create plans and approve but cannot execute.
  - maintainer and owner can execute approved plans.
  - cross-workspace access to repositories, runs, plans, jobs, schedules, and timelines is rejected.
- GitHub installation tests:
  - installation webhook upserts installation and repository visibility.
  - manual sync refreshes installation repositories.
  - analyze/plan/execute resolve the correct installation token for the target repository.
  - tracked repository creation fails when repo is not visible in the active workspace installation set.
- Execution continuity tests:
  - supervised `plan -> approve -> execute` still works end-to-end with installation auth.
  - audit events record real actor identity for plan creation, approval, execution, retry, and denial cases.
- Web/API integration tests:
  - Fleet Admin only shows current-workspace data.
  - workspace switching changes repository/job/run visibility.
  - tracked repository onboarding uses synced installation repos.
- Validation checks after implementation:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Assumptions
- Use `workspace` as the only product boundary term in code, API additions, and UI copy.
- Use GitHub OAuth login as the first production user-auth mechanism; no separate email/password or magic-link auth in 8A.
- Support both webhook-driven installation sync and manual sync endpoints in 8A.
- Keep current canonical route shapes stable unless an additive `workspaceId` is required for non-session clients.
- Keep shared-secret/API-key auth as local-development fallback only, not the default production path.
- Do not expand write-back categories, unattended execution, billing, SSO/SCIM, or enterprise org-management scope in this milestone.
