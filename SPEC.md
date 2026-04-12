# Repo Guardian — Product Specification

## 1. Product summary

Repo Guardian is a supervised GitHub repository triage and maintenance assistant.

It accepts a GitHub repository URL or `owner/repo` slug, analyzes dependency and code risk, drafts candidate GitHub Issues and Pull Requests, and lets the user choose which actions to create.

This product is not an autonomous maintainer. It is an engineering assistant with explicit user approval before write actions.

Current implementation status:
- post-`6F` alpha, not a finished V1
- canonical routes are `/api/analyze`, `/api/execution/plan`, `/api/execution/execute`, and `/api/runs*`
- security-hardened two-phase execution model with mandatory `Authorization` headers
- GitHub write-back expansion for all supported ecosystems (now including Gradle and Yarn)

---

## 2. Product goal

Help a developer quickly answer:

- What ecosystems and package managers does this repo use?
- Are there dependency vulnerabilities or risky dependency patterns?
- Are there code-level issues worth fixing?
- Which fixes are concrete enough to turn into Issues or PRs right now?

---

## 3. V1 user outcome

A user pastes a GitHub repo and gets:

1. repository metadata
2. detected ecosystems
3. manifests and lockfiles found
4. structured vulnerability findings
5. structured code-review findings
6. candidate Issues
7. candidate PRs
8. the ability to create only the selected supported candidates

---

## 4. V1 scope

### In scope
- public GitHub repo intake
- GitHub repo metadata and recursive tree fetch
- manifest and lockfile detection
- ecosystem inference
- dependency risk analysis
- targeted code review
- candidate Issue drafting
- candidate PR drafting
- approval-gated execution planning
- selected GitHub Issue creation
- selected bounded GitHub PR creation for supported deterministic slices
- execution logging
- confidence and evidence for every finding
- local saved analysis runs and compare mode for reopening prior reports without re-analyzing live

### Out of scope
- autonomous background fixing
- auto-merge
- portfolio-wide analytics
- organization-wide governance
- billing and subscriptions
- enterprise RBAC
- CI/CD orchestration
- multi-repo batch workflows
- broad refactors without tight scope

---

## 5. Core principles

1. Deterministic checks first, model reasoning second.
2. Never create GitHub Issues or PRs without explicit user approval.
3. Every finding must include evidence.
4. Prefer small, reviewable PRs.
5. Avoid full-repo checkout unless needed.
6. Be honest about uncertainty.
7. Validation status must be visible.

---

## 6. Analysis model

### Stage A — Intake
Fetch:
- repository metadata
- default branch
- recursive tree
- top-level and nested manifests/lockfiles
- key config/workflow files

### Stage B — Dependency analysis
Detect and parse:
- Node.js
- Python
- Go
- Rust
- Java/JVM
- Ruby
- Docker / workflow signals

Normalize dependencies and flag:
- vulnerable direct dependencies
- vulnerable transitive dependencies
- missing lockfiles
- unsupported or partially analyzed dependency coverage

### Stage C — Targeted code analysis
Review:
- entrypoints
- files near vulnerable dependencies
- API handlers
- auth/security-sensitive files
- config and workflow files
- changed files if diff-based review is added later

### Stage D — Candidate generation
Produce:
- candidate issues for bounded, explainable problems
- candidate PRs only when a fix is concrete and reviewable

---

## 7. Supported ecosystem signals for V1

### Node.js
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`

### Python
- `requirements.txt`
- `pyproject.toml`
- `poetry.lock`
- `Pipfile`
- `Pipfile.lock`

### Go
- `go.mod`
- `go.sum`

### Rust
- `Cargo.toml`
- `Cargo.lock`

### Java / JVM
- `pom.xml`
- `build.gradle`
- `build.gradle.kts`
- `gradle.lockfile`

### Ruby
- `Gemfile`
- `Gemfile.lock`

### Infra / config signals
- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows/*`

---

## 8. Findings model

Each finding must include:

- `id`
- `title`
- `category`
- `severity`
- `confidence`
- `sourceType`
- `paths`
- `lineSpans` when available
- `summary`
- `evidence`
- `recommendedAction`
- `candidateIssue`
- `candidatePr`

### Severity values
- `critical`
- `high`
- `medium`
- `low`
- `info`

### Confidence values
- `high`
- `medium`
- `low`

### Source types
- `dependency`
- `code`
- `config`
- `workflow`

---

## 9. Candidate Issue rules

Generate an Issue candidate only when:
- the problem is real enough to describe clearly
- the scope is understandable
- the user would benefit from tracking it

Each candidate Issue must include:
- title
- summary
- why it matters
- affected files or packages
- acceptance criteria
- suggested labels
- confidence note

Avoid duplicate issues.

---

## 10. Candidate PR rules

Generate a PR candidate only when:
- the fix is concrete
- the change is bounded
- the patch can be explained
- the risk is acceptable

Each candidate PR must include:
- title
- summary
- files expected to change
- risk level
- validation status
- test plan
- linked findings

Do not propose a PR when:
- the fix is speculative
- too many files would change
- validation is impossible and confidence is low
- the change would be architectural rather than targeted

---

## 11. GitHub write actions in the current alpha

Supported in the current alpha:
- create selected GitHub Issues from issue candidates
- create branch, update file(s), commit a patch, and open a pull request for bounded workflow-hardening candidates
- create branch, update repo-root manifest/lockfile for supported ecosystems (npm, yarn, go, rust, python, maven, gradle), commit a patch, and open a pull request for bounded dependency-upgrade candidates when deterministic patch rules apply

Not supported:
- arbitrary PR-candidate write-back outside the bounded supported slices
- auto-merge
- force-push
- amend history
- close existing issues automatically
- assign reviewers automatically

All write actions require explicit user approval.

---

## 12. Technical architecture

Repo Guardian should be a pnpm workspace monorepo.

### Planned packages

- `artifacts/web` — React frontend
- `artifacts/api` — API server
- `lib/shared-types` — shared domain types and schemas
- `lib/github` — GitHub read/write adapters
- `lib/ecosystems` — manifest and lockfile detection plus ecosystem inference
- `lib/dependencies` — dependency parsing and snapshot normalization
- `lib/advisory` — advisory normalization and dependency findings
- `lib/review` — targeted review logic
- `lib/issues` — candidate issue drafting
- `lib/prs` — candidate PR drafting
- `lib/patches` — patch planning and traceability
- `lib/execution` — dry-run planning plus bounded write execution
- `lib/runs` — local saved analysis run storage and compare logic
- `lib/analysis-view-model` — reusable analysis UI formatting helpers
- `lib/api-spec` — OpenAPI contract for API routes
- `lib/api-client` — generated web API client functions

---

## 13. API shape for the current alpha contract

Canonical routes:
- `POST /api/analyze`
- `POST /api/execution/plan`
- `POST /api/execution/execute`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

Contract rules:
- `POST /api/analyze` returns the shared `AnalyzeRepoResponse` payload directly.
- `AnalyzeRepoResponse` stays backward-compatible while dependency coverage expands.
- `POST /api/execution/plan` and `POST /api/execution/execute` form the canonical two-phase execution model.
- `plan` creates a short-lived approval token and hashes the actions; it performs no write-back.
- `execute` requires the token, a matching hash, and an explicit confirmation string; it performs the actual GitHub writes.
- All canonical routes require `Authorization: Bearer <API_SECRET_KEY>`.
- the older split write routes such as `/api/issues/create` and `/api/prs/create` are not part of the canonical contract.

---

## 14. UI requirements for early milestones

Main views should include:
- repository intake
- analysis state
- repository summary
- saved analysis runs and compare results
- ecosystems
- manifests and lockfiles
- findings
- candidate Issues
- candidate PRs
- execution logs

UI style:
- clean and readable
- mildly inspired by Visuvoid / VisualGit visuals
- not heavy or theatrical
- reusable badges and panels for later milestones

---

## 15. Donor repo guidance

### `../RepoRadar`
Use for:
- GitHub workflow ideas
- issue/PR creation patterns
- product flow inspiration

### `../Visuvoid`
Use for:
- UI inspiration
- presentation patterns
- result-display ideas

### `../dev-due-diligence`
Use for:
- monorepo structure
- backend package boundaries
- API contract discipline
- validation patterns

---

## 16. Milestones

### Milestone 1-5 [COMPLETE]
Initial foundation and basic write-back slices.

### Milestone 6A
- align documents and OpenAPI with implemented contract
- keep `/api/analyze`, `/api/execution/plan`, and `/api/runs*` canonical

### Milestone 6B-6F (Hardening & Expansion) [COMPLETE]
- hardened parser fidelity for Gradle, Maven, and Bundler
- expanded bounded write-back to include Go, Rust, Ruby, Python (pyproject), Gradle, and Yarn
- implemented two-phase execution security model (`plan` -> `execute`)
- added mandatory API-key authentication for all analytical and execution routes

---

## 17. Acceptance criteria for Milestone 6F [PASSED]

Milestone 6F is complete when:
- deterministic GitHub write-back accurately processes `build.gradle`, `build.gradle.kts`, and Yarn `package.json` targets
- Gradle DSL variable interpolations are explicitly blocked
- Yarn write-back updates `package.json` only
- existing API routes safely gate these updates
- lint, typecheck, test, and build pass
