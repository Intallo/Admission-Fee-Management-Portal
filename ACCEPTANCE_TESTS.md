# Critical Acceptance Scenarios

These derive from SRS v1.4. For open items, get written Client approval before treating the assumed branch as final.

## AT-01 Authentication
Valid login reaches year selection; invalid login is generic; five failures lock for 15 minutes; inactivity timeout 30 minutes.

## AT-02 Access control
ADM/Principal can access permitted sensitive fields. ACC/SYSADMIN cannot see them via UI, API, search, export, receipt or direct download. Unauthorized direct requests deny and audit. Deactivated users cannot log in and history remains.

## AT-03 Academic year
One current year, no overlapping dates, switching year refreshes lists/totals, closed year blocks specified write actions, no fee/record carry-forward.

## AT-04 Admission without payment
Save minimal draft (name + standard), edit, document checklist and submission validation; submit appears in Principal queue; Principal decides with required remarks; admission number/status assigned atomically; verify no payment prerequisite. If no approved fee structure, admission still completes and Fee not generated appears.

## AT-05 Seat limit
Capacity display and blocking are verified only after Client confirms whether 100 is per broad section, total or per standard.

## AT-06 Documents and sensitive data
Reject invalid/oversized files; replacement preserves prior version/uploader/time; direct unauthorized download denied; duplicate STS handling and input validation tested.

## AT-07 Fees and payments
Fee structure maps to standard/year; variable Admission Fee; one receipt type/payment; payment lines equal total; fixed head cannot be overpaid; payment date within selected year/not future; retries do not double-post; failure does not partially commit; balances/status reconcile exactly; year isolated.

## AT-08 Adjustments
ACC request, Principal approval/deny, correct reason and audit; original payment preserved; reversal per head cannot exceed original amount; admission fee refund behavior blocked until approved.

## AT-09 Receipts
Unique receipt per payment in one shared series; correct head lines, total/amount in words/payer and Payer/Cashier/Manager signatures; no receipt for reversal/refund; final receipt blocked while balance due and issued once after full payment; lists component receipt numbers; statement printable at any time, unnumbered; duplicate labels/reprint log; no sensitive fields.

## AT-10 Student records
Search by name/admission/STS/standard/year with stated performance target; profile tabs are role filtered; Left/Transferred is explicit, dated and audited; no hard-delete control/API; database privileges/no-cascade verified.

## AT-11 LC/TC
One annual record/student/year including Left/Transferred students of that year; two-step review; approved template/fields; unique TC number; retrieve/reprint with DUPLICATE COPY and audit; original snapshot survives profile edits; issuing certificate does not change status; dues override only if policy approved.

## AT-12 Audit/dashboard/handover
Audit events have actor/role/action/entity/time and permitted before/after fields, no sensitive values and no edit/delete. Dashboard matches lists. Seed covers all SRS US-41 fake scenarios. Business-rule test script repeatable on approved target. New operator can follow clean-machine setup; Client responsibility boundary accepted.
