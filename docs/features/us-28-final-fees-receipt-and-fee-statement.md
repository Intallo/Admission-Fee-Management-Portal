# US-28 — Final fees receipt and fee statement

- **SRS source:** v1.4, Section 5, Module 7: Receipts
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-28 Final fees receipt and fee statement** (BR-25, BR-45, BR-46, BR-47, P1) As an Accounts Officer, I want one final fees receipt that includes all the other receipts, and a statement I can print at any time, so that the parent has the complete position.

- AC1: The final fees receipt can be issued only when the student's fee is fully paid (R-18).
- AC2: It shows the student and class, every fee head grouped by receipt type with its amount, the grand total, the total in words, and the **receipt numbers of all the other receipts** it includes.
- AC3: It has its own unique number from the receipt series, and one is issued per student fee.
- AC4: It has signature lines for the payer, the Cashier, and the Manager (the Principal signs as Manager).
- AC5: The **fee statement** can be printed at any time. It is marked "STATEMENT", is not numbered, and shows every fee head with billed, paid, and balance, and each payment with date, mode, payer name and contact, and receipt number.
- AC6: Neither document shows sensitive fields.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
