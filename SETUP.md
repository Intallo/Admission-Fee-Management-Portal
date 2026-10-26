# Setup and Handover Guide

> **Source audit required:** This pack was generated from signed BRD/SRS, not an inspected runnable repository. GitHub connector access to the reference repo returned 404. Exact commands, runtime versions and environment-variable names must be verified during M0.1/M1; do not guess them or run unknown scripts against the retained database.

## 1. Responsibility boundary
Intallo delivers source code, database scripts, synthetic seed, setup guide, technical notes and acceptance evidence. Client owns deployment/hosting/domain/HTTPS, live security, database operations, backups/restore, monitoring, training and live operation/maintenance per signed scope.

## 2. Preflight
- Confirm repo URL, approved branch/commit and working tree.
- Inspect README, runtime manifests, scripts and CI workflows.
- Record actual runtime/package manager/service versions after verification.
- Read all database scripts before execution; identify reset/seed/migration/write behavior.
- Use a disposable test database for write-based tests.
- Confirm secrets are supplied securely and never committed.
- Confirm uploaded files reside in configurable private storage outside the public path.

## 3. Baseline verification (read-only)
Record current branch/HEAD, `git status --short`, presence of `5e1c47e`, and observed locations of schema, integrity migrations, synthetic seed, local Supabase config and verification script. Inspect the verification script for side effects before running it.
Never run `git reset`, `git clean`, reset/seed/migration or write SQL to force a desired state. If baseline or data differs, document and raise a reviewed task.

## 4. Environment
Record exact variable names in [`docs/ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) only after source inspection. Categories to check include DB connection, auth/session secrets, app origin/port, private file storage and PDF/log settings; **these are categories, not confirmed keys**.
- Keep `.env.example` placeholder-only.
- Ignore `.env`, credentials, private keys, DB dumps and uploads.
- Fail clearly when required config is missing; redact secrets in logs/errors.
- Separate server-only secrets from public browser variables.

## 5. Database rules
The signed SRS expects scripts for a clean target database, reference data, restricted application user, tests and fake seed. That is not authorization to run them against the retained database.
- M0.4 remains read-only.
- Schema changes require a separate reviewed task/ADR, exact migration, impact, backup/rollback plan, isolated test evidence and explicit approval.
- Test migrations only on disposable isolated DBs.
- Use synthetic fixtures; no real student records in seed/tests.
- App DB role must lack DELETE on core tables and UPDATE on payment ledger, receipts and audit log as SRS US-33 specifies.
- Never attach production connection strings, dumps or credentials.

## 6. Commands (fill after verifying repo)
| Action | Verified command | Notes |
|---|---|---|
| Install dependencies | TODO — inspect manifest/lockfile | Do not choose a package manager by assumption. |
| Start local services | TODO — inspect local configuration | Must not target retained/production DB by default. |
| Start application | TODO — inspect scripts | Record URL and healthy startup message. |
| Unit tests | TODO — inspect test runner | Synthetic data. |
| Integration tests | TODO — isolated test DB only | Never use retained DB for writes. |
| E2E tests | TODO — inspect configured runner | Verify base URL and cleanup targets. |
| Lint/type/build | TODO — inspect scripts | Record versions/results. |
| Business-rule DB test script | TODO — inspect script body before execution | Do not run until side effects known. |

SRS US-40 requires successful clean-machine reproduction before handover.

## 7. Initial administrator
SRS A-21 proposes a setup script for first technical administrator and forced password change. That assumption and SYSADMIN role need approval. Never commit default credentials; use a secure one-time bootstrap and password hashing, and document verified process only after implementation.

## 8. Documents and PDF
Use private configurable storage outside public web path, validate file type/size, authorize every upload/preview/download, preserve prior versions and record uploader/time. Generate official receipts/TCs server-side from authorized data and immutable issue snapshots.

## 9. Live operation
Client manages HTTPS, server hardening, least-privilege secrets, production monitoring, scheduled DB/file backups and restore testing. This guide may recommend these controls but must not claim Intallo operates them. Client verifies physical printer layout after deployment.

## 10. Release setup checklist
- [ ] Clean-machine setup commands verified.
- [ ] Actual runtime versions and environment keys documented.
- [ ] Database scripts reviewed/tested only on approved clean target.
- [ ] Synthetic seed and business-rule tests validated.
- [ ] Restricted DB app role and file permissions checked.
- [ ] Source, setup guide, technical notes and test evidence delivered.
- [ ] Client ownership of hosting, live security, backups, operations, training and maintenance acknowledged.
