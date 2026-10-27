# Solo Owner Setup Checklist

## Before implementation

- [ ] Confirm repository URL, default branch, current HEAD and `git status --short`.
- [ ] Verify baseline commit `5e1c47e` is present without checkout/reset/clean operations.
- [ ] Read signed BRD v1.4 and SRS v1.4.
- [ ] Inspect migrations, seed and SQL tests without executing writes against the retained database.
- [ ] Confirm whether the actual application package/runtime is in another branch/repository; do not guess framework or entry points.
- [ ] Check `.env.example` and tracked files only; never echo or commit `.env`, database passwords, service-role keys or personal data.
- [ ] Record architecture/security/role uncertainties in the canonical Decision & Risk Register.

## For every task

- [ ] Verify dependencies and Database Impact.
- [ ] Complete implementation in a focused branch.
- [ ] Run relevant automated checks using isolated data/environments.
- [ ] Perform documented self-review against all acceptance criteria.
- [ ] Update Notion with actual status, PR/commit, test evidence and known limitations.
- [ ] Keep Reviewer `Unassigned`; do not claim independent peer approval.
- [ ] Obtain any required Client/Principal sign-off separately.

## Non-negotiable safety

- M0.4 remains read-only.
- No retained database reset, reseed, migration or write without a separate reviewed and explicitly approved task.
- No hard deletes, no automatic academic-year fee carry-forward, and no payment prerequisite for admission.
- Use exact decimal/numeric INR arithmetic, never binary floating point for money.
- A final fee receipt is issued only when applicable fees are fully paid and includes Payer/Cashier/Manager (Principal) signature lines.
- LC/TC issuance must not by itself mark the student Left/Transferred.
