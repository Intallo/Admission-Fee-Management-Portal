# Architecture and Technical Design

> **STATUS: PROPOSED — NOT APPROVED.** This describes target boundaries, not the existing source tree. The current GitHub connector returned 404 for CampusHR during documentation generation, so no file-by-file comparison was verified. Preserve baseline `5e1c47e` and the retained database. Complete M0.1/M0.4 and accept M1.1 ADR before framework, ORM, provider, schema or directory changes.

## Design goals
- Satisfy signed BRD/SRS before choosing technical patterns.
- Prefer the smallest maintainable architecture with clear boundaries and tests.
- Keep one frontend app and one backend/API entry path unless accepted ADR proves otherwise.
- Preserve the current runtime/framework/ORM/provider/schema until evidence-based approval.
- Enforce role checks, validation, audit and money invariants in trusted server/service layers.
- Support source-only handover to Client-operated hosting/production.

## Proposed pattern
A modular monolith is the hypothesis: one deployable product, feature-based UI, domain services and adapters for current persistence/file storage. Explicit module boundaries should not create duplicate APIs, duplicated authentication systems or parallel persistence stacks.

## Domain modules
| Module | Responsibility | Key invariants |
|---|---|---|
| Identity & Access | Authentication, account lifecycle, permission enforcement | Deny by default, sensitive fields restricted, history preserved |
| Academic Years & Settings | Year ranges/current/closed status, settings and seat limits | Explicit year scope; no carry-forward; closed-year write restrictions |
| Admissions | Draft, completeness, submission, Principal decision, admit/number assignment | No payment gate; Principal-only decisions; seat policy approved first |
| Student Records | Profile/search, parent data, status history | No hard delete; certificate does not change student status |
| Fee Configuration | Receipt types, heads, yearly structure, place tariffs | Principal approval; open tariff policy not guessed |
| Fees & Ledger | Student fee, payments/lines, balances, adjustments/reversals | Decimal money, fixed-head no overpay, append-only and atomic |
| Receipts & Statements | Sequence, snapshots, final receipt eligibility, PDF/reprints | One receipt/payment, final only fully paid, shared unique sequence |
| Documents | File validation, private storage, versions and access | Outside public path, permission checks for each download |
| LC/TC | Annual record, two-step review, issue snapshot/reprint | One/student/year; approved format; no status side effect |
| Audit & Reporting | Immutable audit query and basic dashboard/report projections | Redaction and totals reconcile to source |

## Dependency rules
1. UI calls the approved API/service contract, never persistence directly.
2. API/controller validates input, identity, authorization and year/record scope before calling a domain service.
3. Domain services own state transitions, financial rules, atomic orchestration and authorization-relevant checks.
4. Only approved infrastructure adapters access the database/file store.
5. Modules expose small public contracts; avoid imports into another module's internal persistence and avoid circular dependencies.
6. Financial/numbering workflow uses transaction semantics supported by actual database. Test failure and retry paths.
7. Official documents are server-generated and preserve issue snapshots.
8. Do not add payment gateways, notifications, mobile app or other out-of-scope sidecars.

## Money and data integrity
- INR exact decimal/two-place arithmetic; never float/double.
- Payment line total equals payment total at commit.
- Payment + lines + variable-head billing + receipt number commit together as required by SRS or none.
- Number allocation is transactional and committed numbers are never reused.
- Balances/status derived from a single authoritative calculation.
- No core hard deletes, no cascade delete, no normal application UPDATE/DELETE on protected ledger/receipt/audit.

## Security
Server-side RBAC/field-level checks for lists, direct APIs, exports, PDFs and file downloads. Encrypt sensitive fields where stored as required. Keep files outside public web path. Use only synthetic test data and isolated test DBs.

## Architecture decision gate
M1.1 must include current repo tree, stack, routing/API entry points, auth, persistence, storage/PDF approach, scripts/tests/CI, selected/rejected CampusHR patterns, module diagram, options/trade-offs, security/operations, schema impact and rollback. See [`docs/adr/ADR-001-modular-monolith.md`](docs/adr/ADR-001-modular-monolith.md).
