# Repo Guardian — Working Rules for Codex

## Scope

This `AGENTS.md` applies to the entire `repo-guardian` repository unless a deeper nested `AGENTS.md` overrides part of it.

Sibling folders may exist in the workspace, including:
- `../RepoRadar`
- `../Visuvoid`
- `../dev-due-diligence`

They are reference-only.
Do not modify files outside `repo-guardian`.

---

## Mission

Build Repo Guardian as a supervised GitHub repository triage and maintenance assistant.

Follow `SPEC.md` as the product source of truth.
Stay inside the current milestone unless explicitly told otherwise.

---

## Priority order

1. Correctness
2. Clear structure
3. Small, reviewable changes
4. Strong typing
5. Good tests
6. Clean UI
7. Speed

---

## Delivery rules

- Implement the smallest complete version of the requested step.
- Do not expand scope on your own.
- Do not add auth, billing, subscriptions, enterprise controls, or background jobs unless explicitly requested.
- Do not modify sibling repos.
- Do not paste large code sections from donor repos; adapt patterns thoughtfully.

---

## Repository structure expectations

Prefer this structure:

- `artifacts/web` — frontend app
- `artifacts/api` — backend API
- `lib/shared-types` — shared types and schemas
- `lib/github` — GitHub adapters
- `lib/ecosystems` — ecosystem detection and repo signals
- `lib/dependencies` — dependency parsing and normalization
- `lib/advisory` — dependency/advisory logic
- `lib/review` — code review logic
- `lib/execution` — issue/PR execution logic

Keep business logic out of route handlers.
Keep provider-specific code behind clear module boundaries.

---

## Architecture rules

- Use TypeScript everywhere.
- Prefer pure functions for detection and transformation logic.
- Keep route handlers thin.
- Validate external input with Zod.
- Centralize shared domain types.
- Separate read-only GitHub operations from write-capable GitHub operations.
- Prefer deterministic analysis before model-based reasoning.
- Make findings and candidates structured, typed, and testable.

---

## Coding rules

- Avoid `any` unless truly unavoidable.
- Use descriptive names.
- Keep functions focused.
- Avoid giant files.
- Add comments only where they improve understanding.
- Prefer composition over inheritance.
- Prefer simple data flow over clever abstractions.

---

## Product behavior rules

- Never create GitHub Issues or PRs without explicit user approval.
- Never claim a vulnerability without evidence.
- Never mark a candidate PR as ready if validation did not run or clearly could not run.
- Prefer one concern per PR candidate.
- Be honest about uncertainty in findings and candidate generation.

---

## UI rules

- Keep UI readable and calm.
- Draw light inspiration from `../Visuvoid`, not direct imitation.
- Favor information clarity over decorative effects.
- Build reusable panels, badges, and tables that will still work in later milestones.
- Keep UI ambition proportional to the current milestone.

---

## Donor repo usage rules

### `../RepoRadar`
Use for:
- GitHub interaction ideas
- issue/PR flow ideas
- API workflow inspiration

Do not inherit:
- monolithic route structure
- unrelated product features
- billing/auth/subscription logic
- speculative AI-only review patterns

### `../Visuvoid`
Use for:
- visual language
- result presentation
- layout inspiration

Do not inherit:
- heavyweight visual effects unless explicitly requested

### `../dev-due-diligence`
Use for:
- monorepo structure
- package boundaries
- API contract discipline
- validation approach

Do not inherit:
- unrelated profile/benchmark domain logic

---

## Milestone discipline

### Active milestone: Post-Milestone 6F / Stabilization
Allowed:
- keep `/api/analyze`, `/api/execution/plan`, `/api/execution/execute`, and `/api/runs*` as the canonical public contract
- ensure deterministic patch PR generation for already supported ecosystems (including Gradle and Yarn) stays stable
- maintain the two-phase approval-gated and authenticated GitHub write behavior

Not allowed in this milestone unless explicitly requested:
- broaden GitHub write-back beyond the existing bounded slices (now including the new 6F targets)
- add autonomous or background execution
- add auth, billing, subscriptions, or enterprise controls
- change top-level API response shapes without a compatibility reason

If asked for work in an earlier milestone, stay inside that explicitly requested milestone.

---

## Testing and validation rules

After making changes, always run the relevant checks.

Minimum expected checks:
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`

When applicable also run:
- `pnpm run build`

If a check fails:
- make a best effort to fix it
- rerun the check
- report remaining failures honestly

Do not claim work is complete without running checks unless tooling is missing, broken, or not yet scaffolded, and then say so clearly.

---

## Git and change management rules

- Make small coherent changes.
- Do not rewrite unrelated code.
- Do not modify or amend existing commits unless explicitly asked.
- Do not create or modify files outside this repo.
- Keep the worktree clean before finishing if git workflow is part of the task.

---

## Documentation rules

- Keep `SPEC.md` aligned with the actual product direction.
- Update README when setup or commands change.
- If architecture changes materially, add or update milestone docs.

---

## Expected final task summary

When finishing a task, report:
1. what changed
2. checks run
3. results of those checks
4. any known limitations
5. the next sensible step

Keep summaries concise and honest.
