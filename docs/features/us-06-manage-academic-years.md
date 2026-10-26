# US-06 — Manage academic years

- **SRS source:** v1.4, Section 5, Module 2: Academic Year
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-06 Manage academic years** (BR-02, BR-39, P2) As the Principal, I want to create an academic year and mark one as current so that the school can start each year cleanly.

- AC1: A year has a label (for example 2026-27), start date, and end date.
- AC2: Years cannot be deleted. The Principal may mark a year as closed, after which it is read-only for payments, fee adjustments, and new applications.
- AC3: Only one year is "current" at a time, and years cannot overlap.
- AC4: Nothing is copied or carried from one year to another automatically (R-14).
- AC5: Creating a year creates its number sequences and a default seat limit of 100 for each section.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
