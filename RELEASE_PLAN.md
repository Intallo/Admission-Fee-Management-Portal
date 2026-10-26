# Delivery and Release Plan

The Notion tracker M0–M8 governs actual progress. Dates/effort must be re-estimated after repository audit; the SRS's roughly 18-week estimate is not a commitment made by this document.

| Phase | Outcome | Exit gate |
|---|---|---|
| M0 Baseline/traceability | Verify commit, requirement map, read-only schema inventory, open items. | Baseline evidence; no DB writes; requirement map and risks reviewed. |
| M1 Architecture/contracts | Compare code with CampusHR practices; module map/API/file/PDF ADR. | Accepted ADR before structural or schema changes. |
| M2 Engineering foundation | Verified environment, errors, validation, logs, testing and CI. | Reproducible safe setup; no leaked secrets; tests isolated. |
| M3 Identity/settings | Auth, roles, account lifecycle, academic years. | Accepted role matrix and positive/negative tests. |
| M4 Admissions/records | Forms, documents, workflow, seat policy and profile. | Admission before payment works; privacy and year scope pass. |
| M5 Fees/ledger | Fee config, offline collection, adjustments and reconciliation. | Exact arithmetic, no fixed-head overpay, append-only atomic ledger. |
| M6 Receipts/certificates | Receipt sequence/final receipt/statement, PDFs, annual LC/TC. | Eligibility, signature lines, year scope and status separation pass. |
| M7 QA/security | E2E, privacy/authorization, print, accessibility, financial QA. | No unresolved critical release blocker; evidence attached. |
| M8 Handover/acceptance | Setup/runbook, source, technical notes and Client acceptance. | Clean-machine setup reproduced and Client sign-off recorded. |

## Feature workflow
Ready task → branch/implementation → tests → PR + evidence → independent review → feedback/retest if needed → accepted merge/document → task marked Done. Do not mark milestones accepted just because code was written.

## Release gate
Requirements mapped to tests; admission before payment; balances and amount-in-words correct; unique receipts and final receipt eligibility; privacy/no-delete protections; approved LC/TC template and no status side effect; clean setup, fake-data seed, business-rule tests, source handover and written Client acceptance.
