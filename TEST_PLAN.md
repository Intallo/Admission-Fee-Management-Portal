# Test Strategy and Quality Plan

## Objectives
Verify signed acceptance criteria and protect privacy, audit, exact ledgers, atomic writes, sequence uniqueness, immutable history and year isolation. Use synthetic fixtures and isolated databases only.

## Unit tests
Validation, state transitions, seat calculations after approved policy, decimal arithmetic/rounding, head-level balance/status, amount in words, final receipt eligibility, number format, permission predicates, file validation and log redaction.

## Integration tests
Authentication/service authorization; constraints and no-cascade behavior; atomic payment + lines + sequence/receipt; adjustments/reversals and balance recalculation; admission/number assignment; private document access; audit events; issued snapshots; year isolation. Write-based tests run only against disposable test DB.

## E2E flows
- Login and role-specific navigation.
- Draft admission → documents → submit → Principal decision → Admitted + admission number, without any payment.
- No fee structure: admission completes and appears on “Fee not generated”.
- Fee heads/receipt types; variable Admission Fee; offline payments and fixed-head overpayment rejection.
- Partial balance blocks final receipt; full payment allows final receipt with component numbers/signature lines.
- Statement any time, unnumbered; DUPLICATE reprints audited.
- Principal-approved adjustment/reversal preserves original history and recalculates balance.
- Annual LC/TC, two-step approval, retrieve/reprint and no status side effect.
- Cross-role/year/record/document and denied access tests.

## Manual UI/print
Latest Chrome on Windows; 1366px+ baseline; keyboard/focus/error states; long names/addresses; approved admission/receipt forms and A4/A5 PDFs; amounts in words; signature areas and duplicate labels. Client verifies printer alignment in its environment.

## Non-functional
Performance target: common screens <3s for 2,000 students/year and 10 years demo data. Security: role/field matrix, direct APIs/downloads/exports. Reliability: atomic payment, retry/double-submit, sequence uniqueness. Integrity: no DELETE core-table privilege, no UPDATE privilege for ledger/receipts/audit, no cascade delete. Handover: clean-machine setup works and no hard-coded secrets/server addresses.

## Evidence
Record exact command, tool/runtime version, safe environment, pass/fail, CI link, failure/gap and synthetic fixture. Do not claim tests were run if not executed.

## Release blockers
Critical privacy/auth/data loss, inaccurate ledger, duplicate receipt number, incorrect final receipt eligibility, unauthorized Principal decision or certificate-driven status mutation blocks release unless explicitly accepted in writing by authorized Client; such acceptance does not silently change signed scope.
