# US-21 — Record a payment

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-21 Record a payment** (BR-17, BR-18, BR-19, BR-37, BR-43, P1) As an Accounts Officer, I want to record a payment received at the office, filled in like the paper receipt, so that the balance stays accurate.

- AC1: I choose the student and the receipt type. The screen lists that receipt's fee heads in the school's order, with Billed, Paid so far, and Outstanding for each.
- AC2: I enter the amount against one or more heads. The total is added up automatically and shown in words.
- AC3: A fixed head cannot be paid more than its outstanding balance. Variable heads (Admission Fee, Misc.) accept any amount, and the amount is billed as it is paid (R-11, R-12, R-13).
- AC4: Any fee head can be paid at any time after the student's fee has been generated. There is no required first payment and no required order (A-26).
- AC5: Other fields: payment date (inside the academic year, not in the future), mode (Cash, UPI, Card, Other), reference number (required for UPI and Card), payer name, relationship, and contact.
- AC6: On save, the head balances, Net Paid, and fee status update immediately (R-07, R-08).
- AC7: The payment and its lines are stored with the user and timestamp and cannot be edited or deleted (R-02).
- AC8: A numbered receipt is generated automatically (US-27).

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
