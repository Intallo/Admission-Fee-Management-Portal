# Review and Submission Policy

## What to submit

Every task submission must include:

- Notion task link and exact task title/code.
- PR/artifact link and a concise summary of the delivered change.
- Acceptance-criteria checklist with a result and evidence for each item.
- Actual test commands and pass/fail results; link to CI where available.
- Screenshots, generated PDF sample, diagram, inventory or report where relevant. Use synthetic/masked data.
- Database-impact statement: `Read-only`, `Application-only`, or the separate approved migration reference.
- Known limitations, blockers, open decisions and follow-up task links.

Fill in the Notion task's `PR Link`, `Evidence Link`, and `Risk / Blocker`. Change Status to `In Review`. The `Assignee Email` property is tracking information; do not assume it sends a notification automatically.

## Pull-request review requirements

Reviewers verify:

1. The change matches signed requirements or an accepted ADR.
2. Scope is limited to the task; no unrelated refactor or feature expansion.
3. Correct access control is enforced server-side for sensitive reads and writes.
4. Database and financial invariants are preserved; migration files are explicitly reviewed.
5. Validation, errors, audit logging and failure/retry behavior are covered where relevant.
6. Unit/integration/E2E tests and evidence are credible and reproducible.
7. No secrets, real personal data or database dump entered the repository or screenshots.
8. Documentation and open-item links are current.

The author may respond to comments but cannot approve their own PR. Schema, RLS, authorization, financial and document privacy changes need a reviewer with the relevant domain knowledge; get a second reviewer where practical.

## Database-impact rule

- **Read-only:** no write query, migration, seed, reset, schema change or record export from the retained/shared DB.
- **Application-only:** code changes only; use isolated tests and don't change the retained schema.
- **Migration proposal only:** provide SQL, motivation, before/after impact, constraints/RLS impact, backup/rollback plan and isolated test evidence. It is not authorization to apply the migration.
- **Approved write required:** only after the separate approval record exists and the target environment is explicitly verified. Never assume a PR approval alone authorizes production/shared DB writes.

The retained database must not be reset, reseeded, dropped, truncated, deleted from or altered without a separate reviewed and explicitly approved task. M0.4 stays read-only.

## Completion states

- **In Progress:** actively being worked on.
- **In Review:** submission and evidence are complete; reviewer action is pending.
- **Blocked:** safe completion requires a decision, dependency or access change.
- **Done:** accepted and merged (or document artifact accepted), criteria evidenced, tests pass and Notion properties updated.

Do not mark Done because code merely exists or because the author locally tested it once.
