# Milestone 4A

Milestone 4A adds deterministic PR-candidate drafting on top of the existing findings and issue candidates.

Current behavior:

- selects only bounded remediation paths that are reviewable as one concern
- drafts dependency upgrade PR candidates when one package and its lockfile path are clearly identified
- drafts workflow-hardening PR candidates when one workflow file contains strong hardening findings
- drafts localized code-hardening PR candidates for dangerous execution patterns in one file
- drafts secret-remediation PR candidates only as high-risk, draft-only proposals
- returns structured readiness, risk, expected file changes, rationale, test plans, and rollback notes

Out of scope in this milestone:

- patch generation
- GitHub write-back
- branch creation
- issue creation
- pull request creation
