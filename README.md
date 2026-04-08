# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, 3B, 4A, 4B, 5A, and a narrow Milestone 5B write-back slice: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, structured candidate issue generation, structured PR-candidate drafting, linked patch-planning metadata, deterministic Guardian Graph visual reporting, local saved analysis runs with compare mode, OpenAPI-backed generated web API client functions, approval-gated dry-run execution planning, approved GitHub Issue creation, approved real PR write-back for a tightly bounded workflow-hardening path, and approved deterministic npm dependency write-back for a tightly bounded root `package.json` plus `package-lock.json` v2/v3 path.

## Current scope

- pnpm workspace monorepo
- `POST /api/analyze` for public GitHub repository intake
- recursive tree fetch for the default branch
- manifest and lockfile detection
- ecosystem inference and notable repository signals
- dependency file fetches from GitHub for supported Node.js and Python formats
- normalized dependency snapshot parsing for direct and lockfile-backed package records
- OSV-backed advisory lookup behind a swappable provider interface
- structured dependency findings with severity, confidence, evidence, and remediation hints
- targeted code-review file selection for workflows, config, security-sensitive files, and common entrypoints
- deterministic code-review findings for secret-like literals, dangerous dynamic execution, unsafe shell execution, and workflow hardening risks
- deterministic issue-candidate grouping across dependency and code-review findings
- structured candidate issues with titles, summaries, labels, acceptance criteria, and finding traceability
- deterministic PR-candidate drafting with readiness, risk, expected file changes, and rollback/test guidance
- linked patch-planning records with patchability, patch plans, validation-status preparation, and traceability back to PR candidates
- `POST /api/execution/plan` for approval-gated dry-run planning and explicitly approved execution
- structured execution action results with per-action success/failure, branch metadata, commit metadata, and issue/PR metadata
- real GitHub Issue creation for selected issue candidates when `approvalGranted` is explicitly true
- real branch creation, bounded workflow-file patch commits, and PR opening for selected workflow-hardening PR candidates when `approvalGranted` is explicitly true
- real branch creation, bounded root `package.json` plus `package-lock.json` v2/v3 patch commits, and PR opening for selected npm dependency-upgrade PR candidates when `approvalGranted` is explicitly true and deterministic lock metadata already exists in the current lockfile
- Vite + React UI for repository analysis, candidate selection, dry-run execution previews, approved execution submission, and structured action results
- reusable analysis view-model helpers for traceability formatting, anchors, filters, summaries, and status tones
- deterministic Guardian Graph view for visual traceability across repository signals, findings, candidates, patch plans, and write-back eligibility
- `GET /api/runs`, `POST /api/runs`, `GET /api/runs/:runId`, and `POST /api/runs/compare` for local saved analysis runs and compare mode
- file-backed local/dev saved-run storage under `.repo-guardian/runs` by default, overridable with `REPO_GUARDIAN_RUN_STORE_DIR`
- UI for saving current analyses, reopening saved reports without re-analyzing live, and comparing findings, candidates, executable patch plans, blocked patch plans, ecosystems, manifests, and lockfiles across runs
- `lib/api-spec/openapi.yaml` as the API contract for analyze, execution planning, and saved-run endpoints
- generated `@repo-guardian/api-client` endpoint functions consumed by the web app's validated client wrappers
- shared typed schemas across API and web

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

## Next step

The next step is to expand bounded write-back slices while keeping the existing approval and deterministic patch-synthesis guardrails.


