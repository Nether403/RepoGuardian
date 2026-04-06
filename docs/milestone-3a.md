# Milestone 3A

Milestone 3A adds targeted backend code-review findings to `POST /api/analyze`.

Current backend behavior:

- selects a bounded review set from workflows, config files, security-sensitive paths, and common application or API entrypoints
- fetches selected file contents through the existing GitHub read-only adapter
- runs deterministic review rules only
- returns structured `codeReviewFindings`, `codeReviewFindingSummary`, and `reviewCoverage`
- preserves structured warning details for targeted-review scope limits and skipped review files

Current deterministic rule coverage:

- possible hardcoded secret or token-like literals
- `eval(...)` or `new Function(...)` in JavaScript or TypeScript
- obvious shell execution helpers in JavaScript or Python
- risky GitHub Actions patterns such as `permissions: write-all` or `pull_request_target`
- missing explicit workflow permissions as a bounded hardening signal

Deliberately not included in 3A:

- whole-repo review
- AI-generated narrative review output
- issue drafting
- PR drafting
- GitHub write-back
