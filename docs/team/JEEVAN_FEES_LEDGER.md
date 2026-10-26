# Jeevan — Fees, Ledger & Financial Integrity Owner

**Email:** bennurjeevan@gmail.com  
**Team role:** Fee configuration, offline payments, fee ledger and balances, authorized adjustments/reversals, receipt eligibility and financial integrity test owner.  
**Primary Notion work:** M1.4, M3.5, M5.1–M5.5, M6.1 and M7.3 (respect dependencies/status; no unapproved schema changes).

## Mission

Make fee and payment behavior accurate, auditable and safe. The ledger and database integrity constraints are critical to the project, so financial work must be driven by signed rules, exact arithmetic and isolated tests—not assumptions or direct data repair.

## Responsibilities now — database integrity review

- Read `DATABASE.md`, the schema migrations and `supabase/tests/integrity_tests.sql` / `verification.sql` to understand current financial invariants without changing the retained database.
- Map payment-related tables and behavior, including fee heads/structures, student fee assessments/lines, payments, allocations, adjustments, receipt counters, receipts, consolidated receipts/items, certificate versions and audit logs.
- Review the existing SQL functions/triggers that validate allocation sums, prevent immutable-row changes, enforce payment/receipt category consistency and protect approved financial adjustments. Record the observed behavior and gaps; do not run write-oriented integrity tests against the retained database.
- Contribute to M1.4 by specifying private document access and server-generated PDF boundaries, reusing current provider capabilities only after audit.
- Keep the test strategy isolated from shared/production databases; avoid exposing secrets or real financial values in reports.

## Fees/ledger responsibilities after approval

- Implement approved fee heads, receipt types, academic-year fee structures and vehicle tariffs only after the client confirms open policy items.
- Record offline payments only. Do not integrate a payment gateway. Respect the one-receipt-type-per-payment rule if/when the client confirms it as final.
- Preserve financial history. Do not hard-delete or edit posted payment evidence; use explicitly approved reversal/adjustment entries with reason, actor, approver and timestamp.
- Use exact decimal/numeric INR representations, never binary floating point. Align database precision, service calculations, serialization and rendered documents.
- Enforce transaction/idempotency behavior: payment and allocations reconcile, retries do not double-post, and partial failures do not leave inconsistent state.
- Calculate final-receipt eligibility using all applicable fees in the selected academic year. Issue the final fees receipt only when all fees are fully paid; include its shared receipt-series number and references to prior individual receipts.
- Ensure Payer, Cashier and Manager signature lines are present; Manager means Principal.
- Keep annual certificate issuance separate from student status updates; do not carry outstanding balances automatically between years.

## Deliverables

- Financial invariant catalogue linked to SQL functions/triggers and signed requirements.
- Fee policy mapping (confirmed rules vs open decisions) and any reviewed migration proposals.
- Unit/integration test vectors for allocation sum, category matching, reversal limits, overpayment, duplicate retries, exact money arithmetic and year isolation.
- Financial reconciliation evidence showing calculated balances, persisted entries and receipt/document totals agree.
- Receipt eligibility rules and safe synthetic PDF review artifacts.

## Explicit non-responsibilities

- Do not decide fee amounts, concessions, refund policy, vehicle rates, Books/Uniform compulsion or receipt catalog without client/Principal approval.
- Do not alter the retained schema or data during discovery. A migration must be a separate task with reviewed SQL, isolated tests, impact/backup/rollback plan and explicit approval.
- Do not treat the consolidated/final fees receipt as a new payment or double-count its amount in the ledger.
- Do not use float/double for currency, silently repair ledger discrepancies, or delete immutable records.
- Do not publish actual transaction data or service-role credentials in task evidence.

## Handoffs

- **With Ujwal:** align fee assignments to student and academic-year identifiers and ensure document issuance/status behavior is separate.
- **With Sujal:** provide stable amount/status contracts and synthetic examples for screen/PDF rendering.
- **With Shashidhar:** agree API/error/auth/audit contract; route schema gaps through ADR/migration approval rather than changing tables directly.

## Ready-to-submit checklist

- [ ] Financial policy is supported by a signed requirement or explicit client decision.
- [ ] No float-based money arithmetic is used.
- [ ] Collection/allocation totals and reversals reconcile under the approved rules.
- [ ] Retry, partial-failure, authorization and year-isolation cases are tested.
- [ ] Final receipt is blocked until all applicable fees are fully paid.
- [ ] SQL changes, if any, have separate approval and isolated tests.
- [ ] PR, reconciliation/test evidence and known limitations are linked.
