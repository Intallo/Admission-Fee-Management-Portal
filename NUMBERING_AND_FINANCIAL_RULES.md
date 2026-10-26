# Numbering and Financial Rules

## Number formats
- Application: school format `sequence/academic-year`, example `161/2026-27`.
- Admission: `ADM-YYYY-NNNN`, e.g. `ADM-2026-0001`.
- Receipt: `RCT-YYYY-NNNNNN`, e.g. `RCT-2026-000001`.
- TC: `TC-YYYY-NNNN`, e.g. `TC-2026-0001`.
`YYYY` is the starting calendar year of the academic year. Sequences restart per academic year. All receipt types and the final fees receipt share one receipt series. Committed numbers are unique and never reused.

## Monetary calculation
Per head: `Billed = structure/variable amount + approved extra charges - approved concessions`; `Paid = payments - approved reversal/refunds`; `Balance = Billed - Paid`. Student totals sum per-head amounts. Status: Not Paid if net paid is zero; Fully Paid if balance is zero; otherwise Partly Paid. Any negative/edge-case policy must follow SRS and approved business rules.

- Money is exact INR, two decimal places; never float/double.
- Fixed fee head payment cannot exceed the outstanding balance for that head.
- Admission Fee is variable: amount paid is amount billed; no minimum first payment.
- Payment belongs to a single receipt type. All lines use heads of that type and add exactly to payment total.
- Payment date is within selected academic year and not in future.
- Record payments offline; no payment gateway.

## Transaction and correction rules
- Payment + payment lines + variable-head billing where relevant + receipt numbering is atomic as specified.
- Number sequences allocated transactionally.
- Reversal/refund is a new linked event, approved by Principal as required; original ledger entry is never edited/deleted.
- Final fees receipt only after all applicable fees fully paid; statement is available at any time and is unnumbered.
- No automatic unpaid-balance carry-forward to a new academic year.
