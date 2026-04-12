# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo should be treated as a post-`6F` alpha rather than a finished V1: it implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, 3B, 4A, 4B, 5A, 5B, 6A, 6B, 6C, 6D, 6E, and 6F write-back slices across public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, structured candidate issue generation, structured PR-candidate drafting, linked patch-planning metadata, deterministic Guardian Graph visual reporting, local saved analysis runs with compare mode, OpenAPI-backed generated web API client functions, security-hardened two-phase execution planning, approved GitHub Issue creation, approved real PR write-back for a tightly bounded workflow-hardening path, and approved deterministic dependency write-back for root `package.json` (npm/yarn), `package-lock.json` (v2/v3), `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, `pom.xml`, and `build.gradle`/`build.gradle.kts` paths.

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
- real GitHub Issue creation and bounded Pull Request write-back for supported deterministic slices
- Vite + React UI for analysis, candidate selection, two-phase execution previews, and results
- deterministic Guardian Graph view for visual traceability
- `GET /api/runs`, `POST /api/runs`, etc. for local saved analysis runs and compare mode
- `lib/api-spec/openapi.yaml` as the API contract
- generated `@repo-guardian/api-client` and shared typed schemas

## Commands

```bash
pnpm install
pnpm run dev
pnpm run dev:api
pnpm run dev:web
pnpm run generate:api-client
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Roadmap

The current state reflects the completion of **Milestone 6F** (Gradle and Yarn write-back expansion). The platform now supports deterministic patch generation across all primary supported ecosystems.

The next goals are stabilization, performance optimization for large repositories, and potential expansion into multi-repo analysis. See `docs/roadmap.md`.
