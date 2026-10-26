# US-18 — Set yearly fee structure

- **SRS source:** v1.4, Section 5, Module 4: Receipt Types, Fee Heads, and Fee Structure
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-18 Set yearly fee structure** (BR-13, BR-14, BR-44, P1) As the Accounts Officer, I want to enter fee amounts per standard per year so that every student of a standard gets the same breakdown, and the Principal can approve it.

- AC1: A grid lists each fixed fee head, grouped by receipt type, with an amount for each standard. Vehicle fees are entered per place.
- AC2: The structure belongs to one academic year and can differ from year to year.
- AC3: The Principal can view the structure and approve it. Once approved, changes require a new version, and earlier versions are preserved. Existing student fees are not changed unless an approved adjustment is made.
- AC4: Variable heads (Admission Fee, Misc.) have no amount in the grid.
- AC5: A head with amount 0 is not billed to students.

## Open-decision note

Books/uniform rules, vehicle tariff basis and fee policy inputs remain open.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
