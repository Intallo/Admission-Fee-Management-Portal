# US-09 — Enter parent details

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-09 Enter parent details** (BR-06, P1) As an Admission Officer, I want to record both parents' details so that the school can contact them and verify identity.

- AC1: Father's full name, mother's full name, and occupation of each where the school requires it.
- AC2: Parent mobile: two numbers can be entered (primary and alternate), as on the form.
- AC3: At least one valid 10-digit contact number is required before submission.
- AC4: Income details, if collected, are visible only to authorized roles.

## Open-decision note

Parent occupation/income collection fields depend on the confirmed school form and policy.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
