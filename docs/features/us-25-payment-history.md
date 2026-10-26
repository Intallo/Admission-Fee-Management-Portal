# US-25 — Payment history

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-25 Payment history** (BR-18, P1) As an Accounts Officer, I want to see the full list of payments for a student with dates and payer details so that disputes can be settled.

- AC1: Each entry shows date, receipt type, the amount on each fee head, total, mode, reference, payer, recorded by, and receipt number.
- AC2: Reversal and refund entries appear in the same history, clearly labelled and linked to the original entry.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
