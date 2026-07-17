# RepoGuardian revive plan (2026-07)

Non-destructive revive notes for the 2026 hygiene / product-priority pass.

## Intent

RepoGuardian is **revived as an active product**, not archived. It is the natural tool for supervised multi-repo triage (including the broader Nether403 cleanup program).

## Hard constraints

- **Do not touch Witness Protocol repositories** in any automated fleet action until explicitly allowed:
  - `TWP`, `TWPWEB`, `TWP-V2.0`, `TowardsType2` (and any future `thewprotocol` / Witness-named repos)
- No unattended GitHub writes
- No scope explosion into billing/enterprise RBAC unless product decision says so

## Restart sequence

1. **Docs (this PR)** — STATUS + README clarity + this revive plan
2. **Local boot**
   - Postgres `DATABASE_URL`
   - `pnpm install`
   - `pnpm --filter @repo-guardian/api run db:migrate`
   - `pnpm run lint && pnpm run typecheck && pnpm run test`
3. **Auth path**
   - GitHub OAuth app callback via `PUBLIC_APP_URL`
   - GitHub App installation registration + workspace sync
4. **Smoke**
   - Analyze a throwaway public repo
   - Create plan only (no execute) on a sandbox
   - Confirm policy-decision rows persist
5. **Product next**
   - Reconcile `docs/roadmap.md` with actual 9C completion (roadmap still narrates earlier phases in places)
   - Decide Milestone 10 name: policy recommendation UX vs fleet metrics hardening
   - Optional: use RepoGuardian **on** Nether403 personal repos after exclusions are configured

## Success criteria for “revived”

- [ ] Fresh clone boots with documented env
- [ ] Tests green on mainline revive branch
- [ ] One successful supervised analyze → plan cycle in a non-prod workspace
- [ ] STATUS.md remains `REVIVE — active priority`
- [ ] Public README makes alpha + approval-gated nature obvious in <30 seconds

## Out of scope for revive kickoff

- Rewriting analysis engines
- Expanding ecosystem write-back
- Archiving or deleting other repos from this product automatically
