# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation plus the Milestone 2A, 2B, 3A, and 3B backend slices: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, advisory-backed dependency findings, targeted code-review findings, and structured candidate issue generation.

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

Milestone 4 can build PR-candidate drafting on top of the existing dependency findings, code-review findings, and structured issue candidates without introducing GitHub write-back yet.

## Current limitations

Review is still intentionally targeted, not repository-wide.
The deterministic rule set is narrow by design and favors low-noise findings over broad coverage.
Workflow checks are regex/text-based in this step, not full YAML semantic analysis.
Review selection is heuristic and workspace-near-risk prioritization is shallow.
No GitHub issue creation, PR drafting, or write-back behavior was added. 
