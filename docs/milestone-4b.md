# Milestone 4B

Milestone 4B adds linked patch-planning and validation-status preparation on top of the existing PR candidates.

Current behavior:

- classifies each PR candidate as `patch_candidate`, `patch_plan_only`, or `not_patchable`
- builds bounded patch plans only for candidates with localized and reviewable remediation paths
- records validation readiness without claiming that validation actually ran
- keeps non-patchable candidates as planning artifacts with explicit blocking notes
- preserves traceability back to PR candidates, issue candidates, and source findings

Out of scope in this milestone:

- remote patch application
- GitHub write-back
- branch creation
- commit creation
- pull request creation
