# US-16 — Application list and status view

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-16 Application list and status view** (BR-08, BR-11, P1) As an Admission Officer or Principal, I want to filter applications by status, standard, and date so that I can see what is pending.

- AC1: Filters for status, standard, section, date range, and "Fee not generated".
- AC2: Counts per status are shown at the top of the list.
- AC3: Opening an application shows its complete status history with dates and users.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
