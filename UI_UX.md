# UI/UX Specification

**Authority:** signed BRD/SRS v1.4. This document gives UI implementation guidance; it must not introduce new scope or change approved forms.

## UX goals
- Make the paper-based admission/payment process easy for office staff to transfer accurately.
- Display selected academic year persistently.
- Make status, missing data/documents, fee balance, role restrictions and action outcomes clear.
- Use plain-English, actionable errors; validate server-side even when the client validates.
- Hide sensitive data from unauthorized roles across all surfaces.
- Preserve history with no deletion controls.

## Environment
English only; latest Chrome on Windows; primary baseline is desktop, 1366px and above. Keyboard-friendly forms and A4/A5 PDFs are required. Responsive behavior at smaller widths is a UX refinement, not a mobile app deliverable.

## Navigation
- Login / forced password change if confirmed.
- Year selection and persistent year indicator.
- Dashboard (Principal-oriented summary).
- Admissions: list, new/edit draft, documents/missing list, Principal queue, details/status history, seat limits.
- Students: search/profile tabs Details, Parents, Documents, Fees & Payments, Receipts, Status History, Certificates.
- Fees: receipt types, fee heads, yearly structure, vehicle places, student fee, payment entry/history, dues, adjustment/refund requests, receipts/final receipt/statement.
- LC/TC: yearly list, review queue, decision, issue, retrieve/reprint.
- Audit log and authorized user account management.
Only show routes/actions permitted by role; server/API must still deny direct access.

## Screens
### Login
Generic invalid-credential message; no account enumeration. Enforce five failed attempts/15-minute lockout and 30-minute inactivity timeout per SRS.

### Academic year
Keep year visibly in header/context. Switching year reloads lists and totals; no cross-year blend. Closed years restrict payment, adjustments and new applications as specified.

### Admission form
Follow the exact school form and field order after client asset review. Show application number/date, standard/derived section, status and seats used/available. Draft accepts minimal student name + standard. Mark required fields; error summary links to fields. Calculate age, but do not enforce unspecified age rules. Sensitive fields only render for ADM/Principal. Show document Received/Missing checklist. Any mandatory-document override needs reason and Principal workflow.

### Principal review
Summary of details/documents, status history and seat availability. Approve with placement; reject/on-hold requires reason. Approval blocked if capacity is reached after seat-unit policy is confirmed. Only Principal may decide.

### Payment entry
Mirror the paper receipt entry. Show student/year, receipt type, head-level billed/paid/balance, payer/payment metadata and exact INR amounts. Do not require admission payment or impose payment order. Prevent duplicate submit; show success only after committed save. Failed transaction must not be displayed as recorded.

### Receipts
Payment receipt includes receipt number/date/student/admission/class, per-head amounts, total, amount in words, payer/contact and Payer/Cashier/Manager signature lines. Final fees receipt is unavailable until all applicable fees fully paid. Statement is available any time, marked STATEMENT and unnumbered. Reprints are DUPLICATE and audited. No sensitive fields.

### Student profile
Role-filtered tabs from SRS. Keep Left/Transferred status/history clear. Preserve historic payments, receipts and documents. Certificate issuance never changes student status.

### LC/TC
Year-specific list and status; Officer review then Principal approval. Dues rule and final template are pending Client decisions. Generate on server from approved stored data/snapshot. Reprint label and audit event required.

### Audit
Filters by user, date, student and action type. Show actor/role/action/entity/time and permitted before/after values. Never show sensitive values or provide edit/delete control.

## Common states and accessibility
Every data screen defines loading, empty, error, permission denied, not found, conflict/stale data and saved states. Prevent repeated submits. Labels are visible/programmatic, focus visible, keyboard order logical, errors associated with fields, and status not conveyed through color alone. Test long names/addresses and table overflow.
