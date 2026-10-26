# US-38 — Audit log

- **SRS source:** v1.4, Section 5, Module 10: Audit, Dashboard, and Handover
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-38 Audit log** (BR-31, BR-11, P1) As the Principal, I want to see who did what and when so that every change is accountable.

- AC1: The log records user, role, action, record, before/after values for key fields, and timestamp.
- AC2: The log cannot be edited or deleted by any user.
- AC3: It can be filtered by user, date, student, and action type.
- AC4: Sensitive values are never written to the log, only the names of the fields that changed.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
