# Authorization Matrix

**Source:** BRD v1.4 Section 7.1 and SRS v1.4. “System Administrator” was added as a technical role and marked to confirm; do not infer broad permissions.

| Action | Admission Officer | Accounts Officer | Principal |
|---|---:|---:|---:|
| Create/edit draft application | Yes | No | Yes |
| Upload docs / track missing | Yes | No | Yes |
| Submit for verification | Yes | No | No |
| Approve/reject/hold and grade placement | No | No | Yes |
| Set seat limits | No | No | Yes |
| View sensitive data/files | Yes | No | Yes |
| Maintain receipt types, heads, places and yearly amounts | No | Enter/update per approved workflow | Approves |
| Record payments and issue receipts/final receipt | No | Yes | View |
| View outstanding dues | No | Yes | Yes |
| Raise concession/extra charge request | No | Yes | Yes (may record negotiated concession directly with reason) |
| Approve concession/extra charge/exception | No | No | Yes |
| Request refund/payment correction | No | Yes | Yes |
| Approve refund/payment correction | No | No | Yes |
| Request TC | Yes | No | Yes |
| Review TC (step 1) | Yes | No | No |
| Approve/issue TC (step 2) | No | No | Yes |
| Delete any record | No | No | No |

## Technical System Administrator
SRS working description: create/deactivate users, assign one role, reset passwords; cannot view sensitive data or delete records. Role requires confirmation. Do not equate SYSADMIN to Principal or grant whole-system access.

## Enforcement
- Server-side role/resource/year authorization on every protected action.
- Sensitive restrictions apply to lists, details, search, exports, receipts/statements, APIs and file downloads.
- Sensitive-field view logs where required; no sensitive values in audit.
- Deny unauthorized direct API/file access.
- Deactivation blocks login while retaining history.
- Database role: no DELETE on core tables and no UPDATE on payment ledger/receipts/audit log.
- Test allowed and denied combinations; owner may not self-approve PR.
