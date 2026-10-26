# US-04 — Account management

- **SRS source:** v1.4, Section 5, Module 1: Authentication and Access Control
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-04 Account management** (BR-01, P1) As a system administrator, I want to create users, assign one role each, deactivate users, and reset passwords so that access follows staff changes.

- AC1: Deactivating a user blocks login but preserves all of their history.
- AC2: Users cannot be deleted.
- AC3: Passwords are stored hashed; a minimum strength rule applies.
- AC4: A setup script creates the first administrator account, and the password must be changed at first login (A-21).

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
