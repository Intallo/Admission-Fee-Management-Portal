# Solo Workflow and Implementation Gates

## 1. Task lifecycle

`Backlog → Ready → In Progress → In Review → Done`

Use `Blocked` when a missing source path, dependency, business rule or approval prevents safe progress. Record the reason in Notion Risk / Blocker. Assignment alone does not mean a task is ready.

## 2. Before implementation

1. Read the task, dependencies, Database Impact and signed BRD/SRS story.
2. Confirm the current Git branch and actual code path exists.
3. The current `main` tree does not visibly show an application package manifest or runtime entry points; confirm whether the app exists elsewhere before scaffolding.
4. Do not invent framework/API/schema choices. Keep proposed architecture as proposed until the ADR is accepted.
5. Ensure write-oriented tests use an isolated local/test database, never the retained database.

## 3. Git and evidence

- Use a focused task branch and small, meaningful commits.
- Make changes against the agreed baseline; do not use destructive reset/clean to force a match.
- Inspect scripts before execution.
- Record exact test commands and pass/fail results.
- Link the PR/commit/artifact, test evidence, known limitations and database-impact statement in Notion.
- Reviewer remains `Unassigned` during solo mode. Do not claim independent peer approval.

## 4. Self-review and approvals

For every task, check each acceptance criterion, negative path, authorization rule, error path and relevant safety constraint. Run applicable automated tests and capture reproducible evidence. A self-review is not independent peer approval. Client/Principal decisions, required business sign-offs and contractual acceptance remain separate gates.

## 5. Database protection

M0.4 is strictly read-only. Do not run reset, reseed, migration, DDL/DML write, DROP, TRUNCATE or DELETE against the retained database unless a separate task was reviewed and explicitly approved for that target. A PR or self-review alone does not authorize a retained-database write.

## 6. Escalation rules

Stop and mark Blocked rather than guessing when signed requirements conflict with existing code, a role boundary is unclear, a fee/TC/seat policy is unresolved, required source/runtime is missing, or a migration appears necessary. Technical implementation ownership is solo; business authority remains with the Client/Principal under the signed agreement.
