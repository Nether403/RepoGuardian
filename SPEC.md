# Repo Guardian — Product Specification

## 1. Product summary

Repo Guardian is a supervised GitHub repository triage and maintenance assistant.

It accepts a GitHub repository URL or `owner/repo` slug, analyzes dependency and code risk, drafts candidate GitHub Issues and Pull Requests, and lets the user choose which actions to create.

This product is not an autonomous maintainer. It is an engineering assistant with explicit user approval before write actions.

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
8. the ability to create only the selected candidates

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
- selected Issue creation
- selected PR creation
- execution logging
- confidence and evidence for every finding

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
- outdated packages
- risky version ranges
- missing lockfiles
- suspicious package patterns

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

## 11. GitHub write actions in V1

Supported:
- create issue
- create branch
- update file(s)
- commit patch
- open pull request

Not supported:
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
- `lib/ecosystems` — manifest and lockfile detection/parsing
- `lib/advisory` — vulnerability/advisory normalization
- `lib/review` — targeted review logic
- `lib/execution` — write-action execution and logs

---

## 13. API shape for early milestones

### `POST /api/analyze`
Input:
- `repoInput`

Output:
- `analysisRunId` or direct payload in Milestone 1

### `GET /api/analyze/:id`
Output:
- repository summary
- detected ecosystems
- manifests and lockfiles
- findings
- issue candidates
- pr candidates
- warnings
- progress

### `POST /api/issues/create`
Input:
- analysis run id
- selected issue candidate ids

### `POST /api/prs/create`
Input:
- analysis run id
- selected pr candidate ids

---

## 14. UI requirements for early milestones

Main views should include:
- repository intake
- analysis state
- repository summary
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

### Milestone 2
- dependency parsing
- advisory lookup interface
- structured dependency findings

### Milestone 3
- targeted code review
- structured code findings
- candidate issue generation

### Milestone 4
- candidate PR generation
- validation status
- execution logging

### Milestone 5
- create selected GitHub Issues
- create selected GitHub PRs
- polish UX

---

## 17. Acceptance criteria for Milestone 1

Milestone 1 is complete when:
- a user can enter a public GitHub repo
- the app fetches metadata and tree successfully
- manifests and lockfiles are detected
- ecosystems are inferred
- results render in the UI
- basic tests pass
- lint and typecheck pass

---

## 18. Non-goals for Codex during Milestone 1

Codex should not:
- add auth
- add billing
- add subscriptions
- add background jobs
- add vulnerability logic yet
- add GitHub write-back yet
- redesign the whole product beyond Milestone 1 needs