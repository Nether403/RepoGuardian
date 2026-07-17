# Repo Guardian

> **Status: FURTHER DEVELOP (2026-07)** — live product, unfinished alpha.  
> **Live:** [https://RepoGuardian.101dev.xyz](https://RepoGuardian.101dev.xyz)  
> Milestone **9C alpha** (supervised batch execution), not a finished V1.  
> See [`STATUS.md`](./STATUS.md) and [`docs/FURTHER-DEVELOP-2026.md`](./docs/FURTHER-DEVELOP-2026.md).

**Repo Guardian** is a supervised GitHub repository triage and maintenance assistant.

Paste a repo → get structured analysis (ecosystems, dependency risk, code-review signals) → draft Issues and PRs → **approve** before anything is written back to GitHub.

It is **not** an autonomous maintainer. Write actions stay explicit, bounded, auditable, and reversible.

It is already **deployed and functional** — continue building, don’t treat this as a cold revive.

![Repo Guardian](./RepoGuardianlogo.png)

## Why it exists

Maintainers and operators often face the same mess:

- dozens of idle forks, husks, and half-finished experiments
- dependency drift and secret-like risks scattered across fleets
- no safe middle ground between “manual chaos” and “unattended bots”

Repo Guardian aims at that middle ground: **deterministic analysis first**, human approval before write-back, fleet visibility when you grow beyond one repo.

## Product at a glance

| Capability | State |
|---|---|
| Public GitHub repo intake + recursive tree | Implemented |
| Ecosystem / manifest / lockfile detection | Implemented (Node, Python, Go, Rust, JVM, Ruby, …) |
| OSV-backed dependency findings | Implemented |
| Targeted code-review findings | Implemented |
| Issue / PR candidate drafting | Implemented |
| Two-phase plan → execute write-back | Implemented (approval-gated) |
| Workspace + GitHub OAuth + App installs | Implemented (alpha) |
| Fleet Admin (tracked repos, jobs, sweeps) | Implemented (alpha) |
| Policy-decision audit history | Implemented |
| Dry-run autonomy simulation | Implemented |
| Supervised batch execution | Implemented (9C) |
| Unattended writes / auto-merge | **Out of scope** |

Canonical product source of truth: [`SPEC.md`](./SPEC.md)  
Agent/contributor rules: [`AGENTS.md`](./AGENTS.md)  
Roadmap: [`docs/roadmap.md`](./docs/roadmap.md)

## Architecture

pnpm monorepo:

- `artifacts/web` — Vite + React UI
- `artifacts/api` — Express API
- `lib/*` — GitHub adapters, ecosystems, dependencies, advisory, review, execution, persistence, shared types
- `lib/api-spec/openapi.yaml` — API contract → generated `@repo-guardian/api-client`

Postgres is required for durable runs, plans, fleet state, and policy audit.

## Quick start (local)

```bash
pnpm install

# Required
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/repo_guardian

# Recommended for full OAuth / App flows
export PUBLIC_APP_URL=http://localhost:5173
# plus GitHub OAuth app + App credentials as used by artifacts/api

pnpm --filter @repo-guardian/api run db:migrate
pnpm run dev
```

Useful scripts:

```bash
pnpm run dev:api
pnpm run dev:web
pnpm run generate:api-client
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

> **Note:** older docs mention `example.env`. That file is not currently in the tree; treat env setup as process/hosting config and never commit secrets.

If you still have legacy filesystem runs under `.repo-guardian/runs` or `.repo-guardian/plans`:

```bash
pnpm --filter @repo-guardian/api run db:import-legacy
```

Legacy import only carries forward saved analysis runs and pending plans. Historical `executing` / `completed` / `failed` plan files are skipped and reported.

### OAuth callback

For production GitHub OAuth, set `PUBLIC_APP_URL` to the deployed origin (for example `https://repo-guardian.onrender.com`).  
GitHub callback must be:

```text
${PUBLIC_APP_URL}/api/auth/github/callback
```

## Current scope (Milestone 9C alpha)

High-level implemented surface:

- `POST /api/analyze` — repository intake and analysis
- GitHub OAuth session context for workspace-scoped access (`Authorization: Bearer` retained as local-dev fallback)
- recursive tree fetch, manifest/lockfile detection, ecosystem inference
- normalized dependency snapshots for 20+ formats
- OSV advisory lookup behind a swappable provider
- structured dependency + code-review findings (severity, confidence, evidence, remediation hints)
- issue/PR candidate drafting with patch-planning records
- two-phase execution: `POST /api/execution/plan` then `POST /api/execution/execute`
- plan detail + events: `GET /api/execution/plans/{planId}` and `.../events`
- real GitHub Issue creation and bounded PR write-back for supported deterministic slices
- Fleet Admin: tracked repositories, fleet status, async jobs, sweep schedules, tracked PR visibility
- Workspace Access UI: sign-in, workspace selection, App installation sync, installation-backed tracking
- policy-decision history: `GET /api/policy-decisions`
- dry-run autonomy simulation in Fleet Overview
- supervised batch: `POST /api/execution/batch/plan` and `.../batch/execute`
- Guardian Graph for visual traceability
- durable Postgres-backed runs, jobs, schedules, timeline/activity state

### Fleet surfaces (read + supervised)

- `GET/POST /api/tracked-repositories` (+ history / activity / timeline)
- `GET /api/fleet/status`
- `GET/POST /api/analyze/jobs` (+ retry / cancel)
- `GET/POST /api/sweep-schedules` (+ trigger)

Scheduled work does **not** perform unattended writes. GitHub writes remain approval-gated.

## Safety principles

1. Deterministic checks first; model reasoning second.
2. Never create Issues/PRs without explicit user approval.
3. Every finding needs evidence.
4. Prefer small, reviewable PRs (one concern each).
5. Be honest about uncertainty and validation status.
6. Any future controlled autonomy must be opt-in, policy-scoped, observable, and reversible.

## Roadmap snapshot

Current: **Milestone 9C supervised batch execution** (live at production).

Next sensible further-develop goals (see `docs/FURTHER-DEVELOP-2026.md`):

1. Local ↔ prod boot reliability
2. Production-grade GitHub App ↔ workspace linking
3. Harden policy gates and fleet metrics
4. Keep write surface bounded while the foundation matures
5. Use it on personal fleets (with Witness exclusions) so the builder is also a daily user

## Related / donor patterns (reference only)

Historical sibling inspiration mentioned in `AGENTS.md` (not submodules):

- RepoRadar — GitHub interaction / issue-PR flow ideas
- Visuvoid — visual language inspiration
- dev-due-diligence — monorepo and API contract discipline

## License / stars

Public repo under [Nether403/RepoGuardian](https://github.com/Nether403/RepoGuardian). No SPDX license file is present yet — add one when you decide distribution terms.
