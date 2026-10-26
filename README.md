# School Admission & Fee Management Portal

A desktop-browser application for ABC English Medium School, delivered by Intallo as source code and a handover package. It digitizes admissions, year-specific student records, offline fee collection, receipts, and annual Leaving/Transfer Certificate (LC/TC) workflows.

> **Requirements baseline:** Signed BRD v1.4 and SRS v1.4, approved 22 October 2026. Canonical copies are under [`docs/requirements/`](docs/requirements/).
>
> **Data-safety guardrail:** Preserve Git baseline `5e1c47e` and the retained database. M0.4 is strictly read-only. No reset, reseed, migration, schema/data write, `DROP`, `TRUNCATE`, or `DELETE` against the retained database without a separately reviewed and explicitly approved task.
>
> **Architecture status:** The proposed modular-monolith direction and folder map are hypotheses until repository inspection and M1.1 ADR approval. This pack does not claim any particular framework, ORM, provider, API path or schema already exists.

## Start here
1. Read [`SCOPE.md`](SCOPE.md) and [`USER_RULES.md`](USER_RULES.md).
2. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`FILE_STRUCTURE.md`](FILE_STRUCTURE.md), noting that both are proposals pending an audit and ADR.
3. Read [`SETUP.md`](SETUP.md). Runtime-specific commands must be verified against the real repository; do not run unknown scripts against the retained database.
4. Use [`docs/README.md`](docs/README.md) as the documentation index.
5. Use [`docs/features/README.md`](docs/features/README.md) for one Markdown file per signed SRS user story.

## In-scope capabilities
- Login, account lifecycle and server-enforced role/field-level access.
- Academic-year selection and year-scoped records.
- Admission forms, document checklists, status history, Principal decisions and seat capacity.
- Configurable receipt types/fee heads, yearly fee structures and vehicle places.
- Admission without a payment requirement and a variable Admission Fee.
- Offline payments by fee head, precise INR balances, append-only ledger and approved adjustments/reversals.
- Numbered receipts, final fees receipt only after full payment, unnumbered statement available any time, reprint handling.
- Student search/profile and annual LC/TC workflow.
- Audit log, basic dashboard, synthetic demo data, test plan and source handover.

Online payments, parent/student portal, SMS/WhatsApp/email notifications, mobile app, attendance, exams, timetable, promotion and automatic fee carry-forward are out of scope.

## Non-negotiable rules
- Admission does not require payment. The Admission Fee is variable; do not force a payment order or minimum first payment.
- Payments are recorded only; the software does not process money.
- No hard deletes. Corrections use approved auditable adjustment/reversal flows.
- Use exact decimal/numeric INR arithmetic, never binary floating point.
- A final fees receipt is issued only when all applicable fees are fully paid. It includes payer, Cashier and Manager signature lines; Manager means Principal.
- Annual LC/TC issuance does not itself mark a continuing student Left/Transferred.
- No automatic fee balance carry-forward between academic years.
- Sensitive fields/files are restricted server-side. Use fake data in demos/tests; never commit real student records.

## Current status
This is a requirements/engineering documentation pack, not a claim that the application is implemented or the proposed architecture accepted. Recommended sequence: M0.1 baseline verification → M0.2 requirement traceability → M0.4 read-only schema inventory → M0.5 open decisions → M1.1 architecture ADR.

## Responsibilities
- **Intallo:** source code and handover artifacts under the signed engagement.
- **Client:** single contracting/approval point; supplies required forms, letterhead, fee amounts, vehicle place tariffs and approved TC format; owns deployment, hosting, live security, database operation, backups, training and ongoing maintenance.
- **School staff:** intended users of the deployed application; engagement communication routes through the Client.

## Key files
- [PRD](PRD.md)
- [Architecture](ARCHITECTURE.md)
- [Database & Supabase](DATABASE.md)
- [Setup](SETUP.md)
- [Features](docs/features/README.md)
- [Test plan](TEST_PLAN.md)
- [Traceability](TRACEABILITY.md)
- [Open client decisions](OPEN_ITEMS.md)
