# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo should be treated as a Milestone 9A alpha rather than a finished V1: it implements the Milestone 1 through 8A foundation plus fleet remediation intelligence, default policy gates, policy-decision audit history, and generated API-client coverage for workspace and installation reads.

## Current scope

- pnpm workspace monorepo
- `POST /api/analyze` for public GitHub repository intake
- GitHub OAuth session context for workspace-scoped production access, with `Authorization: Bearer <API_SECRET_KEY>` retained as a local-development fallback
- recursive tree fetch for the default branch
- manifest and lockfile detection
- ecosystem inference and notable repository signals
- dependency file fetches from GitHub
- normalized dependency snapshot parsing for 20+ formats across Node.js, Python, Go, Rust, JVM, and Ruby
- OSV-backed advisory lookup behind a swappable provider interface
- structured dependency findings with severity, confidence, evidence, and remediation hints
- targeted code-review findings for secret-like literals, dangerous execution, and workflow hardening risks
- deterministic issue-candidate grouping and PR-candidate drafting
- linked patch-planning records with visibility into patchability and validation status
- `POST /api/execution/plan` and `POST /api/execution/execute` for security-hardened, two-phase approval-gated write-back
- `GET /api/execution/plans/{planId}` and `GET /api/execution/plans/{planId}/events` for durable execution state and audit history
- real GitHub Issue creation and bounded Pull Request write-back for supported deterministic slices
- Vite + React UI for analysis, candidate selection, two-phase execution previews, and results
- Fleet Admin mode for tracked repositories, fleet status, async job control, sweep schedules, and tracked PR visibility
- Workspace Access UI for GitHub sign-in state, workspace selection, GitHub App installation sync, and installation-backed tracked repository registration
- Milestone 9A fleet remediation metrics and explicit policy gates before controlled autonomy
- repository history and cursor-native timeline reads for Fleet Admin drill-downs
- server-side paginated policy-decision history via `GET /api/policy-decisions`
- server-side policy-decision filtering by action, decision, repository, and occurrence window
- on-demand timeline event expansion with structured detail for execution events, execution plans, tracked PRs, analysis jobs, and analysis runs
- deterministic Guardian Graph view for visual traceability
- Postgres-backed `GET /api/runs`, `POST /api/runs`, etc. for durable saved analysis runs and compare mode
- Postgres-backed tracked repositories, async analysis jobs, sweep schedules, PR lifecycle records, and repository activity/timeline state
- `lib/api-spec/openapi.yaml` as the API contract
- generated `@repo-guardian/api-client` and shared typed schemas

## Database setup

Repo Guardian now requires Postgres for durable run and execution persistence.

Set:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/repo_guardian
```

Then run:

```bash
pnpm --filter @repo-guardian/api run db:migrate
```

If you need to import older filesystem-backed run and plan JSON artifacts from `.repo-guardian/runs` and `.repo-guardian/plans`, run:

```bash
pnpm --filter @repo-guardian/api run db:import-legacy

Legacy import only carries forward saved analysis runs and pending legacy plans. It does not reconstruct full historical execution state from legacy `executing`, `completed`, or `failed` plan files; those are skipped and reported by reason in the import output.
```

## Commands

```bash
pnpm install
pnpm run dev
pnpm run dev:api
pnpm run dev:web
pnpm --filter @repo-guardian/api run db:migrate
pnpm --filter @repo-guardian/api run db:import-legacy
pnpm run generate:api-client
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Fleet APIs and UI

The supervised analysis flow remains the default web mode, and the current alpha also includes a Fleet Admin mode for multi-repository operations.

Implemented fleet surfaces:

- `GET /api/tracked-repositories`
- `POST /api/tracked-repositories`
- `GET /api/tracked-repositories/{trackedRepositoryId}/history`
- `GET /api/tracked-repositories/{trackedRepositoryId}/activity`
- `GET /api/tracked-repositories/{trackedRepositoryId}/timeline`
- `GET /api/tracked-repositories/{trackedRepositoryId}/timeline/{activityId}`
- `GET /api/fleet/status`
- `GET /api/analyze/jobs`
- `POST /api/analyze/jobs`
- `GET /api/analyze/jobs/{jobId}`
- `POST /api/analyze/jobs/{jobId}/retry`
- `POST /api/analyze/jobs/{jobId}/cancel`
- `GET /api/sweep-schedules`
- `POST /api/sweep-schedules`
- `POST /api/sweep-schedules/{scheduleId}/trigger`

Current 8A foundation behavior:

- tracked repositories can be registered and manually queued for analysis
- weekly sweep schedules can enqueue plan-only review passes
- fleet status reports recent jobs, executable plans, blocked plans, stale plans, and tracked PR lifecycle
- repository history and timeline reads stay read-only and supervised
- timeline pages support filters, sorting, saved inspector state, cursor-native paging, and on-demand event expansion
- workspace, user, membership, GitHub installation, and installation-repository records are persisted in Postgres
- API routes enforce active-workspace boundaries for workspace and installation surfaces; explicit analysis workspace ids must match the authenticated workspace
- GitHub OAuth callback state is validated before token exchange
- GitHub writes remain approval-gated through the execution plan and execute routes; scheduled work does not perform unattended writes

## Roadmap

The current state reflects **Milestone 9A fleet remediation intelligence and policy gates**. The platform now layers workspace-scoped access, GitHub App installation repository visibility, fleet health metrics, attention queues, and policy-decision audit history on top of the completed 7B fleet foundation while keeping write execution supervised.

The next goals are autonomy simulation and recommendations without unattended writes. The controlled-autonomy path after that should proceed through supervised batch execution and only then opt-in policy-scoped automation. See `docs/roadmap.md`.
