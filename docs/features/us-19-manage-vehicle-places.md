# US-19 — Manage vehicle places

- **SRS source:** v1.4, Section 5, Module 4: Receipt Types, Fee Heads, and Fee Structure
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-19 Manage vehicle places** (BR-15, BR-44, P1) As the Accounts Officer or Principal, I want to add and update the places served by the school vehicle so that the vehicle fee matches the student's place.

- AC1: A place has a name and can be deactivated, never deleted.
- AC2: The price for each place is set in the fee structure (US-18).
- AC3: A place can be chosen on the application only when the transportation mode is School Bus.
- AC4: The Vehicle fee is billed only to students who use the school vehicle and have a place. If a student takes the vehicle later, the fee is added as a new billed item (R-09).

## Open-decision note

Vehicle Place meaning and tariff basis remain open.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
