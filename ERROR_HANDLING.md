# Error Handling and Validation

## Objectives
Plain-English guidance, consistent API errors, no private data leakage and no partial financial state. Response format follows approved stack/API contract.

## Categories
- Validation: missing/invalid field, invalid file, duplicate STS, invalid year range/date.
- Authentication: generic invalid credentials, lockout, expired session.
- Authorization: Access denied with no protected details.
- Not found: record unavailable under authorized scope.
- Business rule: capacity reached, closed year, fixed-head overpayment, final receipt with outstanding balance, invalid transition or cross-year operation.
- Conflict/idempotency: duplicate submit/payment, stale edit, numbering conflict.
- Infrastructure/internal: safe message plus correlation ID; details only in protected logs.

## Write failure rules
- Success only after server confirms committed outcome.
- Payment, lines, variable billing where applicable and receipt numbering commit together or not at all.
- For uncertain network results, check operation state or retry safely/idempotently; never blind double-post.
- Audit denied/failed actions where required and safe.
- Error bodies must not expose sensitive fields or reveal protected record existence to unauthorized callers.
