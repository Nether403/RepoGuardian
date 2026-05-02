# Repo Guardian

## Overview
Repo Guardian is a supervised GitHub repository triage and maintenance assistant. It automates analysis of dependency vulnerabilities and code risks, requiring explicit human approval before any write actions (creating Issues or PRs) on GitHub. Supports 20+ dependency formats across Node.js, Python, Go, Rust, JVM, and Ruby.

## Architecture
This is a **pnpm monorepo** with two main applications:

- **Frontend** (`artifacts/web/`): React 19 + Vite, served on port 5000
- **Backend API** (`artifacts/api/`): Express 5 + TypeScript, served on port 3000

### Shared Libraries (`lib/`)
- `advisory/` — OSV-backed vulnerability lookups
- `api-client/` — Generated TypeScript client for the API
- `api-spec/` — OpenAPI specification
- `dependencies/` — Dependency manifest/lockfile parsers
- `ecosystems/` — Ecosystem detection
- `execution/` — Two-phase approval-gated write execution
- `github/` — GitHub API read/write adapters
- `persistence/` — PostgreSQL client and migrations
- `shared-types/` — Common Zod schemas and TypeScript types

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Frontend**: React 19, Vite, D3 (Guardian Graph visualization)
- **Backend**: Node.js 22, Express 5
- **Database**: PostgreSQL (optional; required in production)
- **Package Manager**: pnpm 10 (workspace monorepo)
- **Testing**: Vitest, JSDOM, Supertest

## Running the Project
- Frontend: `COREPACK_ENABLE_STRICT=0 pnpm --filter @repo-guardian/web run dev` (port 5000)
- Backend: `COREPACK_ENABLE_STRICT=0 pnpm --filter @repo-guardian/api run dev` (port 3000)

## Environment Variables
See `example.env` for all variables. Key ones:
- `DATABASE_URL` — PostgreSQL connection string (optional in dev)
- `GITHUB_TOKEN` — GitHub API token for repository reads
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` — GitHub App credentials
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` — OAuth for workspace sign-in
- `API_SECRET_KEY` — Bearer token for API authentication
- `SESSION_SECRET` — Session cookie secret

## Workflows
- **Start application** — Frontend Vite dev server (port 5000, webview)
- **Backend API** — Express API server (port 3000, console)

## Notes
- The `packageManager` field in `package.json` was updated from `pnpm@10.16.1` to `pnpm@10.26.1` to match the available Replit environment version
- Vite is configured with `host: "0.0.0.0"` and `allowedHosts: true` for Replit proxy compatibility
- Frontend proxies `/api` requests to `http://localhost:3000`
- Database is optional in development; many features degrade gracefully without it
- Authentication is required for most API endpoints

## Execution queue notifications
- The API exposes `GET /api/execution/notifications/stream` as a Server-Sent Events endpoint scoped to the caller's active workspace. Events: `ready`, `plan.created`, `plan.claimed`, `plan.completed`, `plan.failed`, plus a 25s `heartbeat` comment frame.
- Subscribers are routed through `lib/notifications.ts` (`createExecutionNotificationBus`) — a workspace-scoped EventEmitter bus injected into the execution router. The bus refuses to leak events across workspaces.
- Auth: every other route uses the strict `requireAuth` middleware (header bearer only). The SSE endpoint alone uses `requireSseAuth`, which additionally accepts the bearer via `?access_token=` on GET only — needed because EventSource cannot send custom headers. The narrower scoping prevents credential leakage through URL logs, browser history, and Referer headers on non-SSE routes.
- The web app subscribes via `useExecutionNotifications` (`artifacts/web/src/hooks`) and renders a non-blocking toast (`ExecutionNotificationsToast`) with exponential-backoff reconnect and a 20-event buffer.

## Pre-execution patch validation
- Before any GitHub write call, `POST /api/execution/execute` re-synthesises every approved `prepare_patch` action against fresh repository contents using `validateApprovedPlan` (`lib/execution/src/validate-patch.ts`).
- The validator runs **before** `claimExecution` and before `executeApprovedActions`, so a failed validation never creates a branch, commit, issue, or pull request.
- Drift (re-synthesised content ≠ approved `after`) returns HTTP 409. Missing or truncated previews and synthesis errors return HTTP 422. A truncated approved preview is treated as `missing_preview` (fail-closed) — operators must regenerate the plan rather than rely on a partial byte comparison.
- On any non-match outcome the route records a denied `policy_decision_event` (same actor and repository scope as the original approval) and emits a `plan.failed` notification on the workspace bus.
