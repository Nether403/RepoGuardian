# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation plus the Milestone 2A and 2B backend slices: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, dependency parsing into a normalized snapshot, and advisory-backed dependency findings.

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

Milestone 3 adds targeted code-review findings on top of the dependency analysis without introducing issue drafting, PR drafting, or GitHub write-back yet.
