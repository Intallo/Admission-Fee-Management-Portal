# US-12 — Save and edit draft

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-12 Save and edit draft** (BR-09, P1) As an Admission Officer, I want to save my work and return later so that I don't lose partial entries.

- AC1: Drafts can be edited any number of times until submitted.
- AC2: Submitted applications are read-only for the officer. The Principal may return an application to Draft with a reason.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
