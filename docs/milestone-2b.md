# Milestone 2B

Milestone 2B adds advisory lookup and structured dependency findings on top of the Milestone 2A dependency snapshot.

Current scope:

- advisory provider interface in `lib/advisory`
- OSV-backed provider implementation
- exact-version advisory lookup for currently supported Node.js and Python dependency data
- normalized dependency findings with severity, confidence, evidence, and remediation hints
- partial-coverage warnings when advisory lookup is skipped, incomplete, or declaration-only

Still out of scope:

- code review findings
- issue drafting
- PR drafting
- GitHub write-back
