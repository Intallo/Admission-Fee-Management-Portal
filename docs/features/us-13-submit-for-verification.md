# US-13 — Submit for verification

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-13 Submit for verification** (BR-10, P1) As an Admission Officer, I want to submit a complete application so that the Principal can review it.

- AC1: Submission runs a completeness check and lists any missing fields.
- AC2: On success, the status becomes Submitted and the date, time, and user are recorded.
- AC3: The Principal's review queue shows the new application.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
