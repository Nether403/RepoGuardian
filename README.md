# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, 3B, 4A, 4B, and 5A backend slices: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, structured candidate issue generation, structured PR-candidate drafting, linked patch-planning metadata, and approval-gated dry-run execution planning.

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
- `POST /api/execution/plan` for approval-gated dry-run execution planning across issue candidates, PR candidates, and linked patch plans
- structured execution action plans and execution-log style results for later write-enabled milestones
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

Milestone 5B can build real GitHub write-back on top of the existing approval-gated execution planning and dry-run execution results.

## Current limitations

Review is still intentionally targeted, not repository-wide.
The deterministic rule set is narrow by design and favors low-noise findings over broad coverage.
Workflow checks are regex/text-based in this step, not full YAML semantic analysis.
Review selection is heuristic and workspace-near-risk prioritization is shallow.
No GitHub issue creation, remote patch application, or GitHub write-back behavior was added. 
Execution planning is dry-run only in Milestone 5A; `execute_approved` returns a structured blocked result.
