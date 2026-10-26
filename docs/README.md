# Documentation Index

This documentation pack is derived from signed BRD v1.4 and SRS v1.4, approved 22 October 2026. The signed requirements under `requirements/` are unchanged source copies and take precedence over derived documents.

## Requested product docs
- [README](../README.md) — product overview and starting point.
- [PRD](../PRD.md) — objectives, users, capabilities, constraints and release principle.
- [Architecture](../ARCHITECTURE.md) — proposed target architecture; requires repository audit and ADR acceptance.
- [UI/UX](../UI_UX.md) — screen and interaction behaviors.
- [Web UX](../WEB_UX.md) — journeys, navigation, states and browser/print expectations.
- [Design system](../DESIGN_SYSTEM.md) — proposed tokens, components and accessibility.
- [Database & Supabase baseline](../DATABASE.md) — local setup, migrations, seed and schema behavior.
- [Setup](../SETUP.md) — preflight, safe baseline verification, environment and client handover.
- [File structure](../FILE_STRUCTURE.md) — proposed folder/module map; not a verified current tree.
- [Scope](../SCOPE.md) — in/out of scope and acceptance boundaries.
- [User rules](../USER_RULES.md) — roles, invariants and workflows.
- [Team roles](../TEAM_ROLES.md) — delivery ownership, team members and task matrix.
- [Contributing](../CONTRIBUTING.md) — branch/PR/review process.

## Feature documentation
- [Feature index](features/README.md) — one file per active SRS user story, including AC text.
- [Feature inventory](FEATURE_COUNT.md) — count and withdrawn-story note.

## Engineering and delivery docs
- [Functional requirements summary](../FUNCTIONAL_REQUIREMENTS.md)
- [Non-functional requirements](../NON_FUNCTIONAL_REQUIREMENTS.md)
- [API contract proposal](../API_SPEC.md) — resource groups/conventions, not existing endpoints.
- [Logical data model](../DATA_MODEL.md) — entities/integrity rules, not SQL schema.
- [Logical data dictionary](../DATA_DICTIONARY.md)
- [Authorization matrix](../AUTHORIZATION_MATRIX.md)
- [Security and privacy](../SECURITY_PRIVACY.md)
- [Audit logging](../AUDIT_LOGGING.md)
- [Error handling](../ERROR_HANDLING.md)
- [Environment variables](../ENVIRONMENT_VARIABLES.md) — exact keys must be filled from source audit.
- [Numbering and financial rules](../NUMBERING_AND_FINANCIAL_RULES.md)
- [Document management](../DOCUMENT_MANAGEMENT.md)
- [Test plan](../TEST_PLAN.md)
- [Acceptance tests](../ACCEPTANCE_TESTS.md)
- [Performance plan](../PERFORMANCE.md)
- [Quality gate](../QUALITY_GATE.md)
- [Traceability](../TRACEABILITY.md)
- [Open client decisions](../OPEN_ITEMS.md)
- [Decision log](../DECISIONS.md)
- [Release plan](../RELEASE_PLAN.md)
- [Change management](../CHANGE_MANAGEMENT.md)
- [Deployment and operations boundary](../DEPLOYMENT_AND_OPERATIONS.md)
- [Handover checklist](../HANDOVER.md)
- [Glossary](../GLOSSARY.md)

## Team and delivery
- [Team roles and ownership](../TEAM_ROLES.md)
- [Team documentation index](team/README.md)
- [Task ownership matrix](team/TASK_OWNERSHIP_MATRIX.md)
- [Workflow and handoffs](team/WORKFLOW_AND_HANDOFFS.md)
- [Review and submission policy](team/REVIEW_AND_SUBMISSION_POLICY.md)
- [Team onboarding checklist](team/TEAM_ONBOARDING_CHECKLIST.md)

## Canonical requirements
- [`requirements/School_Admission_Portal_BRD_v1.4.md`](requirements/School_Admission_Portal_BRD_v1.4.md)
- [`requirements/School_Admission_Portal_SRS_v1.4.md`](requirements/School_Admission_Portal_SRS_v1.4.md)

## Diagrams
- [`diagrams/architecture.mmd`](diagrams/architecture.mmd)
- [`diagrams/admission-flow.mmd`](diagrams/admission-flow.mmd)
- [`diagrams/fee-flow.mmd`](diagrams/fee-flow.mmd)
- [`diagrams/certificate-flow.mmd`](diagrams/certificate-flow.mmd)
- [`diagrams/data-model.mmd`](diagrams/data-model.mmd)

## Templates and ADRs
- [`templates/task-submission-template.md`](templates/task-submission-template.md)
- [`templates/database-migration-checklist.md`](templates/database-migration-checklist.md)
- [`adr/ADR-001-modular-monolith.md`](adr/ADR-001-modular-monolith.md) — proposed, pending audit/review.
- [`adr/ADR-TEMPLATE.md`](adr/ADR-TEMPLATE.md)

## Governance reminder
Preserve Git baseline `5e1c47e` and the retained database. M0.4 is strictly read-only. No technical proposal or open business assumption overrides the signed requirements or a pending Client decision.
