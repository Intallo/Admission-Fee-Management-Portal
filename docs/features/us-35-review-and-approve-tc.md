# US-35 — Review and approve TC

- **SRS source:** v1.4, Section 5, Module 9: Leaving / Transfer Certificate
- **Priority in SRS:** P2
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-35 Review and approve TC** (BR-33, BR-36, P2) As an Admission Officer and Principal, I want a two-step approval so that TCs are issued under proper authority.

- AC1: Step 1: the Admission Officer reviews student data and conduct/remarks fields, then forwards or returns the request.
- AC2: Step 2: the Principal approves or rejects with remarks.
- AC3: If dues are pending, the Principal sees a warning and may approve only with an override reason (A-13).
- AC4: Each step stores user, date, and remarks.
- AC5: Several records can be selected and forwarded or approved together, each keeping its own remarks and dues override.

## Open-decision note

TC issuance when dues are pending is a working assumption; obtain written Client/Principal decision.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
