# Milestone 6C: Bounded Write-back Expansion

## Goals
Expand Repo Guardian's write-back capabilities to include deterministic dependency upgrades for Python and Maven ecosystems, maintaining strict adherence to approval-gated and bounded execution principles.

## Guardrails
- **One Package Only**: Deterministic write-back is limited to exact PR candidates affecting exactly one package.
- **Direct Dependencies Only**: No transitive dependency write-backs in this milestone.
- **Deterministic Syntax Only**:
    - **Python**: Only `requirements.txt` with exact `==` version specifiers.
    - **Maven**: Only `pom.xml` with explicit `<version>` tags (no property resolution or `<dependencyManagement>` overrides for write-back).
- **Approval Gated**: Every write action (branch creation, commit, PR opening) requires explicit user approval.
- **No Background execution**: Synthesized patches are only generated and applied during interactive sessions.

## Deterministic Patterns
- **Python**: Regex-based replacement of `pkg==version` matching the existing line structure.
- **Maven**: String replacement or minimal XML mutation of the identified `<version>` tag inside the specific `<dependency>` block.
