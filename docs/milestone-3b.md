# Milestone 3B

Milestone 3B adds deterministic candidate issue generation on top of the existing dependency findings and targeted code-review findings.

Current behavior:

- groups related dependency findings by package and remediation path
- groups related workflow findings by workflow file when they share a clear hardening pass
- groups hardcoded-secret findings by subsystem when the remediation path is shared
- groups dangerous execution and unsafe shell execution findings by file
- preserves traceability back to source finding IDs
- returns issue-candidate summaries without creating anything in GitHub

Out of scope in this milestone:

- PR drafting
- GitHub issue creation
- GitHub write-back
- broad AI-generated issue narratives
