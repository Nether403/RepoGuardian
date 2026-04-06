# Milestone 2A

Milestone 2A extends the existing `POST /api/analyze` flow with backend dependency parsing.

Current scope:

- fetch detected manifest and lockfile contents from GitHub through `lib/github`
- parse supported Node.js files:
  - `package.json`
  - `package-lock.json`
  - `pnpm-lock.yaml`
- parse supported Python files:
  - `requirements.txt`
  - `pyproject.toml`
  - `poetry.lock`
- normalize parsed dependencies into one shared dependency snapshot
- report skipped files, parse warnings, and partial coverage honestly

Not in scope:

- advisory matching
- vulnerability findings
- code review findings
- issue drafting
- PR drafting
- GitHub write-back
