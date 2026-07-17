# Repository status

| Field | Value |
|---|---|
| **Status** | **REVIVE — active priority** |
| **Classification** | Core product (supervised GitHub triage) |
| **Last known milestone** | Milestone 9C alpha (supervised batch execution) |
| **Owner intent (2026-07)** | Revive and continue; do not archive |
| **Witness Protocol related** | No — safe to modify |
| **Triage pass** | README + revive docs (non-destructive) |

## Why this repo matters

RepoGuardian is a supervised GitHub repository triage and maintenance assistant: analyze repos, surface dependency/code risk, draft Issues/PRs, and only write to GitHub after explicit approval. It is the natural home for fleet-level cleanup workflows (including the broader Nether403 repo hygiene pass).

## Revive checklist

- [x] Confirm repo is not Witness Protocol related
- [x] Confirm existing README / SPEC / AGENTS still coherent
- [x] Add clear revival status + onboarding-oriented README
- [ ] Local boot: `pnpm install`, Postgres, `db:migrate`, `pnpm run dev`
- [ ] Re-validate GitHub OAuth + App install path
- [ ] Align `docs/roadmap.md` with post-9C next steps
- [ ] Smoke-test analyze + plan + execute dry paths

## Do not

- Archive this repository
- Enable unattended GitHub writes
- Broaden write-back beyond existing bounded slices without a new milestone decision
