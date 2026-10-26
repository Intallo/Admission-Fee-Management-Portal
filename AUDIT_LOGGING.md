# Audit Logging Specification

## Purpose
Accountability for admissions/decisions, student status, sensitive data access, user lifecycle, fee configuration, payments, adjustments/reversals, receipt/certificate issue and reprints.

## Minimum event envelope
Event ID/time; actor and role; action; target entity/identifier; outcome; academic year where relevant; permitted changed fields/before-after values; required reason/remarks; correlation/request ID if supported.

## Events
- Login/lockout/logout/timeout; create/assign/deactivate/reset account.
- Application create/update/submit/return/approve/reject/hold/placement/admission number.
- Sensitive field view; document upload/replace/download/denial.
- Year create/current/close and seat limit changes.
- Fee setting changes/approval and transport place updates.
- Payment post/failure, adjustment/reversal/refund request/decision.
- Receipt, final receipt, statement, download and duplicate reprint.
- Mark Left/Transferred; certificate create/review/decision/issue/reprint.

## Never log
Raw Aadhaar, bank account, IFSC, document contents, passwords, auth tokens, connection strings or unnecessary personal details. Log field names and safe state changes instead.

## Immutability and testing
Audit is append-only; no user may edit/delete logs. Critical business events need reliable audit consistency with the underlying transaction according to the accepted persistence design. If current schema lacks required storage, raise a migration proposal; do not modify retained DB during audit. Tests assert expected events and absence of secrets/sensitive values. Define retention only after approved policy.
