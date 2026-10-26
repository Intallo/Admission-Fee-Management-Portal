# Proposed File Structure

> **PROPOSAL ONLY.** Do not reorganize existing files to match this map until repository audit and ADR acceptance. Current GitHub access to CampusHR returned 404, so the actual repository tree has not been verified.

```text
repository-root/
├── README.md / PRD.md / ARCHITECTURE.md
├── SCOPE.md / USER_RULES.md / UI_UX.md / WEB_UX.md
├── DESIGN_SYSTEM.md / SETUP.md / FILE_STRUCTURE.md / CONTRIBUTING.md
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
├── src/                         # proposed logical root only
│   ├── app/                     # bootstrap, route composition, shell
│   ├── shared/                  # UI primitives, validation, errors, log redaction
│   ├── modules/
│   │   ├── identity-access/
│   │   ├── academic-years/
│   │   ├── school-settings/
│   │   ├── admissions/
│   │   ├── student-records/
│   │   ├── fee-configuration/
│   │   ├── fees-ledger/
│   │   ├── receipts/
│   │   ├── documents/
│   │   ├── certificates-lctc/
│   │   └── audit-reporting/
│   ├── server/                  # one approved API/server boundary
│   └── infrastructure/          # adapter(s) for the actual approved provider
├── database/                    # only if it fits existing conventions
│   ├── migrations/              # separately reviewed/approved
│   ├── reference-data/
│   ├── seed-synthetic/
│   └── verification/
├── storage/                     # configurable and outside public web root
├── tests/ unit/ integration/ authorization/ e2e/
└── docs/
    ├── requirements/
    ├── features/
    ├── diagrams/
    ├── adr/
    └── templates/
```

## Ownership boundaries
- `identity-access`: authentication integration, accepted role matrix and permission guards.
- `admissions`: admission workflow and Principal decision.
- `student-records`: profile and explicit lifecycle status.
- `fee-configuration`: receipt types, fee heads, annual structure and vehicle place/tariff policy.
- `fees-ledger`: payment transactions, lines, balances, adjustments and reversals.
- `receipts`: receipt eligibility/numbering/snapshot/reprint.
- `certificates-lctc`: annual certificate lifecycle and snapshots.
- `documents`: private-file rules, versioning and authorized delivery.
- `audit-reporting`: audit reads and approved report projections.

## M0/M1 verification
Inventory the actual runtime, entry points, routes/API path, auth, persistence adapters, environment files, migration history, test commands, PDF/storage libraries and CI scripts. Label current vs proposed items explicitly. M0.4 must not write to the retained DB.
