# User and Business Rules

## Roles and access
**Principal:** final authority for admissions, grade placement, seat limits, fee policy, concessions, extra charges, exceptions, refunds/corrections and TC approval. Direct negotiated concession by Principal is allowed only with logged reason.

**Admission Officer (ADM):** create/edit drafts, enter student/parent data, upload documents, track missing documents, submit applications, manage approved student-record actions and perform first-step TC review. Can access sensitive fields allowed by SRS.

**Accounts Officer (ACC):** enter fee data for Principal approval, record payments, issue receipts, view dues/history, raise adjustment/refund requests. Cannot view sensitive fields/files.

**System Administrator (technical):** SRS working definition is account creation/deactivation/role assignment/password reset only; cannot see sensitive data or delete records. Its definition requires confirmation. Do not infer broad access based on role name.

- Enforce all permissions on server/API/resource/year boundaries. Hiding UI controls is not security.
- Sensitive data includes Aadhaar, caste/sub-caste, income, caste/income certificate numbers, bank name/account/IFSC and associated sensitive files. Only ADM and Principal may access per SRS.
- Log authorized sensitive-field views when required, but never log the sensitive values themselves.
- Deactivated users cannot log in; their history persists. No user/core record hard delete.
- Database app user must lack DELETE on core tables and UPDATE on payment ledger, receipts and audit log per SRS.

## Admission
- ADM can edit drafts until submission. Validate required fields and documents; the SRS permits an exception path only with reason and “documents pending” routing to Principal.
- Principal alone approves/rejects/holds and sets placement. Reject/on-hold requires reason; actor/time/remarks are retained.
- Admission number and Admitted status are assigned on approval; no payment is required.
- If there is no approved fee structure, admission completes and record appears in “Fee not generated” until a structure is approved.
- Seat limit behavior waits for Client confirmation of whether 100 means per section, total or per class/standard.

## Fee/payment
- Payments are recorded only. Admission Fee is variable and can be any amount; normally first but no fixed order or required first payment.
- Any eligible fee head can be paid at any time in the selected academic year; payment date must be in year and not in future per SRS.
- A payment belongs to one receipt type, every payment line belongs to that type, and line amounts sum exactly to payment total.
- Fixed fee head cannot be overpaid. Critical payment, lines, variable-head billing where relevant and receipt number are atomic per SRS.
- No year-to-year carry-forward.
- Posted ledger events are not edited/deleted. Use linked reversal/refund and approved correction processes.
- Principal approves concessions/extra charges/refunds/exceptions. One adjustment affects one head. Principal may record negotiated concession directly with reason as explicitly allowed.
- Use exact INR decimals to two places, not floats.

## Receipts
- One numbered receipt per payment; no receipt for reversal/refund.
- Shared sequence format `RCT-YYYY-NNNNNN` across all receipt types and final fees receipt; unique and never reused.
- Payment receipt shows type, date, student, admission/class, paid fee-head lines, total, total in words, payer/contact, and signatures for Payer, Cashier and Manager (Principal).
- Final fees receipt only when all applicable fees fully paid; one per student fee, has own number and lists component receipt numbers.
- Statement is available any time, marked `STATEMENT`, unnumbered, and shows billed/paid/balance and payment details.
- Reprints marked `DUPLICATE`; TC reprints as `DUPLICATE COPY`; reprint actor/date logged.
- Print output depends on Client-approved layouts, letterhead and format.

## Student and LC/TC
- Year-specific records; never auto-copy fee balances to another year.
- No hard deletes. A separately approved Left/Transferred action is what changes student status and may free a seat under the approved policy.
- Annual certificate record per student/year, including Left/Transferred students for that year; at most one certificate record per student per year.
- TC review by ADM then Principal approval; output uses approved template and stored-data snapshot.
- Issuing/reprinting certificate never itself changes student status.
- TC policy with unpaid dues, TC format and certain seat/lifecycle behavior are open; do not invent.

## Integrity/audit
- No hard deletes or cascading delete of core history.
- Number sequence allocation is transactional.
- Balances/statuses come from one authoritative fee calculation.
- Audit create/update/status/approval/sensitive view with actor/role/entity/time and allowed before/after fields; never log sensitive values.
