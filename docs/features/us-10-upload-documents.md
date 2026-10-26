# US-10 — Upload documents

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-10 Upload documents** (BR-07, P1) As an Admission Officer, I want to attach the required proofs so that each application has verified documents.

- AC1: Document types: DOB proof, Aadhaar, caste certificate, income certificate, passport photo, previous school documents, signed admission form (scan), and others from the configurable list.
- AC2: Only PDF, JPG, PNG up to 5 MB are accepted (A-16); others are rejected with a message.
- AC3: A file can be replaced; the earlier file is kept as a previous version, not removed (R-01).
- AC4: Each upload stores the uploader and date.
- AC5: Files can be previewed and downloaded only by authorized roles.
- AC6: The folder where files are stored is set in the configuration and documented in the setup guide.

## Open-decision note

Document requirements per section remain open; PDF/JPG/PNG up to 5 MB is an SRS working assumption.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
