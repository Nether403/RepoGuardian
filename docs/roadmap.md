# Repo Guardian Roadmap

## Current status

Repo Guardian is currently a post-`6F` alpha. The implemented contract is centered on a security-hardened, two-phase execution model:

- `POST /api/analyze`
- `POST /api/execution/plan` (Planning)
- `POST /api/execution/execute` (Execution)
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

All routes require `Authorization: Bearer <API_SECRET_KEY>`.

## Active milestone: Post-6F Stabilization

- maintain stability of the established two-phase contract
- ensure high fidelity of deterministic patch generation across all supported ecosystems
- improve error handling and traceability in the Guardian Graph
- prepare for V1 release candidate
