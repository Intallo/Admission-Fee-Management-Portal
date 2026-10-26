# US-34 — Create the year's certificate records

- **SRS source:** v1.4, Section 5, Module 9: Leaving / Transfer Certificate
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-34 Create the year's certificate records** (BR-32, P2) As an Admission Officer, I want a certificate record created for every student of the academic year so that each student has a year-specific LC/TC.

- AC1: At year end, one action creates a certificate record for every admitted student of the selected year who does not have one yet. Left/Transferred students of that year are included.
- AC2: A record can also be created for a single student at any time, for example when a student leaves during the year, with the reason and intended leaving date.
- AC3: A list shows each student's certificate status for the year (not created, requested, reviewed, approved, issued), filterable by standard.
- AC4: Each student can have only one certificate record per academic year.
- AC5: The record shows the student's current unpaid balance (A-13).

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
