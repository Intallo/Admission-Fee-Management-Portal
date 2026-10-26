# US-26A — Refund or payment correction

- **SRS source:** v1.4, Section 5, Module 6: Concessions, Negotiation, Refunds, and Exceptions
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-26A Refund or payment correction** (BR-22, BR-23, P2) As an Accounts Officer, I want to request a refund or reversal of a wrong entry so that mistakes are corrected without erasing history.

- AC1: The request links to the original payment and states the reason and amount.
- AC2: Only the Principal can approve it.
- AC3: On approval, a new reversal/refund entry is added for the fee heads concerned, the balances are recalculated, and the original payment remains untouched (R-19).
- AC4: Rejected requests are kept with their remarks.
- AC5: Whether the Admission Fee is refundable is a school policy still to be confirmed (BRD Section 16.2).

## Open-decision note

Admission Fee refund policy and correction details are open; do not invent policy.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
