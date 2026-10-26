# US-11 — Track missing documents

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-11 Track missing documents** (BR-08, P1) As an Admission Officer, I want a checklist of required and missing documents so that I can follow up with parents.

- AC1: The application shows each required document as Received or Missing.
- AC2: A list view shows applications with missing documents, filterable by standard.
- AC3: Submission is blocked until mandatory documents are received. The officer may override only by marking a reason and sending the application to the Principal as "documents pending".

## Open-decision note

Mandatory-document override must follow the SRS process and an approved Client procedure.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
