# US-07 — Create application

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-07 Create application** (BR-05, BR-09, P1) As an Admission Officer, I want to start a new application and choose the standard so that the right section and fee apply.

- AC1: Standard is chosen from Nursery, LKG, UKG, 1 to 10. Section (Pre-primary, Primary, High School) is derived automatically.
- AC2: A draft can be saved with only the minimum fields (student name and standard).
- AC3: A draft receives an application number on first save, in the school's format (for example 161/2026-27), and an application date that defaults to today and can be set to the date written on the form.
- AC4: The seats used and available for the section are shown on the screen (US-42).

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
