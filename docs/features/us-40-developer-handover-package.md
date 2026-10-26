# US-40 — Developer handover package

- **SRS source:** v1.4, Section 5, Module 10: Audit, Dashboard, and Handover
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-40 Developer handover package** (Delivery, P2) As the Client's deployment team, I want clear setup instructions and scripts so that we can deploy and run the code ourselves.

- AC1: The setup guide (README) lists requirements, configuration settings, database setup steps, how to run the application, how to create the first administrator, and where uploaded files are stored.
- AC2: Database scripts create all tables, load the school's reference data (sections, standards, receipt types, fee heads), and set up the restricted application user on an empty database.
- AC3: A database test script checks the business rules and can be re-run after deployment.
- AC4: The setup guide includes a short recommendation on backups and HTTPS. Performing them is the Client's responsibility.
- AC5: Technical notes describe the architecture, roles and permissions, data model, and number formats.
- AC6: A person who has not worked on the project can follow the guide to run the application on a clean machine. This is tested before handover.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
