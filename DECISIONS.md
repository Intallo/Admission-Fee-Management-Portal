# Decision Log and Architecture Guardrails

## Confirmed by signed BRD/SRS v1.4
| ID | Rule | Consequence |
|---|---|---|
| D-001 | Admission needs no payment. | Never gate admission on fees. |
| D-002 | Admission Fee variable; no mandatory first payment/order. | No fixed first-payment constraint. |
| D-003 | Payments only recorded. | No payment processor/gateway. |
| D-004 | Receipt sequence shared across types and final receipt. | Transactional unique numbering. |
| D-005 | Final fees receipt only after all applicable fees paid. | Server-side eligibility check. |
| D-006 | Payer/Cashier/Manager signatures; Manager is Principal. | Required receipt lines. |
| D-007 | No automatic fee/balance carry-forward. | Explicit year scoping. |
| D-008 | No hard deletes; ledger/receipt/audit history immutable. | App + DB-level protections. |
| D-009 | Annual LC/TC issue does not itself mark student Left/Transferred. | Separate certificate and status workflows. |
| D-010 | Client owns deployment, live security, backups and operations. | Source-only handover boundary. |
| D-011 | Deliverable is source code and handover package. | Do not imply deployment is included. |

## Technical decisions pending
- ADR-001 modular monolith/module map vs actual repository structure.
- API/error/validation contract after code audit.
- Existing persistence/file storage/PDF approach after code audit.
- Final role matrix and technical System Administrator authority.
- Any database/schema gaps, each requiring reviewed migration plan and explicit approval.

## Rule
Proposed/illustrative/conditional/open details in this pack are not approved decisions. Do not swap framework/ORM/provider, migrate schema or add out-of-scope service until the relevant ADR/change request is accepted.
