# US-08 — Enter student details

- **SRS source:** v1.4, Section 5, Module 3: New Admission
- **Priority in SRS:** P1
- **Status:** Requirements baseline; implementation status is tracked in Notion/GitHub.
- **Authority:** Signed SRS v1.4 governs.

## User story and acceptance criteria (source text)

**US-08 Enter student details** (BR-05, P1) As an Admission Officer, I want to record the details from the school's admission form so that the admission record is complete.

- AC1: Fields follow the school's form: student name, father's and mother's names, date of birth, gender (Male/Female), religion, sub-caste, blood group, Aadhaar number, caste/income certificate number, bank name, account number and IFSC code, STS number, address with pincode, class to be admitted, and transportation mode (School Bus, Public, Private, Walking).
- AC2: Previous school details: school name, previous class, and the previous school's DISE number (and TC number if any).
- AC3: Age is auto-calculated. A minimum-age warning appears only if the school has configured one (A-09).
- AC4: Required fields are marked, and invalid values (future DOB, non-numeric phone) are rejected with a clear message.
- AC5: The STS number must be unique; a duplicate shows a message naming the existing student.
- AC6: Aadhaar, caste, sub-caste, certificate number, and bank details are visible only to authorized roles (R-06).
- AC7: Religion is optional. No nationality or mother-tongue field is shown, since the school's form does not have them.

## Open-decision note

Confirm open field questions (separate caste/category, parent occupation/income, transport fields and age rules) before finalizing the form.

## Implementation guidance

- Verify dependencies and relevant BRD/SRS IDs before starting.
- Enforce authorization, year scope, audit and integrity rules on the trusted server/service boundary; hiding a UI control is not authorization.
- Add positive, negative and failure/retry tests as relevant. Use synthetic data only.
- Check the logical model against the read-only M0.4 inventory. Do not make schema changes without a separately reviewed and approved migration task.
- Submit PR/artifact links, tests, evidence and an acceptance checklist in the assigned Notion task.
