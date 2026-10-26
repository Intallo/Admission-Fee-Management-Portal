# Contributing and Pull Request Process

## Before work
- Open the assigned Notion task. Confirm dependencies, acceptance criteria and Database Impact.
- If a requirement or ADR is unresolved, mark Blocked and record the reason; do not infer policy.
- Keep the retained DB unchanged; use isolated test DBs and synthetic data.

## Branches and commits
Use a task branch from the approved baseline and include task ID in branch/PR title where practical. Confirm actual repository branch policy before standardizing convention. Do not push directly to protected main/default branch. Keep commits focused. Never commit `.env`, credentials, real student documents, DB dumps or production data.

## Ready for review
- Scope is limited to the assigned task.
- Server-side validation and authorization implemented/tested.
- State transitions, financial operations and failure/retry cases tested where relevant.
- Docs updated; migration notes linked if applicable.
- PR template and task submission note completed.
- Notion PR Link and Evidence Link filled; each acceptance criterion has evidence.
- No sensitive data/secrets in screenshots/logs.

## Review and completion
Task owner does not approve own PR. Require second reviewer for database/security, authorization, financial logic and document privacy changes. Review actual diff, test results, migration/rollback and every AC. Submit as In Review; return to In Progress for requested changes. Mark Done only after accepted review/merge (or document acceptance), tests pass, and evidence is recorded.

## Database changes
A PR alone does not authorize schema/data writes. Link a separate approved migration task/ADR documenting evidence, reason, impact, backup/rollback, isolated tests and approver. Never run destructive cleanup against the retained DB.
