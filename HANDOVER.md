# Source Code Handover Checklist

Intallo delivers source code and handover package; Client operates production.

## Source/documentation
- [ ] Source/repository access transferred as agreed and release commit/tag recorded.
- [ ] Signed BRD/SRS v1.4 and approved CRs retained.
- [ ] README/setup tested on a clean machine.
- [ ] Architecture, role matrix, logical data model, number formats and features included.
- [ ] Tests, acceptance evidence, known limitations and open items provided.

## Database/data
- [ ] Schema/reference/permission scripts tested only against an approved clean target.
- [ ] Restricted application DB user configured per SRS.
- [ ] Business-rule verification script is repeatable after deployment.
- [ ] Synthetic seed covers SRS US-41 scenarios.
- [ ] No real student data, secrets or production dump in source/handover.
- [ ] Client acknowledges DB setup, operation, backups and restore responsibility.

## Security/document printing
- [ ] No committed secrets.
- [ ] Private file storage path and authorization rules documented.
- [ ] Sensitive field restrictions/encryption and audit tests reviewed.
- [ ] Receipt/TC layout approved with Client-provided assets.
- [ ] Client checks physical printer output in its deployment environment.

## Acceptance and responsibility
- [ ] E2E and financial reconciliation pass.
- [ ] No critical unresolved privacy/auth/data-integrity defect unless explicitly accepted by authorized Client.
- [ ] Deferred items/known limitations signed off.
- [ ] Written Client acceptance captured.
- [ ] Client owns deployment, hosting, HTTPS, production data, backups/restore, operations, training, maintenance and live security.

## Not included unless separately agreed
Live deployment/hosting, operating backups, production data migration, live support/monitoring, user training/manuals, online payments, mobile app or out-of-scope modules.
