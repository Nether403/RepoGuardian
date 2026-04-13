# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo should be treated as a post-`7B` alpha rather than a finished V1: it implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, 3B, 4A, 4B, 5A, 5B, 6A, 6B, 6C, 6D, 6E, 6F, 7A, and 7B slices across public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, structured candidate issue generation, structured PR-candidate drafting, linked patch-planning metadata, deterministic Guardian Graph visual reporting, durable saved analysis runs with compare mode, OpenAPI-backed generated web API client functions, security-hardened two-phase execution planning, durable execution audit history, approved GitHub Issue creation, approved real PR write-back for tightly bounded deterministic paths, asynchronous tracked-repository analysis jobs, sweep scheduling, fleet status reporting, tracked remediation PR lifecycle persistence, and Fleet Admin timeline drill-downs with typed event detail.

## Current scope

- pnpm workspace monorepo
- `POST /api/analyze` for public GitHub repository intake
- Mandatory `Authorization: Bearer <API_SECRET_KEY>` header for all canonical API routes
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
- repository history and cursor-native timeline reads for Fleet Admin drill-downs
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

Current 7B behavior:

- tracked repositories can be registered and manually queued for analysis
- weekly sweep schedules can enqueue plan-only review passes
- fleet status reports recent jobs, executable plans, blocked plans, stale plans, and tracked PR lifecycle
- repository history and timeline reads stay read-only and supervised
- timeline pages support filters, sorting, saved inspector state, cursor-native paging, and on-demand event expansion
- GitHub writes remain approval-gated through the execution plan and execute routes; scheduled work does not perform unattended writes

## Roadmap

The current state reflects **Milestone 7B** (Fleet Queueing and Scheduled Planning). The platform now layers tracked repositories, async analysis jobs, sweep scheduling, fleet status, and Fleet Admin timeline drill-downs on top of the durable execution backbone while keeping write execution supervised.

The next goals are installation-aware GitHub access, tenant scopes, and actor-aware approval boundaries. See `docs/roadmap.md`.
