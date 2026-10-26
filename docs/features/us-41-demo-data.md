# US-41 — Demo data

- **SRS source:** v1.4, Section 5, Module 10: Audit, Dashboard, and Handover
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-41 Demo data** (Delivery, P1) As the project team, I want a seed script that loads realistic fake data so that demos and tests don't depend on real records.

- AC1: Includes all three sections, all roles, students with and without the school vehicle at different places, an approved application awaiting its Admission Fee, Admission Fees of different amounts, payments on Fees, Books, and Vehicle receipts, part-paid and fully paid students with a final fees receipt, a negotiated concession, a reversal, a section close to its seat limit, and a TC.
- AC2: The script can be run on a clean database in one step and contains no real personal data. The school's real forms are never used as demo data.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
