# US-33 — Immutable records

- **SRS source:** v1.4, Section 5, Module 8: Student Records
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-33 Immutable records** (BR-30, P1) As the Principal, I want assurance that no record can be deleted so that the school's history is permanent.

- AC1: No delete button or endpoint exists for core records.
- AC2: The database scripts create an application database user that has no DELETE permission on core tables and no UPDATE permission on the payment ledger, receipts, and audit log, and the setup guide tells the deployer to use it.
- AC3: Attempts to remove or change protected data are rejected and logged.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
