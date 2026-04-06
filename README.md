# Repo Guardian

Repo Guardian is a supervised GitHub repository triage and maintenance assistant. This repository is currently in Milestone 1 Prompt 1: workspace foundation only.

## Current scope

- pnpm workspace scaffold
- Express API scaffold with `GET /health`
- Vite + React web shell
- Placeholder package boundaries for shared types, GitHub reads, and ecosystem logic

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

Prompt 2 adds repository intake plus the Milestone 1 `POST /api/analyze` contract.
