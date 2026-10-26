# US-22 — Later payments on fee heads

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-22 Later payments on fee heads** (BR-17, BR-43, P1) As an Accounts Officer, I want to accept payments of any amount at any time in the year and add them to the right fee head so that parents can pay when they can.

- AC1: Any fixed head can be paid in parts across several payments, as long as the total paid stays within the head's billed amount.
- AC2: The payment screen shows the head balances before and after the entry.
- AC3: No installment schedule, due dates, or reminders exist.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
