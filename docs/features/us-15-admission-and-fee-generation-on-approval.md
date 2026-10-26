# US-15 — Admission and fee generation on approval

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-15 Admission and fee generation on approval** (BR-12, BR-37, P1) As an Admission Officer, I want an approved application to become an admitted student with an admission number and a generated fee, so that payments can be recorded whenever the parent pays.

- AC1: On approval, the student's fee is generated from the year's approved fee structure for the standard the Principal placed the student in: every fixed fee head with an amount, and the Vehicle fee for the student's place if the school vehicle is used (R-09).
- AC2: In the same save, the system assigns the admission number (for example ADM-2026-0001) and sets the status to Admitted. **No payment is required.**
- AC3: Rejected applications stay in the records with their full history.
- AC4: Students who have not paid anything yet appear in the outstanding dues list (US-24) like any other student with a balance.
- AC5: If there is no approved fee structure for the year, approval and admission still complete. The student appears in a "Fee not generated" list, and the fee is generated as soon as a structure is approved.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
