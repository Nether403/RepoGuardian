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
