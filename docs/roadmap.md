# Repo Guardian Roadmap

## Current status

Repo Guardian is currently a post-`5B` alpha. The implemented contract is centered on:

- `POST /api/analyze`
- `POST /api/execution/plan`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

GitHub write-back remains approval-gated and intentionally narrow: selected Issue creation, bounded workflow-hardening PR execution, and bounded root npm dependency-upgrade PR execution.

## Active milestone: 6A

`Milestone 6A` is V1 contract alignment first:

- align docs and OpenAPI with the implemented route surface
- expand dependency-analysis coverage across supported ecosystems
- preserve `AnalyzeRepoResponse` compatibility
- add mixed-ecosystem regression coverage

See `docs/milestone-6a.md` for the active milestone guardrails.

## Next milestone: 6B

`Milestone 6B` is bounded write-back expansion:

- add new deterministic write-back slices only after the contract and analysis surface are aligned
- keep approval-gated execution and explicit write guardrails
- avoid autonomous maintenance, background jobs, or broad patch synthesis
