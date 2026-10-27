# Decision Log and Architecture Guardrails

> [!IMPORTANT]
> **Canonical Single Register:** Per Milestone M0.5, all confirmed decisions, pending architectural proposals, and open risks are centralized in the single canonical register:
> 👉 **[`docs/DECISION_AND_RISK_REGISTER.md`](docs/DECISION_AND_RISK_REGISTER.md)**.
> To prevent duplicate registers, refer to the canonical register for owners, approvers, evidence, and next actions.

## 1. Confirmed Decisions by Signed BRD/SRS v1.4
| ID | Rule | Consequence | Approver & Evidence |
|---|---|---|---|
| **D-001** | Admission needs no payment. | Never gate admission on fees. | Client (Rakesh A.) — SRS §3 A-04 |
| **D-002** | Admission Fee variable; no mandatory first payment/order. | No fixed first-payment constraint. | Client (Rakesh A.) — SRS §3 A-04 |
| **D-003** | Payments only recorded. | No payment processor/gateway. | Client (Rakesh A.) — BRD §5.6 |
| **D-004** | Receipt sequence shared across types and final receipt. | Transactional monotonic unique numbering. | Client (Rakesh A.) — SRS §3 A-10 |
| **D-005** | Final fees receipt only after all applicable fees paid. | Server-side eligibility check. | Client (Rakesh A.) — SRS §3 A-28 |
| **D-006** | Payer/Cashier/Manager signatures; Manager is Principal. | Required receipt lines. | Client (Rakesh A.) — SRS §3 A-29 |
| **D-007** | No automatic fee/balance carry-forward. | Explicit annual year isolation. | Client (Rakesh A.) — SRS §3 A-07 |
| **D-008** | No hard deletes; ledger/receipt/audit history immutable. | App + DB-level triggers. | Signed BRD/SRS §4 R-01 |
| **D-009** | Annual LC/TC issue does not itself mark student Left/Transferred. | Separate certificate and status workflows. | Signed BRD/SRS §3 A-33 |
| **D-010** | Client owns deployment, live security, backups and operations. | Source-only handover boundary. | Signed BRD/SRS §3 A-19 |
| **D-011** | Deliverable is source code and handover package. | Source repository and runbook. | Signed BRD §13 |
| **D-012** | Single-category payment integrity (no mixed categories). | Enforced via DB triggers and API checks. | Signed SRS §4 R-17 |

## 2. Technical Decisions Pending (Gating M0 Exit)
- **REG-01:** Principal vs. System Administrator Role Governance Boundary (see `docs/DECISION_AND_RISK_REGISTER.md` §2).
- **REG-19:** ADR-001 Modular Monolith vs. actual repository tree structure (target Milestone M1.1).
- **REG-20:** Server-side API mediation vs. Client Row-Level Security policies (target Milestone M1.1 / M3.2).

## 3. Governance Rule
Proposed, illustrative, or working details in this documentation pack are not approved decisions. Do not swap frameworks, add external payment providers, or migrate database schemas until the relevant ADR or client change request is formally accepted.
