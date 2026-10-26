# US-03 — Sensitive data protection

- **SRS source:** v1.4, Section 5, Module 1: Authentication and Access Control
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-03 Sensitive data protection** (BR-04, P1) As the Principal, I want Aadhaar, caste, sub-caste, income, certificate number, and bank details hidden from unauthorized roles so that student privacy is protected.

- AC1: ACC and SYSADMIN users see none of these fields anywhere, including search results, receipts, and exports.
- AC2: Sensitive document files return "Access denied" to ACC and SYSADMIN even with a direct link.
- AC3: Every view of a sensitive field by an authorized user is written to the audit log.
- AC4: Aadhaar and bank account numbers are stored encrypted by the application and never appear in the audit log.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
