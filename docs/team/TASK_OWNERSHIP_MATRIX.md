# Solo Task Ownership Matrix

**Current owner for every active task:** Shashidhar (`shashipshetti@gmail.com`).  
**Reviewer:** Unassigned — use documented self-review and automated checks; do not claim independent peer approval.  
**Approval boundary:** required Client/Principal sign-offs and accepted architecture/business decisions remain mandatory.

This matrix supersedes previous multi-contributor allocations. Historical PRs and submissions remain unchanged as evidence of prior work. Do not start a task before its dependencies and decision gates pass.

## Task ownership by milestone

| Task | Sole implementation owner | Readiness / safety gate |
|---|---|---|
| M0.1 Git baseline verification | Shashidhar | Record HEAD/status without reset/clean/database writes |
| M0.2 BRD/SRS traceability | Shashidhar | Signed v1.4 is source of truth |
| M0.3 Environment and script safety | Shashidhar | Inspect scripts before execution; never reveal secrets |
| M0.4 Read-only schema/data inventory | Shashidhar | Strictly read-only; no sensitive row exports |
| M0.5 Decision/risk consolidation | Shashidhar | Canonical register; resolve M0 exit gates |
| M1.1 Architecture ADR | Shashidhar | Confirm actual source tree; ADR remains proposed until accepted |
| M1.2 Module boundaries | Shashidhar | M1.1 accepted |
| M1.3 API/error contract | Shashidhar | M1.1 accepted; contract design before implementation |
| M1.4 Private document/PDF design | Shashidhar | M1.1 accepted; no provider/schema changes without approval |
| M2.1 Runtime/configuration/secrets | Shashidhar | Confirm actual app source/manifest and accepted architecture |
| M2.2 Validation/errors/audit boundary | Shashidhar | M1.3 contract accepted |
| M2.3 Test harness/quality gates | Shashidhar | Approved stack; isolated fixtures |
| M2.4 Frontend shell/accessibility primitives | Shashidhar | Source/stack confirmed; M1.2 accepted |
| M3.1 Role matrix and Principal/System Administrator boundary | Shashidhar | Written Client/Principal decision before permissions implementation |
| M3.2 Authentication/server-side authorization | Shashidhar | M3.1 accepted; M2 foundations ready |
| M3.3 User provisioning/account recovery | Shashidhar | Role matrix/auth design accepted |
| M3.4 School settings/academic-year boundaries | Shashidhar | Schema inventory/API contract available |
| M3.5 Audit coverage for sensitive/financial actions | Shashidhar | Approved audit interface and authorization model |
| M4.1 Admission form/validation UX | Shashidhar | Approved fields/API contract/shell |
| M4.2 Admission workflow (no payment gate) | Shashidhar | State/role rules approved; no payment prerequisite |
| M4.3 Private admission documents | Shashidhar | Approved storage/security design |
| M4.4 Student record lifecycle/identifiers | Shashidhar | Schema/year rules/workflow approved |
| M4.5 Sensitive data/access isolation | Shashidhar | Auth and record/document paths exist |
| M5.1 Fee structures/variable Admission Fee | Shashidhar | Approved fee policy/data contract |
| M5.2 Offline collections/immutable ledger | Shashidhar | Fee structure/audit contract ready |
| M5.3 Precise INR arithmetic/rounding | Shashidhar | Amount representation/rounding rule agreed |
| M5.4 Adjustments/concessions/corrections | Shashidhar | Written policy and role authority accepted |
| M5.5 Balance reconciliation/year isolation | Shashidhar | Ledger slices/year boundaries implemented |
| M6.1 Final receipt eligibility/signatures | Shashidhar | Ledger totals/receipt rules available |
| M6.2 Server PDF/print UX | Shashidhar | Approved fields/template/renderer design |
| M6.3 Annual LC/TC issuance | Shashidhar | Approved TC template/dues/reissue rules |
| M6.4 Print layout regression | Shashidhar | Synthetic receipt/certificate samples available |
| M7.1 Critical end-to-end workflows | Shashidhar | M3–M6 slices integrated |
| M7.2 Security/authorization regression | Shashidhar | Auth/document/receipt/certificate paths exist |
| M7.3 Financial arithmetic/reconciliation | Shashidhar | Financial slices complete; isolated DB only |
| M7.4 Accessibility/privacy/usability review | Shashidhar | Main forms/print paths available |
| M8.1 Setup/operations/troubleshooting runbook | Shashidhar | Actual startup/test commands verified |
| M8.2 Source and handover package | Shashidhar | Release evidence and artifact list available |
| M8.3 Final acceptance gate | Shashidhar | All evidence assembled; Client/Principal acceptance required |
| M8.4 Known limitations/post-release backlog | Shashidhar | Regression findings triaged |

## Solo implementation checklist

- Confirm the source branch and actual runtime before scaffolding.
- Follow signed requirements and accepted ADRs; record proposals as proposals.
- Perform self-review and run relevant automated tests; capture commands and outcomes.
- Use synthetic data and isolated databases for write tests.
- Keep database changes in separate reviewed/approved migration tasks.
- Obtain Client/Principal approvals where required; do not imply a self-review is an independent peer review.
