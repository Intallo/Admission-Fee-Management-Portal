# US-14 — Principal decision

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-14 Principal decision** (BR-10, BR-11, P1) As the Principal, I want to review a submitted application and approve, reject, or hold it so that admissions follow school policy.

- AC1: The review screen shows student details, parents, documents, seat availability for the section, and a short summary.
- AC2: I can choose Approve (with grade placement), Reject (reason required), or On Hold (reason required).
- AC3: Approve is blocked, with a clear message, if the section's seat limit is reached (R-15).
- AC4: Decision date, time, user, and remarks are saved to the status history.
- AC5: An On Hold application can later be moved to Approved or Rejected.
- AC6: Only the Principal can make this decision.

## Open-decision note

Seat-limit interpretation must be confirmed; the decision remains Principal-only.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
