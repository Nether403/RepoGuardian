# Milestone 6A

Milestone 6A treats Repo Guardian as a post-`5B` alpha rather than a finished V1 and aligns the contract with the code that exists today.

Goals:

- align `SPEC.md`, `README.md`, `AGENTS.md`, and `lib/api-spec/openapi.yaml` around the canonical routes `/api/analyze`, `/api/execution/plan`, and `/api/runs*`
- keep `AnalyzeRepoResponse` backward-compatible while dependency coverage expands through `dependencySnapshot`, findings, candidate generation, and warnings
- expand deterministic dependency parsing and advisory normalization for supported Node.js, Python, Go, Rust, JVM, and Ruby formats
- add mixed-ecosystem API and web regression coverage

Guardrails:

- keep the current approval-gated write behavior unchanged
- do not broaden GitHub write-back beyond the existing bounded Issue, workflow-hardening, and root npm dependency-upgrade slices
- keep route handlers thin and continue parsing/advisory logic in library packages
- surface unsupported or partial dependency coverage as explicit warnings instead of guessed findings

Follow-on milestone:

- `Milestone 6B` hardens parser fidelity for Gradle, Maven, and Bundler before any broader write-back work
- `Milestone 6C` is the first milestone that expands bounded write-back beyond the current guarded slices
