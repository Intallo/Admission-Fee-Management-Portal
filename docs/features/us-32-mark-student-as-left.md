# US-32 — Mark student as left

- **SRS source:** v1.4, Section 5, Module 8: Student Records
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-32 Mark student as left** (BR-30, P2) As an Admission Officer, I want to mark a student as Left/Transferred with a date and reason so that records stay but the student is no longer active.

- AC1: The status change is dated and logged.
- AC2: All records, payments, receipts, and documents remain accessible.
- AC3: There is no delete option anywhere (R-01).
- AC4: The student's seat is freed (US-42 AC6).
- AC5: This is the only way a student becomes Left/Transferred. Generating a certificate never changes the status (US-36).

## Open-decision note

Seat-release behavior when an approved student never joins remains open.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
