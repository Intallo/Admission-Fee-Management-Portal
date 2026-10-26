# Deployment and Operations Boundary

## Contract boundary
The signed BRD/SRS delivery model is source code and handover package. The Client handles installation/deployment, hosting, domain, HTTPS, production DB setup/operation, backup/restore, live security, monitoring, operations, user training and maintenance.

## Handover documentation should contain
- Verified runtime/build/config requirements and clean-machine setup steps.
- Environment variable names and secret-injection process (never actual secrets).
- Database creation scripts for a clean target, reference data, restricted app role, isolated business-rule test script and synthetic seed.
- Private document storage configuration and permission requirements.
- Role matrix, audit behavior, number formats and official PDF/template dependencies.
- Client-owned post-deployment tasks: HTTPS, backups/restore testing, access review, monitoring, patching and printer validation.
- Known issues, residual risks and support/warranty boundary as contracted.

## Database caution
A clean-database setup script is for a new approved target, not the retained DB. M0.4 remains read-only and all schema/data changes need a separately approved migration task.
