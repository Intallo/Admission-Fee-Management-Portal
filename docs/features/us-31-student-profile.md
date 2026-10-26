# US-31 — Student profile

- **SRS source:** v1.4, Section 5, Module 8: Student Records
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-31 Student profile** (BR-29, P1) As a staff user, I want a single profile page so that I can see everything about a student I am allowed to view.

- AC1: Tabs: Details, Parents, Documents, Fees and Payments (by fee head), Receipts, Status History, Certificates.
- AC2: Tabs and fields not allowed for my role are hidden.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
