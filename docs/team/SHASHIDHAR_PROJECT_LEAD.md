# Shashidhar — Project Lead & Architecture Owner

**Email:** shashipshetti@gmail.com  
**Team role:** Project lead, architecture/ADR owner, identity/RBAC integration owner and release-gate coordinator.  
**Primary Notion work:** M0.1, M0.2, M0.3, M0.5, M1.1, M1.3, M2.1, M2.2, M3.1–M3.3, M4.5, M7.2, M8.1, M8.3–M8.4 (respect each task's dependencies/status).

## Mission

Keep the team aligned to signed BRD/SRS v1.4, ensure architectural decisions are evidence-based, integrate the modules through one accepted application/API path, enforce security and role boundaries, and prepare independently reviewed releases.

## Responsibilities now — baseline and planning

- Verify the repository URL, branch, HEAD, working-tree status and baseline artifacts without changing them.
- Own requirement traceability against the signed BRD/SRS; distinguish confirmed rules from working assumptions and open client decisions.
- Review M0.4's schema inventory with Ujwal; make sure its inspection is read-only and no sensitive rows are copied into Notion.
- Maintain the single Decision & Risk Register and assign an owner/approver/next action for every material unknown.
- Lead M1.1: compare actual repository structure with the proposed architecture, record alternatives, security/data impact, test strategy, rollout/rollback and approval status.
- Do not assume the application framework from `.env.example`. The supplied archive does not visibly contain a package manifest or application route/service tree; confirm the source branch before choosing implementation patterns.

## Responsibilities after upstream gates

- Define and integrate the approved API/error/validation conventions and shared runtime configuration.
- Lead authentication and server-side authorization integration only after the Principal/client approves the role/action matrix, including the technical System Administrator boundary.
- Ensure UI hiding is never the only access control. Protect direct API calls, sensitive fields, search/export, document downloads and year-scoped resources.
- Maintain integration conventions and coordinate cross-module contracts among admissions, fees/ledger, receipts, certificates, audit and reporting.
- Own release-readiness coordination, unresolved risk visibility, final evidence collection and client acceptance tracking.

## Deliverables

- Baseline verification report and requirement traceability map.
- Approved architecture ADR and module/API contracts.
- Authorization decision matrix and tests for allowed/denied cases.
- Environment/setup and troubleshooting runbook.
- Security regression report, acceptance checklist and handover index.
- Notion task pages with PR/evidence links and current blockers.

## Explicit non-responsibilities

- Do not make client/Principal business-policy decisions on their behalf.
- Do not unilaterally approve schema changes, framework/ORM/provider replacements or migrations.
- Do not approve your own PR; request a different reviewer.
- Do not authorize production hosting, backups, operations or training as deliverables when the signed engagement assigns them to the Client.

## Review duties

Review architecture, auth/RBAC, data exposure, integration, release and cross-cutting PRs. Ask the responsible domain owner to provide evidence for financial and admission rules rather than substituting assumptions. For schema, security, permission or financial changes, require an additional independent reviewer where practical.

## Ready-to-submit checklist

- [ ] The change maps to signed requirement IDs or an approved ADR.
- [ ] No open business rule was silently resolved in code.
- [ ] Unauthorized direct API/resource access is tested where applicable.
- [ ] Tests, PR link, evidence and known limitations are recorded.
- [ ] Data/database impact statement is accurate; no retained database mutation was performed without approval.
- [ ] Reviewer is independent from the author.
