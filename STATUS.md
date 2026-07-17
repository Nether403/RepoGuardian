# Repository status

| Field | Value |
|---|---|
| **Status** | **FURTHER DEVELOP — active priority** |
| **Classification** | Core product (supervised GitHub triage) — **live, unfinished** |
| **Live URL** | https://RepoGuardian.101dev.xyz |
| **Last known milestone** | Milestone 9C alpha (supervised batch execution) |
| **Owner intent (2026-07)** | Continue development (not archive; not a cold restart) |
| **Witness Protocol related** | No — safe to modify |
| **Triage pass** | README + further-develop docs |

## Why this repo matters

RepoGuardian is a supervised GitHub repository triage and maintenance assistant: analyze repos, surface dependency/code risk, draft Issues/PRs, and only write to GitHub after explicit approval.

It is **already live and functional** at [RepoGuardian.101dev.xyz](https://RepoGuardian.101dev.xyz). It was never abandoned infrastructure — it was built, shared, then left unfinished. The correct framing is **further develop**, not revive-from-death.

Ironic product-market fit: the builder is also the customer who most needs fleet hygiene.

## Further-develop checklist

- [x] Confirm repo is not Witness Protocol related
- [x] Confirm product is live at production URL
- [x] Confirm existing README / SPEC / AGENTS still coherent
- [x] Reframe docs from “revive” → “further develop”
- [ ] Local boot parity with production: `pnpm install`, Postgres, `db:migrate`, `pnpm run dev`
- [ ] Re-validate GitHub OAuth + App install path against live config
- [ ] Align `docs/roadmap.md` with post-9C next steps
- [ ] Smoke-test analyze + plan + execute dry paths against a sandbox
- [ ] Close gaps that make “unfinished alpha” feel finished enough for daily personal use

## Do not

- Archive this repository
- Treat production as disposable
- Enable unattended GitHub writes
- Broaden write-back beyond existing bounded slices without a new milestone decision
