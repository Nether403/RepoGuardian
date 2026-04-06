# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. The current repo implements the Milestone 1 foundation: public GitHub intake, metadata and tree fetch, deterministic manifest detection, ecosystem inference, and a basic web interface over the shared analyze contract.

## Current scope

- pnpm workspace monorepo
- `POST /api/analyze` for public GitHub repository intake
- recursive tree fetch for the default branch
- manifest and lockfile detection
- ecosystem inference and notable repository signals
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

Finish the Milestone 1 UI polish and validation loop, then begin Milestone 2 dependency parsing and advisory integration.
