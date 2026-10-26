# US-27 — Receipt for each receipt type

- **SRS source:** v1.4, Section 5, Module 7: Receipts
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-27 Receipt for each receipt type** (BR-24, BR-26, BR-45, BR-47, P1) As an Accounts Officer, I want to print a receipt immediately after recording a payment, in the school's format for that receipt type, so that the parent has proof.

- AC1: The receipt uses the school letterhead and the receipt type's title (Fees Receipt, Books Receipt, Vehicle Receipt).
- AC2: Contents: receipt number (for example RCT-2026-000001), date, student name, admission number, class, a numbered list of the receipt type's fee heads with the amount paid on each, the total, **the total in words** ("Rupees ... Only"), the payer's name and contact, and signature lines for the **payer, the Cashier, and the Manager** (the Principal signs as Manager).
- AC3: Every receipt has a unique number from one series shared by all receipt types and the final fees receipt (R-16).
- AC4: The receipt generates as an A4 or A5 PDF in the layout approved by the Client (A-15).
- AC5: Reversals and refunds do not produce a receipt.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
