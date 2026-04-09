# Repo Guardian — Product Specification

## 1. Product summary

Repo Guardian is a supervised GitHub repository triage and maintenance assistant.

It accepts a GitHub repository URL or `owner/repo` slug, analyzes dependency and code risk, drafts candidate GitHub Issues and Pull Requests, and lets the user choose which actions to create.

This product is not an autonomous maintainer. It is an engineering assistant with explicit user approval before write actions.

Current implementation status:
- post-`5B` alpha, not a finished V1
- canonical routes are `/api/analyze`, `/api/execution/plan`, and `/api/runs*`
- GitHub write-back is intentionally narrow and approval-gated

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
- create branch, update repo-root `package.json` plus `package-lock.json` v2/v3, commit a patch, and open a pull request for bounded npm dependency-upgrade candidates when deterministic lock metadata already exists

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
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/{runId}`
- `POST /api/runs/compare`

Contract rules:
- `POST /api/analyze` returns the shared `AnalyzeRepoResponse` payload directly.
- `AnalyzeRepoResponse` stays backward-compatible while dependency coverage expands.
- dependency expansion flows through `dependencySnapshot`, findings, candidate generation, and warnings rather than new top-level response envelopes.
- `POST /api/execution/plan` is the canonical route for both dry-run planning and explicitly approved execution.
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

Use sibling repos for reference only.

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

Do not modify any sibling repo.

---

## 16. Milestones

### Milestone 1
- scaffold app
- repo input
- GitHub metadata + tree fetch
- manifest/lockfile detection
- ecosystem inference
- basic UI and tests

### Milestone 2A
- dependency parsing
- advisory lookup interface
- structured dependency findings

### Milestone 2B
- broaden supported Node.js and Python dependency formats
- normalize dependency snapshots for direct and lockfile-backed records

### Milestone 3A
- targeted code review
- structured code findings
- issue-candidate grouping foundations

### Milestone 3B
- structured candidate issue drafting
- finding-to-issue traceability

### Milestone 4A
- candidate PR generation
- validation status
- linked patch-planning metadata

### Milestone 4B
- deterministic Guardian Graph reporting
- reusable analysis view-model helpers

### Milestone 5A
- approval-gated dry-run execution planning
- execution action results and UX polish

### Milestone 5B
- approved GitHub Issue creation
- approved bounded workflow-hardening PR write-back
- approved bounded root npm dependency-upgrade PR write-back

### Milestone 6A
- align `SPEC.md`, `README.md`, `AGENTS.md`, and OpenAPI with the implemented contract
- keep `/api/analyze`, `/api/execution/plan`, and `/api/runs*` canonical
- expand dependency parsing and advisory normalization coverage for Node.js, Python, Go, Rust, JVM, and Ruby formats
- add mixed-ecosystem API and web regression coverage
- preserve the current write-back guardrails without broadening them

### Milestone 6B
- harden parser fidelity before any broader write-back expansion
- focus on Gradle DSL coverage, Maven property/version resolution, and nontrivial Bundler declarations
- keep explicit warnings for unsupported or heuristic-heavy cases instead of guessed findings

### Milestone 6C
- expand bounded write-back slices only after contract alignment, coverage expansion, and parser hardening are complete
- keep approval-gated deterministic execution constraints
- avoid autonomous repository maintenance

---

## 17. Acceptance criteria for Milestone 6A

Milestone 6A is complete when:
- `SPEC.md`, `README.md`, `AGENTS.md`, and `lib/api-spec/openapi.yaml` agree on the current alpha status and canonical routes
- `POST /api/analyze`, `POST /api/execution/plan`, and `/api/runs*` remain stable and documented as the canonical contract
- supported Node.js, Python, Go, Rust, JVM, and Ruby manifests and lockfiles parse into the normalized dependency snapshot
- advisory normalization uses exact versions when available and surfaces explicit warnings when coverage is partial
- mixed-ecosystem API and web regression coverage passes
- lint, typecheck, test, and build pass

---

## 18. Non-goals for Codex during Milestone 6A

Codex should not:
- add auth
- add billing
- add subscriptions
- add background jobs
- broaden GitHub write-back beyond the current bounded supported slices
- redesign the whole product beyond contract alignment and analysis coverage needs
- invent weak dependency findings when exact version evidence is unavailable
