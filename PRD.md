# Product Requirements Document (PRD)

**Product:** School Admission & Fee Management Portal  
**Client:** Rakesh Aralikatti, acting for ABC English Medium School  
**Delivery model:** Intallo delivers source code and handover artifacts; the Client deploys and operates the system.  
**Authority:** Signed BRD v1.4 and SRS v1.4, approved 22 October 2026. Those documents prevail if this derived PRD differs.

## 1. Product summary
Replace paper-led admissions, fees, receipts and annual LC/TC work with a private, auditable desktop-browser application. Maintain year-specific records, support Principal decisions, record offline payments without processing money, calculate head-level and total balances, render approved documents and preserve historical records.

## 2. Problem
The current manual workflow scatters student/parent data, makes application status and seat availability hard to inspect, requires manual calculations across separate receipt books, makes payment history hard to reconcile, exposes sensitive data too widely, and makes annual certificate preparation repetitive.

## 3. User classes
- **Principal / Head of School:** final business authority for admissions, grade placement, seat limits, fee policy and approvals, concessions, extra charges, exceptions, refunds/corrections and TCs.
- **Admission Officer (ADM):** admission intake, student/parent details, documents, completeness, student records and first-step TC review; may see the sensitive fields allowed by SRS.
- **Accounts Officer (ACC):** fee inputs for Principal approval, offline payments, receipts, dues and adjustment/refund requests; cannot see sensitive fields.
- **System Administrator (technical / SYSADMIN):** SRS describes account creation/deactivation/role assignment/password reset, but the role is marked “to confirm”; no sensitive data or delete access. Do not infer broad powers from “administrator.”

## 4. Product goals and verification
| Goal | Evidence / success measure |
|---|---|
| Digitize admissions | Draft, submit, Principal decision, status history and search work end-to-end. |
| Accurate fees | Head-level and overall billed/paid/balance values reconcile after every payment or approved adjustment. |
| Protect sensitive data | Only permitted roles see sensitive fields/files; direct URL/API, search and exports enforce the same policy. |
| Preserve history | No core-record deletion; ledger, receipts, certificates and audit history remain intact. |
| Standardized certificates | Annual LC/TC can be generated from stored data using approved format and approval history. |
| Seat control | Approval is blocked at the Client-confirmed seat capacity. |
| Paper fidelity | Admission/payment UX and printed forms follow Client-approved assets/layouts. |

## 5. Capabilities
Authentication/authorization; academic-year management; admission form and document handling; application review and seat limits; fee configuration and annual fee structure; variable Admission Fee; offline collection and append-only ledger; adjustments/reversals; receipt/final receipt/statement/reprints; student search/profile; annual LC/TC; audit/dashboard; synthetic seed, tests, setup documentation and code handover.

## 6. Environment and usability
English-only web application for school computers; latest Chrome on Windows, with SRS desktop baseline 1366px and above. Forms must be keyboard-friendly; errors are plain English; payment entry resembles paper receipts. Official receipts and certificates print as approved A4/A5 PDFs. SRS performance target is common screens under 3 seconds with 2,000 students/year and 10 years of data on demo environment; production performance depends on Client hosting.

## 7. Invariants
- No payment prerequisite for admission and no fixed initial payment.
- Payments are recorded only, not processed.
- Exact INR decimal arithmetic to two decimals; no float/double for money.
- No hard deletes; posted ledger and audit history protected from mutation.
- Explicit year scoping; no automatic carry-forward.
- Fixed fee heads cannot be overpaid.
- Final fees receipt only on full payment; statement available any time and unnumbered.
- One shared unique receipt sequence across receipt types and final fees receipt.
- LC/TC is annual per student/year; issuance does not change student status.

## 8. Scope exclusions
Online payment gateway; fixed first payment / minimum percentage; installment due-date schedules; automatic reminders; parent/student portal; SMS/WhatsApp/email notification; mobile app; attendance/exams/timetable; promotion; automatic dues carry-forward; other unrelated modules; real-data import. Deployment, hosting, live HTTPS/security, database operation, backup/restore/monitoring, training, live operation and maintenance are Client responsibilities under signed scope.

## 9. Client dependencies
Written decisions/assets still needed include seat-cap interpretation; complete receipt catalog; definition of fee-data “admin”; book/uniform policy; vehicle tariff basis; Admission Fee refund policy; statuses and seat release when an approved student never joins; TC policy with unpaid dues and approved template; age rules; field/document requirements; high-resolution letterhead and full-page receipt samples; blank admission form; fee/tariff tables and timely approval.

## 10. Release principle
Release requires signed-requirement traceability, role checks, admission-before-payment flow, fee reconciliation, final receipt eligibility, no-delete guarantees, approved print layouts, clean-machine setup verification, handover and written Client acceptance. Do not invent policy for an open item.
