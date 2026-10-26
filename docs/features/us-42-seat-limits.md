# US-42 — Seat limits

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-42 Seat limits** (BR-38, P1) As the Principal, I want to set and monitor the seat limit for each section so that admissions never exceed the school's capacity.

- AC1: The Principal sets a seat limit per section per academic year. The default is 100 for each of Pre-primary, Primary, and High School (A-08).
- AC2: Seats used = applications that are Approved or Admitted in that section for that year (A-18). Seats available = limit − used.
- AC3: Seats used and available are visible on the application screen, the review screen, and the dashboard.
- AC4: Approval is blocked when seats available is zero (US-14 AC3).
- AC5: Changing a seat limit is logged with the old and new value, user, and date.
- AC6: Marking a student Left/Transferred frees the seat.

## Open-decision note

Meaning of the 100-seat limit (per section/total/per class) needs written confirmation.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
