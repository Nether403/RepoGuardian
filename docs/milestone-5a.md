# Milestone 5A

Milestone 5A adds approval-gated execution planning on top of the existing issue candidates, PR candidates, and linked patch plans.

Current scope:

- `POST /api/execution/plan` for deterministic dry-run execution planning
- explicit approval-gating metadata for future write-oriented actions
- eligibility checks for selected issue and PR candidates
- structured execution action planning and execution-log style results
- blocked/not-supported handling for `execute_approved` requests in this milestone

Out of scope:

- GitHub issue creation
- branch, commit, pull request, or remote file writes
- background jobs or persistent execution history
