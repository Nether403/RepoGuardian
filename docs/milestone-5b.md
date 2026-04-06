# Milestone 5B

Milestone 5B adds explicit GitHub write-back on top of the existing dry-run execution planning.

Current real-write scope:

- approved GitHub Issue creation for selected issue candidates
- approved branch creation from the default branch
- approved bounded workflow-hardening patch synthesis for a single workflow file
- approved commit creation for the synthesized workflow patch
- approved pull request opening for the resulting branch

Guardrails:

- `execute_approved` stays blocked unless `approvalGranted` is explicitly `true`
- every write-oriented action records approval requirement and approval status
- unsupported or non-patchable PR candidates stay blocked instead of guessing a patch
- dependency-upgrade PR candidates remain planning-only until lockfile updates can be produced deterministically
