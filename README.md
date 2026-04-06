# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, 3B, 4A, 4B, 5A, and a narrow Milestone 5B write-back slice: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, structured candidate issue generation, structured PR-candidate drafting, linked patch-planning metadata, approval-gated dry-run execution planning, approved GitHub Issue creation, and approved real PR write-back for a tightly bounded workflow-hardening path.

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
- Vite + React Milestone 1 UI for repository analysis
- shared typed schemas across API and web

## Commands

```bash
pnpm install
pnpm run dev
pnpm run dev:api
pnpm run dev:web
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Next step

The next step after this Milestone 5B slice is to broaden safe PR write-back beyond workflow hardening, most likely by adding deterministic dependency-update support without guessing at lockfile changes.

## Current limitations

Review is still intentionally targeted, not repository-wide.
The deterministic rule set is narrow by design and favors low-noise findings over broad coverage.
Workflow checks are regex/text-based in this step, not full YAML semantic analysis.
Review selection is heuristic and workspace-near-risk prioritization is shallow.
Real write-back is intentionally narrow in this step.
Automated PR write-back currently supports only a bounded workflow-hardening path with deterministic file edits.
Dependency-upgrade PR candidates still stay in planning mode until the repo can refresh lockfiles without guessing.
