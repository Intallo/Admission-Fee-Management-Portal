# Review, Self-Check and Submission Policy — Solo Owner Mode

## Current ownership

Shashidhar (`shashipshetti@gmail.com`) is the only active implementation owner. The Notion task tracker uses Owner = Shashidhar and Reviewer = Unassigned. Historical submission documents may preserve prior contributor names as audit evidence; they do not confer active assignments.

## What every submission must contain

- Exact task title/code and Notion link.
- PR, commit or artifact link and concise change summary.
- Acceptance-criteria checklist with a result and evidence for each criterion.
- Actual commands and test/check results; link to CI where available.
- Screenshots/PDF samples/diagrams where relevant, using synthetic data.
- Database-impact statement: `Read-only`, `Application-only`, `Migration proposal only` or `Approved write required`.
- Known limitations, unresolved decisions and follow-up links.
- Updated Notion PR Link, Evidence Link and Risk / Blocker fields.

## Self-review in solo mode

1. Check each acceptance criterion against the signed requirement or accepted ADR.
2. Inspect the full diff for scope, secrets, real personal/financial data, authorization, validation, error handling, audit behavior and database impact.
3. Run relevant automated unit/integration/E2E/security checks with isolated test data.
4. Record exact commands, outputs, pass/fail results and remaining gaps.
5. Set task status to `In Review` while evidence or required approvals remain outstanding.
6. Do not assign yourself as a reviewer or represent self-review as independent peer approval.
7. Client/Principal business decisions and required acceptance approvals remain separate and mandatory.

## When a task is Done

- Every acceptance criterion has evidence.
- Relevant automated checks pass and results are linked.
- Documentation and known limitations are updated.
- Database-safety requirements are met and recorded.
- Any required Client/Principal decision or acceptance is recorded.

Solo self-review and a merged PR alone do not replace an external approval that is required by the signed requirements or engagement.

## Database impact rules

- **Read-only:** no writes, schema change, migration, seed, reset or record export from the retained/shared DB.
- **Application-only:** code changes only; test against isolated fixtures.
- **Migration proposal only:** provide SQL, rationale, impact, RLS/constraint implications, backup/rollback plan and isolated test evidence; do not execute.
- **Approved write required:** proceed only when an explicit reviewed approval exists and the target environment is verified.

Never commit secrets, service-role keys, real student/parent/financial records or database dumps.
