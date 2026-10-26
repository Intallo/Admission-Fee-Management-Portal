# US-26 — Concession, negotiated fee, or extra charge

- **SRS source:** v1.4, Section 5, Module 6: Concessions, Negotiation, Refunds, and Exceptions
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-26 Concession, negotiated fee, or extra charge** (BR-21, BR-23, BR-40, P2) As an Accounts Officer or Principal, I want to record a concession, negotiated reduction, or extra charge on a fee head so that approved changes to a student's fee are tracked.

- AC1: The request has the student, the fee head, type (Concession, Negotiated reduction, Extra charge, Exception), amount, and a mandatory reason.
- AC2: Status flow: Requested → Approved or Rejected. **Only the Principal** can approve or reject.
- AC3: After the Admission Fee, the Principal can record the fee agreed after negotiation with the parent directly. This is logged with the reason and is the only case where the approver and recorder are the same person (R-05).
- AC4: On approval, the head's Billed amount, the student's Net Payable, and the balance are recalculated, and the entry appears in the breakdown with approver and date.
- AC5: A reduction can never make a fee head's Billed amount lower than what has already been paid on it.

## Open-decision note

Only Principal approval is allowed; exact adjustment types must follow signed SRS and Client decisions.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
