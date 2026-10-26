# US-30 — Search students

- **SRS source:** v1.4, Section 5, Module 8: Student Records
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-30 Search students** (BR-28, P1) As any staff user, I want to search by name, admission number, STS number, standard, or year so that I can find a student quickly.

- AC1: Search returns results within 3 seconds for a typical year of records on the demo environment.
- AC2: Results show only fields permitted for my role (R-06, A-03).
- AC3: Left/Transferred students are included and clearly labelled.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
