# US-36 — Generate the LC/TC

- **SRS source:** v1.4, Section 5, Module 9: Leaving / Transfer Certificate
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-36 Generate the LC/TC** (BR-34, P2) As an Admission Officer, I want the approved certificate generated automatically from stored data, in the school's approved template, so that no details are retyped.

- AC1: The TC pulls student name, STS number, parents' names, DOB (in figures and words), admission number and date, class in the year, last class studied, caste/sub-caste where the approved format requires it, previous school, leaving date, reason, conduct remarks, and the issue date.
- AC2: A unique TC number is assigned (for example TC-2026-0001).
- AC3: The layout follows the format approved by the Client (A-14), with signature and seal areas.
- AC4: Generating or issuing a certificate **does not change the student's status**. A continuing student stays Admitted; leaving is recorded separately (US-32).

## Open-decision note

Approved TC format/fields are required before final PDF acceptance.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
