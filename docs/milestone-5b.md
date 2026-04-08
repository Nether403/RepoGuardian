# Milestone 5B

Milestone 5B adds explicit GitHub write-back on top of the existing dry-run execution planning.

Current real-write scope:

- approved GitHub Issue creation for selected issue candidates
- approved branch creation from the default branch
- approved bounded workflow-hardening patch synthesis for a single workflow file with deterministic permissions rewrites (`permissions: write-all`, explicit `contents: write`, or missing top-level permissions)
- approved bounded deterministic dependency-upgrade patch synthesis for repo-root `package.json` plus `package-lock.json` v2/v3
- approved commit creation for the synthesized workflow patch
- approved commit creation for the synthesized dependency patch
- approved pull request opening for the resulting branch

Guardrails:

- `execute_approved` stays blocked unless `approvalGranted` is explicitly `true`
- every write-oriented action records approval requirement and approval status
- unsupported or non-patchable PR candidates stay blocked instead of guessing a patch
- deterministic dependency write-back is limited to direct npm upgrades with one package, one linked finding, one remediation version, and repo-root `package.json` plus `package-lock.json` v2/v3
- no registry calls, lockfile regeneration, workspace inference, or broad dependency churn are allowed in this slice
- dependency candidates stay blocked when lock metadata cannot be recovered uniquely from the current `package-lock.json`
