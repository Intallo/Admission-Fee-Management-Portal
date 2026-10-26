# US-37 — Retrieve and reprint LC/TC

- **SRS source:** v1.4, Section 5, Module 9: Leaving / Transfer Certificate
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-37 Retrieve and reprint LC/TC** (BR-35, P2) As an Admission Officer or Principal, I want to open any student's certificate for any academic year at any time so that copies can be issued years later.

- AC1: Certificates are searchable by student, TC number, and academic year, and appear on the student's profile under that year.
- AC2: Reprints are labelled "DUPLICATE COPY" with the reprint date, and every reprint is logged.
- AC3: The original issued data is preserved even if the student record changes later.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
