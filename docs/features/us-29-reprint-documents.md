# US-29 — Reprint documents

- **SRS source:** v1.4, Section 5, Module 7: Receipts
- **Priority in SRS:** P3
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-29 Reprint documents** (BR-27, P3) As an Accounts Officer, I want to reprint a receipt, the final fees receipt, or a statement so that parents can get copies.

- AC1: Reprints carry the label "DUPLICATE", and the reprint date and user are logged.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
