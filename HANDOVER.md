# Source Code Handover Checklist (Phase 7 Final Baseline)

> **Handover Status:** Complete & Verified  
> **Comprehensive Handover Package:** See [docs/HANDOVER_CHECKLIST.md](docs/HANDOVER_CHECKLIST.md) for full traceability, verification evidence, and formal sign-off blocks.  
> **Delivery Boundary:** Intallo delivers verified source code, test suites, and handover documentation; Client operates production hosting, TLS, live database operations, and backups.

## Source/documentation
- [x] Source/repository access transferred as agreed and release commit/tag recorded.
- [x] Signed BRD/SRS v1.4 and approved CRs retained.
- [x] README/setup tested on a clean machine ([docs/DEVELOPER_SETUP_AND_TROUBLESHOOTING.md](docs/DEVELOPER_SETUP_AND_TROUBLESHOOTING.md)).
- [x] Architecture, role matrix, logical data model, number formats and features included ([docs/ARCHITECTURE_AND_API_REFERENCE.md](docs/ARCHITECTURE_AND_API_REFERENCE.md)).
- [x] Tests, acceptance evidence, known limitations and open items provided ([docs/TEST_STRATEGY_AND_RESULTS.md](docs/TEST_STRATEGY_AND_RESULTS.md), [docs/KNOWN_LIMITATIONS_AND_RISK_REGISTER.md](docs/KNOWN_LIMITATIONS_AND_RISK_REGISTER.md)).

## Database/data
- [x] Schema/reference/permission scripts tested only against an approved clean target ([docs/DATABASE_MIGRATION_RUNBOOK.md](docs/DATABASE_MIGRATION_RUNBOOK.md)).
- [x] Restricted application DB user configured per SRS (`school_app_user`, US-33 AC2).
- [x] Business-rule verification script is repeatable after deployment (`supabase/tests/*`).
- [x] Synthetic seed covers SRS US-41 scenarios (255 demo students, 5 staff accounts).
- [x] No real student data, secrets or production dump in source/handover.
- [x] Client acknowledges DB setup, operation, backups and restore responsibility ([docs/BACKUP_AND_RESTORE_GUIDE.md](docs/BACKUP_AND_RESTORE_GUIDE.md)).

## Security/document printing
- [x] No committed secrets ([docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)).
- [x] Private file storage path and authorization rules documented.
- [x] Sensitive field restrictions/encryption and audit tests reviewed (US-03, R-06).
- [x] Receipt/TC layout approved with Client-provided assets (all 3 signatures: Payer, Cashier, Manager).
- [x] Client checks physical printer output in its deployment environment.

## Acceptance and responsibility
- [x] E2E and financial reconciliation pass (100% test pass: 26 files, 219 tests).
- [x] No critical unresolved privacy/auth/data-integrity defect unless explicitly accepted by authorized Client.
- [x] Deferred items/known limitations signed off ([docs/KNOWN_LIMITATIONS_AND_RISK_REGISTER.md](docs/KNOWN_LIMITATIONS_AND_RISK_REGISTER.md)).
- [x] Written Client acceptance captured.
- [x] Client owns deployment, hosting, HTTPS, production data, backups/restore, operations, training, maintenance and live security ([docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)).

## Not included unless separately agreed
Live deployment/hosting, operating backups, production data migration, live support/monitoring, user training/manuals, online payments, mobile app or out-of-scope modules.
