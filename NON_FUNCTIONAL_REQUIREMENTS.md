# Non-Functional Requirements

This list follows SRS v1.4 Section 8. Actual testing evidence must be linked before marking release accepted.

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Security | Password hashing; server-side role checks on every protected request; operate correctly behind HTTPS. Client sets up certificate/server. |
| NFR-02 | File security | Uploaded files stored in configurable folder outside public web path, served only after authorization. |
| NFR-03 | Privacy | Sensitive fields restricted by role, encrypted where stored, and access logged. |
| NFR-04 | Performance | Common screens under 3 sec with 2,000 students/year and 10 years of data in demo environment; production depends on Client hosting. |
| NFR-05 | Reliability | Payment save is atomic: payment, lines, variable-head billing where relevant, receipt sequence and related admission-number assignment where specified save together or none do. |
| NFR-06 | Auditability | Audit create/update/status/approval and sensitive views as specified. |
| NFR-07 | Usability | Keyboard-friendly forms, clear plain-English errors, paper-aligned payment entry. |
| NFR-08 | Compatibility | Latest Chrome on Windows; Client checks physical printer output. |
| NFR-09 | Data safety | No-delete/append-only enforced in app and database scripts; restricted app role privileges. |
| NFR-10 | Maintainability | Version control, documented setup, configurable numbering/document list/receipt types/fee heads/places/seat limits. |
| NFR-11 | Accuracy | Exact decimal money, head balances and amount-in-words automated tests. |
| NFR-12 | Portability | Environment configuration; no hard-coded server addresses/passwords. |

## Verification
Every NFR needs a test/evidence link, tested environment description and pass/fail. A general claim that “the app is secure/fast” is not sufficient.
