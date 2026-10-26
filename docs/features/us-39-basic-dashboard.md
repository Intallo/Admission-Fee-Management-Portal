# US-39 — Basic dashboard

- **SRS source:** v1.4, Section 5, Module 10: Audit, Dashboard, and Handover
- **Priority in SRS:** Not specified
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-39 Basic dashboard** (P2) As the Principal, I want a summary so that I can see the school's position at a glance.

- AC1: Counts of applications by status, admitted students by section, seats used and available by section, and total fees billed, collected, and outstanding for the selected year, with a split by receipt type.
- AC2: Dashboard figures match the underlying lists exactly.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
