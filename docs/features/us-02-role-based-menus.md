# US-02 — Role-based menus

- **SRS source:** v1.4, Section 5, Module 1: Authentication and Access Control
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-02 Role-based menus** (BR-03, P1) As a user, I want to see only the screens and actions that match my role so that I don't make unauthorized changes.

- AC1: Menu items outside my role are hidden.
- AC2: Direct URL or API access to a forbidden action returns "Access denied" and is logged.
- AC3: The permission matrix in BRD 7.1 is enforced on the server, not only in the interface.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
