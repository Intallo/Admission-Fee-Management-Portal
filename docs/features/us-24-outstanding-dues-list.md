# US-24 — Outstanding dues list

- **SRS source:** v1.4, Section 5, Module 5: Student Fee and Payments
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-24 Outstanding dues list** (BR-19, BR-39, P2) As an Accounts Officer or Principal, I want a list of students with outstanding dues for the selected year so that I can follow up.

- AC1: Filters by standard, status, receipt type, and year.
- AC2: The list shows student name, class, net payable, paid, balance, and last payment date.
- AC3: The list can be printed or exported. Sensitive fields are never included.
- AC4: The list covers only the selected year; balances are not combined across years.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
