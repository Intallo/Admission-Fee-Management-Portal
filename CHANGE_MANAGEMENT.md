# Change Management

The signed BRD/SRS v1.4 are the baselines. The Client is the single contracting/approval point. Requests from school staff need Client confirmation as described in BRD Section 14.

## Workflow
1. Record change, requester, date, business reason and requirement IDs.
2. Classify as clarification, defect, technical refactor or new/out-of-scope capability.
3. Assess behavior, schema/data impact, security/privacy, compatibility, tests, effort, schedule and commercial implications.
4. Version BRD/SRS and traceability for requirements changes; create ADR for technical direction.
5. Obtain written Client approval for scope/cost/schedule before implementation.
6. Update tasks, acceptance criteria, tests and risk register.
7. Implement on a branch/PR, review, test and record evidence.

## Database changes
Do not use retained DB as a test target. A migration requires a separate reviewed task listing current schema evidence, affected data, migration diff, backup/restore plan, upgrade and rollback, isolated tests and approver. PR approval alone is not permission to mutate retained/production data.

## Versioning
Keep signed v1.4 docs unchanged. Add later approved versions as new files with date, CR ID, approver and supersedes relationship.
