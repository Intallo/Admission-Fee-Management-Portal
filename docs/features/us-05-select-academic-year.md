# US-05 — Select academic year

- **SRS source:** v1.4, Section 5, Module 2: Academic Year
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-05 Select academic year** (BR-02, P1) As a user, I want to select the academic year after login so that I only see and edit data for that year.

- AC1: The selected year is always visible in the header.
- AC2: Switching year reloads all lists and totals for that year.
- AC3: New records are created inside the selected year.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
