# US-20 — View student fee breakdown

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-20 View student fee breakdown** (BR-14, BR-15, BR-16, BR-39, P1) As an Accounts Officer, I want to see each student's fee grouped by receipt type and fee head so that I can tell the parent exactly what is due.

- AC1: For every fee head the screen shows Billed, Paid, and Balance (R-07), grouped under Fees, Books, and Vehicle, with the student's total payable, total paid, and balance.
- AC2: The Vehicle fee appears only for students who use the school vehicle, at their place's price (R-09).
- AC3: Concessions and extra charges appear on the head they apply to, with approval details.
- AC4: No line for previous-year dues exists (R-14).
- AC5: The Admission Fee and Misc. lines appear once an amount has been paid on them.

## Open-decision note

Vehicle/fee configuration details remain open; implement only approved tariff rules.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
