# RepoGuardian further-develop plan (2026-07)

Notes for continuing an **already live, unfinished** product — not a cold restart.

## Live product

- **URL:** https://RepoGuardian.101dev.xyz  
- **State:** Milestone 9C alpha (supervised batch execution) — functional, not finished V1  
- **Framing:** **Further develop** (build out remaining milestones / polish / daily-use readiness)

“Revive” was the wrong word. The service was built, deployed, shared, then deprioritized. The need never left.

## Intent

Keep RepoGuardian as an active product priority. Use it for supervised multi-repo triage (including the broader Nether403 cleanup program), while finishing the parts that still feel alpha.

## Hard constraints

- **Do not touch Witness Protocol repositories** in any automated fleet action until explicitly allowed:
  - `TWP`, `TWPWEB`, `TWP-V2.0`, `TowardsType2` (and any future `thewprotocol` / Witness-named repos)
- No unattended GitHub writes
- No scope explosion into billing/enterprise RBAC unless product decision says so

## Continue sequence

1. **Docs (this PR)** — STATUS + README clarity + this further-develop plan + live URL
2. **Local ↔ prod parity**
   - Postgres `DATABASE_URL`
   - `pnpm install`
   - `pnpm --filter @repo-guardian/api run db:migrate`
   - `pnpm run lint && pnpm run typecheck && pnpm run test`
3. **Auth path**
   - Confirm production OAuth callback via `PUBLIC_APP_URL` / live domain
   - GitHub App installation registration + workspace sync
4. **Smoke on live or staging**
   - Analyze a throwaway public repo
   - Create plan only (no execute) on a sandbox
   - Confirm policy-decision rows persist
5. **Product next**
   - Reconcile `docs/roadmap.md` with actual 9C completion
   - Decide Milestone 10: policy recommendation UX vs fleet metrics hardening
   - Optional: point RepoGuardian at Nether403 personal repos after exclusions are configured

## Success criteria for “further developed enough for daily use”

- [ ] Fresh clone boots with documented env
- [ ] Tests green on mainline
- [ ] One successful supervised analyze → plan cycle
- [ ] STATUS.md remains `FURTHER DEVELOP — active priority`
- [ ] Live URL stays healthy
- [ ] Public README makes alpha + approval-gated nature obvious in <30 seconds

## Out of scope for this kickoff

- Rewriting analysis engines
- Expanding ecosystem write-back
- Archiving or deleting other repos from this product automatically
