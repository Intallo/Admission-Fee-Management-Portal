# Admission & Fee Management Portal â€” Database

Supabase/PostgreSQL schema, migrations, synthetic demonstration data, and generated TypeScript types for the School Admission & Fee Management Portal.

## Project safety

- Only synthetic demo records are included. Never add real student records or private school documents to seed files, screenshots, or tests.
- The schema is designed for staff-only application use. RLS is enabled across public tables and **no browser-facing policies are created yet**. Keep it fail-closed until Supabase Auth and the approved staff-role/field-level authorization matrix are implemented.
- Never put a Supabase `service_role` secret in frontend code, a `NEXT_PUBLIC_*` variable, or Git.
- Fee and transport values in the seed are illustrative and must be replaced with school-approved values before production.
- Current open decisions include admission-number uniqueness scope, pre-admission fee-head restriction, seat-hold period, and final client approvals for receipt/certificate/document requirements.

## Directory layout

```text
supabase/
  config.toml
  migrations/
    20261016182749_init_admission_fee_management_schema.sql
    20261016183014_enforce_financial_integrity_and_indexes.sql
  seed.sql
src/
  types/
    database.types.ts
.env.example
.gitignore
README.md
```

The database and seed have already been applied to the configured Supabase project by the project owner. These files are the source-controlled baseline for repeatable setup and further development. Always compare migration history with the remote database before applying any migration to a shared project.

## Prerequisites

- Git
- Supabase CLI compatible with PostgreSQL 17
- Docker Desktop for a local Supabase stack
- Node.js only when running the application (the database files themselves are SQL)

Verify the CLI using `supabase --version` and discover supported options with `supabase --help`.

## Local setup

1. Copy `.env.example` to the application-specific local environment file and fill in only the required local/public values.
2. Start local Supabase: `supabase start`.
3. Apply migrations and load the synthetic demo seed into the **local database only**: `supabase db reset`.
4. Check current local migration status: `supabase migration list --local`.
5. Generate TypeScript database definitions when the schema changes (see below).

**Warning:** `supabase db reset` is destructive to the local Supabase database. Confirm that the CLI is linked/running locally and never use reset commands against a shared or production database.

## Remote project

Project reference: `fjrfyzamiirqzitdchkz`
Project dashboard: https://supabase.com/dashboard/project/fjrfyzamiirqzitdchkz

Before remote migration operations:

1. Authenticate the Supabase CLI and verify the selected project reference.
2. Run `supabase link --project-ref fjrfyzamiirqzitdchkz` if the local project is not already linked.
3. Compare local migration files with remote migration history using `supabase migration list`.
4. Do not reapply the initial migrations blindly; the schema and seed were applied to the hosted project before this repository baseline was created.
5. Review the SQL and take an appropriate backup before any production change.

## TypeScript database types

The generated file at `src/types/database.types.ts` is derived from the current Supabase schema. Regenerate after schema changes using the version-appropriate command, for example:

```bash
supabase gen types typescript --project-id fjrfyzamiirqzitdchkz --schema public > src/types/database.types.ts
```

This command needs an authenticated Supabase CLI session and a reachable project.

## Applying future database changes

- Create migration files with the CLI: `supabase migration new <descriptive_name>`.
- Review the generated SQL. Avoid mixing data changes with structural migrations unless the backfill must be atomic with the schema change.
- Test against a clean local database and, where applicable, a database restored from a recent backup.
- Verify foreign keys, constraints, RLS, grants, and transaction/ledger invariants.
- Run relevant integration tests and the Supabase security advisors before release.
- Use the current Supabase CLI documentation for exact commands. Do not use a production reset or casually delete financial history.

## Important schema behavior

- School year: June 1 to May 31.
- Class mapping: Nursery/LKG/UKG; Standards 1â€“7; Standards 8â€“10.
- Payment model: offline payments allocated to fee assessment lines in INR.
- Financial records are intended to be append-only. Correct errors with auditable adjustments/reversals.
- Each individual receipt is a summary of one recorded payment. A consolidated receipt references existing individual receipts and must never be counted as a new payment.
- Document files belong in private object storage. PostgreSQL stores only protected metadata/object keys.
- Seeded demo staff profiles are directory rows, not Supabase Auth users; no passwords or live accounts are created.

## Seed data

`supabase/seed.sql` is designed to be rerunnable using stable synthetic identifiers. It includes demo staff profiles, academic years, grade levels, sections, fictional students/guardians/admission states, fee structures, payment allocations, receipts, adjustments, and sample annual certificates. It does not upload fake files into Storage.
