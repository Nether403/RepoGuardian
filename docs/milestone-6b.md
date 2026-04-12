# Milestone 6B

Milestone 6B keeps Repo Guardian on the current public contract while hardening parser fidelity for the remaining high-value ecosystem edge cases.

Goals:

- keep `/api/analyze`, `/api/execution/plan`, and `/api/runs*` stable while improving internal parser fidelity
- harden Gradle DSL parsing for named-argument and multiline dependency declarations
- resolve Maven property-backed versions when the value exists locally and surface explicit warnings when it does not
- preserve Bundler group intent through nested blocks and lockfile-backed direct dependency typing
- add parser, advisory, and mixed-ecosystem regression coverage for the hardened cases

Guardrails:

- keep the current approval-gated GitHub write behavior unchanged
- do not broaden GitHub write-back beyond the existing bounded Issue, workflow-hardening, and root npm dependency-upgrade slices
- do not change top-level API response shapes without a compatibility reason
- keep route handlers thin and continue parser/advisory logic in library packages
- surface unsupported or partial dependency coverage as explicit warnings instead of guessed findings

Follow-on milestone:

- `Milestone 6C` is the first milestone that expands bounded write-back beyond the current guarded slices
