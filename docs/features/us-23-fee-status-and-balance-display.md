# US-23 — Fee status and balance display

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-23 Fee status and balance display** (BR-19, BR-20, P1) As an Accounts Officer, I want to see Paid, Partly Paid, or Not Paid with the remaining balance so that I can answer parents quickly.

- AC1: Status and balance appear on the student profile and in the fee list, in total and per fee head.
- AC2: Example: billed Rs. 29,350 (fees, books, vehicle, plus Admission Fee Rs. 1,000 and Misc. Rs. 250), paid Rs. 9,750 → status Partly Paid, balance Rs. 19,600.
- AC3: When the balance reaches Rs. 0, status becomes Fully Paid.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
