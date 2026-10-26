# Security and Privacy Requirements

## Responsibility boundary
Delivered code supplies application controls. Client operates production and owns HTTPS/server setup, deployment, DB operation, backups/restore and monitoring.

## Authentication
- Unique accounts and hashed passwords.
- Generic invalid-credential response.
- Five consecutive failures lock account for 15 minutes; 30-minute inactivity timeout per SRS.
- Deactivation blocks login but preserves history.
- Initial administrator bootstrap/forced password change is a working assumption; approve role/provider before implementing. Never commit default credentials.

## Authorization
- Deny by default; role checks on every protected server action.
- Aadhaar, caste/sub-caste, income, caste/income certificate number, bank fields and related files visible only to ADM/Principal.
- ACC/SYSADMIN must not see fields in forms, search, exports, receipts, statements, APIs or direct file links.
- UI hiding is not a security boundary.

## Private document storage
- Configurable storage outside public web path.
- SRS working assumption: PDF/JPG/PNG up to 5MB; document rules per section remain open.
- Validate every upload and authorize every preview/download server-side.
- Preserve prior versions when replacing files; record uploader and time.
- No public buckets/predictable unauthenticated URLs by default.

## Data protection
- Encrypt sensitive fields where stored per SRS.
- Synthetic data only in tests/demo/evidence. Never store actual school forms or personal data in repository/project tools.
- No hard deletes; foreign keys do not cascade-delete core history.
- Protect posted ledger/receipts/audit through app behavior and DB permissions.
- Exact decimal money and transactional receipt/sequence consistency.

## Audit
Record actor/role/action/entity/time and allowed before/after values. Sensitive values, passwords, auth tokens, connection strings and file contents are prohibited from logs. Audit itself cannot be edited/deleted. Retention duration is not invented; obtain Client policy if needed.

## Security test cases
Unauthenticated access; cross-role direct API; guessed IDs; unauthorized file download; ACC/SYSADMIN sensitive field attempts; disabled/expired user; secret leakage; invalid/oversized uploads; hard-delete or protected UPDATE attempt; duplicate payment/retry/sequence collision; cross-year data exposure; public file leakage.
