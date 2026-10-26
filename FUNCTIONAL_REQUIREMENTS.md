# Functional Requirements Summary

**Authority:** signed SRS v1.4. Detailed story acceptance criteria are in `docs/features/`.

## FR-01 Authentication and role access
Username/password login, generic credential errors, 5-failure/15-minute lockout, 30-minute inactivity timeout, single role per user, account deactivation/password reset, no deletion and server-side authorization. The technical SYSADMIN role still needs confirmation.

## FR-02 Academic year
User selects a year; current year stays visible; lists/totals reload when year changes; one current year; no overlapping ranges; closed year blocks specified operations; no automatic data/fee carry-forward.

## FR-03 Admission
Create draft from minimum student name/standard; issue application number on first save; collect approved school-form fields; parent info and docs; compute age; validate; unique STS; checklist; submit; Principal review, approve/reject/on-hold; seat-cap check; status history; assign admission number/Admitted status on approval. Payment is not required. If fee structure absent, show “Fee not generated”.

## FR-04 Fee configuration
Maintain receipt types, fee heads, Fixed/Variable classification, annual fee schedule per standard and vehicle places/tariffs; Principal approval. Exact full catalog/tariffs/policy require client input.

## FR-05 Payments/ledger
Record offline payments by one receipt type and its fee heads, any allowed amount/time in year; fixed heads cannot be overpaid; payment lines sum to total; head and student balance/status derived consistently; audit payment history; no fixed installment/due-date system.

## FR-06 Adjustments/corrections
Principal-approved concessions, negotiated reductions, extra charges, exceptions, refunds/corrections. One action affects one fee head. Preserve original records; use linked adjustment/reversal; Admission Fee refund policy remains open.

## FR-07 Receipts
Receipt per payment with shared unique series; required head lines/total/amount-in-words/payer/contact/signatures; no receipt for reversal/refund; final fees receipt only at full payment and lists included receipt numbers; statement printable at any time and unnumbered; duplicates labeled/logged.

## FR-08 Student records
Search by name/admission/STS/standard/year; role-filtered profile/history/tabs; explicit Left/Transferred action; no hard delete. Certificate issue does not change status.

## FR-09 LC/TC
Annual record per admitted student/year, includes Left/Transferred students in that year; two-step ADM review then Principal decision; approved template; unique number; issue snapshot; retrieval/reprint and duplicate log.

## FR-10 Audit/dashboard/handover
Immutable audit with actor/action/record/time and allowed before/after fields; no sensitive log values; basic dashboard counts/balances match lists; fake seed and repeatable business-rule tests; README/setup/technical notes and code handover.
