# Task Ownership Matrix

**Rule:** One accountable owner per task; reviewers provide independent verification. The Notion tracker controls the actual current Status, dependencies and reviewer assignment. The map below is an ownership guide, not permission to start a task before its dependency gates pass.

## Milestone-to-owner mapping

| Task / work item | Owner | Reviewer / partner | Readiness condition |
|---|---|---|---|
| M0.1 Verify Git baseline/repository state | Shashidhar | Ujwal | Start immediately; no state changes |
| M0.2 BRD/SRS v1.4 traceability | Shashidhar | Ujwal | Use signed copies in `docs/requirements/` |
| M0.3 Environment and script safety inventory | Shashidhar | Sujal | Inspect before running; don't reveal secrets |
| M0.4 Read-only schema/data inventory | Ujwal | Shashidhar | Read-only only; no sensitive row exports |
| M0.5 Decision/risk consolidation | Shashidhar | Ujwal | Reference one Notion Decision & Risk Register |
| M1.1 Architecture comparison and ADR | Shashidhar | All members contribute; independent review | M0 evidence available; no structural work before approval |
| M1.2 Module boundaries and dependency rules | Sujal | Shashidhar | M1.1 ADR accepted |
| M1.3 API/error contract | Shashidhar | Jeevan | M1.1 accepted; contract design before implementation |
| M1.4 Private document/PDF design | Jeevan | Shashidhar and Sujal | M1.1 accepted; no provider/schema changes without approval |
| M2.1 Runtime/configuration/secrets | Shashidhar | Sujal | M1 direction accepted; confirm actual app source/manifest |
| M2.2 Validation/errors/audit boundary | Shashidhar | Jeevan | M1.3 contract accepted |
| M2.3 Test harness/quality gates | Sujal | Shashidhar | Use actual approved stack; isolated fixtures |
| M2.4 Frontend shell/accessibility primitives | Sujal | Ujwal | M1.2 accepted and app source/stack confirmed |
| M3.1 Role matrix and Principal/System Administrator decision | Shashidhar | Ujwal | Written client/Principal decision before permissions implementation |
| M3.2 Authentication/server-side authorization | Shashidhar | Sujal | M3.1 accepted; M2 foundations ready |
| M3.3 Controlled provisioning/account recovery | Shashidhar | Ujwal | Role matrix and auth accepted |
| M3.4 School settings/academic-year boundaries | Ujwal | Shashidhar | Existing schema inventory and API contract ready |
| M3.5 Audit coverage for sensitive/financial actions | Jeevan | Shashidhar | Approved audit interface and authorization model |
| M4.1 Admission form/validation UX | Sujal | Ujwal | Field list, API contract and shell approved |
| M4.2 Admission workflow (no payment gate) | Ujwal | Shashidhar | Role/state rules approved; form/API ready |
| M4.3 Private admission documents | Ujwal | Shashidhar | Approved storage/security design |
| M4.4 Student record lifecycle/identifiers | Ujwal | Jeevan | Schema inventory, year rules and workflow approved |
| M4.5 Sensitive data/access isolation regression | Shashidhar | Ujwal | Auth and record/document paths exist |
| M5.1 Fee structures/variable admission fee | Jeevan | Shashidhar | Approved fee policy and data contract |
| M5.2 Offline collections/immutable ledger | Jeevan | Shashidhar | Fee structure and audit contract ready |
| M5.3 Precise INR arithmetic/rounding | Jeevan | Shashidhar | Amount representation and rounding rule agreed |
| M5.4 Approved adjustments/concessions/corrections | Jeevan | Shashidhar | Written policy and role authority accepted |
| M5.5 Balance reconciliation/year isolation | Jeevan | Ujwal | Fee/ledger slices and year boundaries implemented |
| M6.1 Final receipt eligibility/signatures | Jeevan | Shashidhar | Ledger totals and receipt rules available |
| M6.2 Server PDF/print UX | Sujal | Jeevan | Approved document fields/template and renderer approach |
| M6.3 Annual LC/TC issuance | Ujwal | Shashidhar | Approved TC template and dues/reissue rules |
| M6.4 Print layout regression | Sujal | Ujwal | Receipt and certificate samples generated with synthetic data |
| M7.1 Critical end-to-end workflows | Sujal | Shashidhar | M3–M6 feature slices integrated |
| M7.2 Security/authorization regression | Shashidhar | Jeevan | Auth, document, receipt and certificate paths exist |
| M7.3 Financial arithmetic/reconciliation | Jeevan | Shashidhar | Fee/receipt slices complete; isolated DB only |
| M7.4 Accessibility/privacy/usability review | Sujal | Ujwal | Main forms/print paths available |
| M8.1 Setup/operations/troubleshooting runbook | Shashidhar | Sujal | Actual startup/test commands verified |
| M8.2 Source and handover package | Ujwal | Shashidhar | Release evidence and artifact list available |
| M8.3 Final acceptance gate | Shashidhar | Ujwal | All milestone evidence assembled; Client/Principal acceptance required |
| M8.4 Known limitations/post-release backlog | Shashidhar | Sujal | All regression findings triaged |

## Feature responsibility map

| Domain | Accountable owner | Consulted / partner | Required peer review focus |
|---|---|---|---|
| Requirements traceability / ADR / integration | Shashidhar | All | Signed scope, alternatives, security and rollback |
| Identity, roles, authorization | Shashidhar | Ujwal, Sujal | Deny-by-default, direct API access and sensitive fields |
| Academic years and year scoping | Ujwal | Shashidhar, Jeevan | Cross-year isolation and no automatic carry-forward |
| Admissions and student records | Ujwal | Sujal, Shashidhar | Principal decision, no payment prerequisite, lifecycle audit |
| Document upload/access | Ujwal | Sujal, Shashidhar | Private object access, validation, retention open decisions |
| Fee configuration / payment / ledger | Jeevan | Ujwal, Shashidhar | Exact money, allocation totals, immutable records |
| Receipts and reconciliation | Jeevan | Sujal, Shashidhar | Full-payment final receipt, shared numbering, signatures |
| LC/TC workflow | Ujwal | Jeevan, Shashidhar, Sujal | Annual per-student/year issuance, status separation, template approval |
| UI/UX / accessibility / E2E | Sujal | Ujwal, Jeevan | Server owns state/permissions; synthetic test data |
| Runbook / handover / acceptance | Shashidhar | Ujwal, all | Reproducibility, blockers and client responsibility boundaries |

## Review independence

- Shashidhar's PRs must be reviewed by Ujwal, Sujal or Jeevan as appropriate.
- Ujwal's PRs must be reviewed by Shashidhar or another non-author owner with domain knowledge.
- Sujal's PRs must be reviewed by Shashidhar, Ujwal or Jeevan depending on what changed.
- Jeevan's financial/schema-sensitive PRs must be reviewed by Shashidhar and, where practical, an additional peer.
- Changes to schema, RLS, authorization, financial integrity or immutable records require an explicit review of the SQL diff and test output; task ownership alone does not authorize those changes.
