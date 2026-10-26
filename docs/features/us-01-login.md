# US-01 — Login

- **SRS source:** v1.4, Section 5, Module 1: Authentication and Access Control
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-01 Login** (BR-01, P1) As any user, I want to log in with my own username and password so that my actions are attributed to me.

- AC1: Given valid credentials, when I log in, then I reach the year-selection screen.
- AC2: Given invalid credentials, then I see a generic error and no account hint.
- AC3: After 5 consecutive failed attempts the account locks for 15 minutes.
- AC4: Sessions expire after 30 minutes of inactivity.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
