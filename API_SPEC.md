# API Contract Proposal

**Conceptual only:** these resource groups and behaviors are not claims about existing endpoints. Confirm runtime, routing conventions and current API path during audit; accept M1.3 before implementation.

## Contract principles
- Use explicit DTOs; never return DB rows wholesale.
- Authenticate and authorize every protected call server-side, including year and record scope.
- Validate fields, transitions, permissions and business rules on the server.
- Use consistent error categories and correlation IDs; keep diagnostics protected.
- Return successful write result only after commit.
- Payment writes need idempotency/retry safety and atomic payment + lines + variable billing where relevant + receipt sequence.
- Pagination, search, export and document downloads must apply the same privacy rules as details.

## Proposed resource groups
| Area | Illustrative actions | Key checks |
|---|---|---|
| Identity | login/logout/current user, account create/deactivate/reset | generic auth errors, role matrix, expiry |
| Academic year | list/select/create/set current/close | unique current year, non-overlap, closed-year restrictions |
| Admissions | draft create/update, submit, list/detail, Principal decision, history | ADM/Principal authorization, required data/docs, seat cap |
| Documents | upload/list versions/preview/download | approved types/size, private storage, permission and audit |
| Fee configuration | receipt types, heads, year structure draft/approve, vehicle places | permitted editor, Principal approval, open tariffs |
| Student fee | generate, breakdown, dues/history | no admission payment gate, explicit year, Fee not generated state |
| Payments | record, history, linked reversal/refund request | offline-only, one receipt type, no fixed-head overpay, decimals, atomic/idempotent |
| Adjustments | request/approve/reject/history | Principal approval, reason, logged direct Principal-concession exception |
| Receipts | payment receipt/final receipt/statement/reprint | final only fully paid; shared unique series; snapshots; duplicate audit |
| Students | search/profile/mark Left-Transferred | role-filtered fields, no hard delete, certificate/status separation |
| Certificates | annual record/review/decision/issue/retrieve/reprint | one per student/year, approved format, no status side effect |
| Audit/reporting | audit filters/dashboard | redaction, authorized views, figures consistent with source data |

## Error categories
Invalid input; unauthenticated; permission denied; not found; stale/conflict; duplicate/sequence conflict; business-rule violation (e.g. fixed head overpay/final receipt with balance); dependency unavailable; unexpected internal failure. Never reveal stack traces or sensitive record details to unauthorized callers.

## Service-enforced state changes
- Application: Draft → Submitted → Approved/Rejected/On Hold; On Hold → Approved/Rejected; Principal may return Submitted → Draft with reason. Admission number and Admitted state are assigned on approval; Admitted → Left/Transferred only by explicit lifecycle action.
- Fee: Not Paid → Partly Paid → Fully Paid; reversal can move status backward with retained history.
- Adjustment: Requested → Approved/Rejected; direct Principal-recorded negotiated concession requires logged reason.
- TC: Requested → Officer Reviewed → Principal Approved/Rejected → Issued.

## Before implementation
Define request/response, auth matrix, year scope, validation, errors, idempotency, transactions, audit events, tests and any data-model proposal. Link accepted contract in Notion/GitHub task.
