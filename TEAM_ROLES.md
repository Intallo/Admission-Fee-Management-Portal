# Team Roles & Responsibilities

**Project:** School Admission & Fee Management Portal  
**Requirements baseline:** Signed BRD v1.4 and SRS v1.4, approved 22 October 2026  
**Documentation version:** 1.0 — 26 October 2026  
**Status:** Delivery ownership proposal aligned to the supplied repository archive and current Notion task plan.

> **Important distinction:** This file describes the four developers' delivery responsibilities. It does **not** define the application's business roles (Principal, Admission Officer, Accounts Officer, or technical System Administrator). Application permissions remain governed by the signed BRD/SRS and the approved authorization matrix.

## At a glance

| Team member | Email | Delivery role | Primary ownership |
|---|---|---|---|
| **Shashidhar** | shashipshetti@gmail.com | Project Lead & Architecture / Integration Owner | Requirements traceability, architecture decisions, auth/RBAC integration, risk control, cross-module integration and release acceptance coordination |
| **Ujwal** | bilagiujwal505@gmail.com | Admissions & Student Records Owner | Read-only schema inventory, admission lifecycle, student/year records, admission documents, LC/TC workflow and traceability support |
| **Sujal** | sujalv641@gmail.com | Frontend / UI-UX & Quality Owner | UI architecture after ADR approval, accessible forms, navigation, print UX, frontend test harness, end-to-end and accessibility checks |
| **Jeevan** | bennurjeevan@gmail.com | Fees / Ledger & Financial Integrity Owner | Fee configuration, offline payment flow, ledger/balances, approved adjustments/reversals, receipt eligibility and financial integrity tests |

## Current repository reality and team operating rule

The supplied `Admission-Fee-Management-Portal.zip` working tree contains the Supabase configuration, PostgreSQL migrations, synthetic seed, SQL integrity/verification tests, generated `src/types/database.types.ts`, and documentation. It does **not** contain a visible `package.json`, application route tree, UI components, API/service modules or application test runner in the working tree. A frontend may exist in another branch/repository, but it was not present in the supplied archive.

Therefore:

1. Begin with the baseline audit and read-only schema inventory.
2. Do not infer that a Next.js or other application framework has been fully set up solely from the `.env.example` variable names.
3. Do not begin framework, ORM, provider, directory or schema changes until the M1.1 architecture ADR is reviewed and approved.
4. Use isolated local/test databases and synthetic fixtures for any future write tests. M0.4 against the retained/shared database is read-only.
5. Keep the database state and baseline commit `5e1c47e` protected unless a separate reviewed task explicitly authorizes a change.

## Shared responsibilities (all four members)

- Read the relevant signed BRD/SRS sections and the assigned task's dependencies, acceptance criteria, Database Impact and Submission Guide before work begins.
- Work only within an assigned task; raise an issue instead of silently defining client policy.
- Use task-specific branches and focused pull requests; never commit secrets, real student/parent records, bank/Aadhaar details, private documents or database dumps.
- Prove the acceptance criteria with automated/manual test evidence. Record commands and actual results, not just “tested.”
- Keep `Implementation Task Tracker` properties updated: Status, PR Link, Evidence Link and Risk / Blocker.
- Submit via `In Review`; only the independent reviewer can accept the work. The task owner cannot approve their own PR.
- Raise a separate, explicit migration/decision task for any schema change. A PR alone is not authorization to change the retained database.
- Link follow-up tasks and unresolved decisions to the Notion Decision & Risk Register.

## Work ownership by milestone

| Milestone / workstream | Responsible owner | Supporting reviewer / collaborator | Constraint |
|---|---|---|---|
| M0.1 Git baseline verification | Shashidhar | Ujwal | Record branch, HEAD, status and files; no reset/clean/database writes |
| M0.2 BRD/SRS traceability | Shashidhar | Ujwal | Signed v1.4 is source of truth |
| M0.3 safe environment/script inventory | Shashidhar | Sujal | Inspect scripts before execution; never print secrets |
| M0.4 schema/data inventory | Ujwal | Shashidhar | Strictly read-only; do not export sensitive records |
| M0.5 decisions and risks | Shashidhar | Ujwal; all owners contribute | Open client rules remain open until written approval |
| M1.1 architecture ADR | Shashidhar | Ujwal, Sujal, Jeevan provide module-specific input | Do not implement structural changes before approval |
| M1.2 module boundaries | Sujal | Shashidhar | Starts after ADR approval |
| M1.3 API/error contract | Shashidhar | Jeevan | Contract design only until implementation task is ready |
| M1.4 private file/PDF design | Jeevan | Shashidhar; Sujal reviews print UX | No provider purchase or schema change without approval |
| M2 foundation / test harness | Shashidhar (runtime/errors), Sujal (test/UI foundation), Jeevan (audit/financial cases) | Different owner reviews each PR | Test environment must be isolated |
| M3 identity / authorization / settings | Shashidhar (identity/RBAC), Ujwal (academic year), Jeevan (audit event coverage) | Independent peer review | Role-authority conflict is a gate; least privilege by default |
| M4 admissions / student records / documents | Ujwal (domain), Sujal (form UX), Shashidhar (access controls) | Cross-review per task | Admission cannot be gated on payment; private files; year scoping |
| M5 fee configuration / offline ledger | Jeevan | Shashidhar financial/security review; Ujwal year-scope review | Exact INR arithmetic; no hard delete/carry-forward; approved rules only |
| M6 receipts / LC-TC / PDFs | Jeevan (receipt eligibility), Ujwal (LC/TC workflow), Sujal (PDF/print UX) | Cross-module peer review | Final fees receipt only after full payment; certificate issue does not set Left/Transferred |
| M7 QA / security / accessibility | Sujal (E2E/accessibility), Shashidhar (security/RBAC), Jeevan (financial reconciliation) | Independent reviewer | Synthetic test data only; no critical unresolved bypasses |
| M8 handover / acceptance | Shashidhar (release gate), Ujwal (handover index) | All owners provide evidence | Client owns live hosting/ops/backups unless contract changes |

## Decision and review authority

- **Client/Principal:** approves unresolved business rules, school policy, fee exceptions, role authority and accepted deliverables.
- **Shashidhar:** coordinates delivery and ADRs, tracks dependencies, performs integration and release-gate coordination. This does not authorize unilateral changes to signed business policy or the database.
- **Feature owner:** implements and submits the assigned feature; cannot approve their own PR.
- **Independent reviewer:** verifies the PR, acceptance criteria, test evidence, security/data invariants and documentation.
- **Any team member:** may block work and request a decision if an implementation depends on an unresolved requirement or could affect retained data.

## Definition of done

A task is Done only when the artifact/PR is linked, every acceptance criterion has evidence, relevant tests pass, review/merge or documentation acceptance is recorded, documentation and known limitations are updated, and database-safety requirements have been met. See [`docs/team/REVIEW_AND_SUBMISSION_POLICY.md`](docs/team/REVIEW_AND_SUBMISSION_POLICY.md).

## Individual role files

- [Shashidhar — Project Lead & Architecture](docs/team/SHASHIDHAR_PROJECT_LEAD.md)
- [Ujwal — Admissions & Student Records](docs/team/UJWAL_ADMISSIONS_STUDENT_RECORDS.md)
- [Sujal — Frontend, UI/UX & Quality](docs/team/SUJAL_FRONTEND_UX_QUALITY.md)
- [Jeevan — Fees, Ledger & Financial Integrity](docs/team/JEEVAN_FEES_LEDGER.md)
- [Task ownership matrix](docs/team/TASK_OWNERSHIP_MATRIX.md)
- [Workflow and handoffs](docs/team/WORKFLOW_AND_HANDOFFS.md)
- [Review and submission policy](docs/team/REVIEW_AND_SUBMISSION_POLICY.md)
- [Team onboarding checklist](docs/team/TEAM_ONBOARDING_CHECKLIST.md)
