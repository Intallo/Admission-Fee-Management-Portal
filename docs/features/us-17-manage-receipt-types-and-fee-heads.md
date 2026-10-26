# US-17 — Manage receipt types and fee heads

- **SRS source:** v1.4, Section 5, Module 4: Receipt Types, Fee Heads, and Fee Structure
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-17 Manage receipt types and fee heads** (BR-14, BR-41, BR-42, P1) As the Accounts Officer or Principal, I want to maintain the school's receipt types and fee heads in the application so that new forms and fees can be added without changing the software.

- AC1: The starting receipt types are Fees, Books, and Vehicle, and the starting fee heads are those on the school's receipts (BR-42).
- AC2: I can add a receipt type, rename it, and set its print title (for example "Books Receipt").
- AC3: Each fee head belongs to exactly one receipt type, and has a type: **Fixed** (price from the fee structure) or **Variable** (no fixed price; the amount paid is billed).
- AC4: Exactly one head is marked as the Admission Fee, and it is Variable. Each receipt type's Misc. head is Variable.
- AC5: The receipt type for the vehicle is marked "school vehicle only".
- AC6: Heads and types can be deactivated, never deleted (R-01). A head already billed keeps its history.

## Open-decision note

Exact receipt catalog and the meaning of “admin” for fee-data maintenance remain open.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
