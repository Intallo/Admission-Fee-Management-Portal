---
schema: ce-unified-plan/v1
title: "Database Schema Migration and Repository Alignment Plan"
status: draft
author: Antigravity
created_at: "2026-11-11"
updated_at: "2026-11-11"
version: "1.0.0"
tags:
  - database
  - postgresql
  - supabase
  - schema-migration
  - admissions
  - students
  - rbac
---

# Database Schema Migration and Repository Alignment Plan

## 1. Context & Problem Statement

During local integration testing of the Admission & Fee Management Portal, navigation to the admissions and student records dashboard pages triggered repeating HTTP `500 Internal Server Error` responses on:
- `GET /api/v1/admissions/applications?`
- `GET /api/v1/students?`

### Root Cause Analysis
1. **Schema Drift Between Migrations and Code**:
   In [`src/infrastructure/repositories/postgres/admissions.repository.ts`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/src/infrastructure/repositories/postgres/admissions.repository.ts#L1565-L1589), the `getAllApplications` query executes:
   ```sql
   select a.*, s.first_name, s.last_name, s.sts_number
   from public.admission_applications a
   join public.students s on s.id = a.student_id
   order by a.created_at desc
   ```
   Similarly, [`src/infrastructure/repositories/postgres/student-records.repository.ts`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/src/infrastructure/repositories/postgres/student-records.repository.ts#L38-L45) queries `s.sts_number`, `s.dise_number`, `s.caste`, `s.transport_opted_in`, and `s.dob`.
2. **Missing Columns in PostgreSQL Schema**:
   The live database schema (defined in `supabase/migrations/20261016182749_init_admission_fee_management_schema.sql` up to `20261107092000_persist_session_revocation.sql`) lacks `sts_number` and several demographic/compatibility columns on `public.students`, `public.admission_applications`, `public.guardians`, and `public.receipts`.
   When PostgreSQL receives these queries, execution halts immediately with:
   `error: column s.sts_number does not exist (SQLSTATE 42703)`.
3. **Applied Migrations Must Remain Immutable**:
   Existing migrations (`20261016182749` through `20261107092000`) have already been applied to local and upstream databases. Per migration hygiene, changes must be encapsulated in a new timestamped forward migration file without altering existing migration scripts.

---

## 2. Goals & Non-Goals

### Goals
- **G1**: Author a non-destructive forward migration `supabase/migrations/20261111100000_align_schema_and_add_sts_number.sql` that adds `sts_number`, format constraint, partial unique index, and all missing repository columns.
- **G2**: Maintain bi-directional compatibility between alternative column naming conventions (`date_of_birth` $\leftrightarrow$ `dob`, `address_line_1` $\leftrightarrow$ `address_line1`, `postal_code` $\leftrightarrow$ `pincode`) via synchronized triggers.
- **G3**: Update `supabase/seed.sql` and run a safe backfill for existing synthetic demo students so that `sts_number` is populated with realistic identifiers (`STS-2026-001` .. `STS-2026-008`).
- **G4**: Verify table-level permissions for `school_app_user`, `authenticated`, `anon`, and `service_role` so no permission errors occur on the new columns.
- **G5**: Validate that `GET /api/v1/admissions/applications` and `GET /api/v1/students` return HTTP `200 OK` against the live PostgreSQL database.

### Non-Goals
- Modifying existing migration files (`20261016182749_init_admission_fee_management_schema.sql` through `20261107092000_persist_session_revocation.sql`).
- Changing DPDP Act security boundaries: Aadhaar numbers and Aadhaar hash values will remain strictly isolated inside `public.student_sensitive_details` with AES encryption.
- Altering existing table primary keys or foreign key relationships.

---

## 3. Architecture & Technical Decisions

### Decision 1: STS Number Location & Format Constraint
- **Placement**: `public.students.sts_number` (per SRS v1.4 US-08, US-30, US-35).
- **Format Constraint**: `check (sts_number is null or sts_number ~ '^[0-9A-Za-z-]{5,20}$')`.
  - Supports 9-digit Karnataka state STS numbers (e.g. `123456789`).
  - Supports standard academic demo prefixes (e.g. `STS-2026-001`).
  - Prevents malformed input, whitespace, and injection payloads.
- **Partial Unique Index**:
  ```sql
  create unique index if not exists students_sts_number_key
    on public.students (sts_number)
    where sts_number is not null;
  ```
  Allows nullable values for newly enrolled applicants prior to state STS allotment while guaranteeing strict uniqueness once allotted.

### Decision 2: Column Synchronization & Backward Compatibility
Several repositories mix PostgreSQL column conventions (e.g. `dob` vs `date_of_birth`, `address_line1` vs `address_line_1`, `pincode` vs `postal_code`).
Rather than risking regressions across unmigrated frontend code or legacy scripts, the migration will:
1. Add columns `dob date`, `address_line1 text`, `address_line2 text`, `pincode text` to `public.students`.
2. Backfill from existing columns (`date_of_birth`, `address_line_1`, `address_line_2`, `postal_code`).
3. Deploy a lightweight `BEFORE INSERT OR UPDATE` trigger on `public.students` to keep both aliases permanently synchronized:
   ```sql
   create or replace function public.sync_student_column_aliases()
   returns trigger language plpgsql as $$
   begin
     new.dob := coalesce(new.dob, new.date_of_birth);
     new.date_of_birth := coalesce(new.date_of_birth, new.dob);
     new.address_line1 := coalesce(new.address_line1, new.address_line_1);
     new.address_line_1 := coalesce(new.address_line_1, new.address_line1);
     new.address_line2 := coalesce(new.address_line2, new.address_line_2);
     new.address_line_2 := coalesce(new.address_line_2, new.address_line2);
     new.pincode := coalesce(new.pincode, new.postal_code);
     new.postal_code := coalesce(new.postal_code, new.pincode);
     return new;
   end;
   $$;
   ```

### Decision 3: Complete Schema Drift Inventory
Based on AST inspection of [`src/infrastructure/repositories/postgres/`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/src/infrastructure/repositories/postgres) against the live database catalog:
| Table | Missing Columns to Add | Type / Constraints | Default Value |
| :--- | :--- | :--- | :--- |
| `public.students` | `sts_number` | `text`, format check, unique index | `null` |
| `public.students` | `dise_number` | `text`, format check | `null` |
| `public.students` | `dob` | `date` | `null` (synced) |
| `public.students` | `nationality` | `text` | `'Indian'` |
| `public.students` | `mother_tongue` | `text` | `'Kannada'` |
| `public.students` | `blood_group` | `text` | `null` |
| `public.students` | `religion` | `text` | `null` |
| `public.students` | `caste` | `text` | `null` |
| `public.students` | `subcaste` | `text` | `null` |
| `public.students` | `category` | `text` | `null` |
| `public.students` | `transport_opted_in` | `boolean not null` | `false` |
| `public.students` | `address_line1` | `text` | `null` (synced) |
| `public.students` | `address_line2` | `text` | `null` (synced) |
| `public.students` | `pincode` | `text` | `null` (synced) |
| `public.admission_applications` | `fee_generated` | `boolean not null` | `false` |
| `public.admission_applications` | `override_missing_documents_reason` | `text` | `null` |
| `public.guardians` | `relationship` | `text` | `null` (synced) |
| `public.guardians` | `annual_income` | `numeric(12, 2)` | `null` |
| `public.admission_status_history` | `created_at` | `timestamptz not null` | `now()` |
| `public.student_fee_assessment_lines` | `is_optional` | `boolean not null` | `false` |
| `public.student_year_certificates` | `certificate_kind` | `text` | `null` |
| `public.student_year_certificates` | `review_status` | `text` | `'pending'` |
| `public.student_year_certificates` | `reviewed_by` | `uuid references public.staff_members(id)` | `null` |
| `public.student_year_certificates` | `reviewed_at` | `timestamptz` | `null` |
| `public.student_year_certificates` | `reprint_count` | `integer not null` | `0` |
| `public.student_year_certificates` | `last_reprinted_at` | `timestamptz` | `null` |
| `public.student_year_certificates` | `conduct` | `text` | `'Good'` |
| `public.student_year_certificates` | `progress` | `text` | `'Satisfactory'` |
| `public.student_year_certificates` | `reason_for_leaving`| `text` | `null` |
| `public.student_year_certificates` | `dues_override_reason` | `text` | `null` |
| `public.certificate_versions` | `snapshot_data` | `jsonb` | `null` |
| `public.certificate_versions` | `issued_at` | `timestamptz` | `null` |
| `public.certificate_versions` | `issued_by` | `uuid references public.staff_members(id)` | `null` |
| `public.certificate_versions` | `created_at` | `timestamptz not null` | `now()` |
| `public.payments` | `category` | `text` | `'tuition'` |
| `public.payments` | `idempotency_key` | `text` | `null` (unique) |
| `public.receipts` | `student_academic_record_id` | `uuid references public.student_academic_records(id)` | `null` |
| `public.staff_members` | `phone` | `text` | `null` |
| `public.sections` | `updated_at` | `timestamptz not null` | `now()` |
| `public.audit_logs` | `before_state` | `jsonb` | `null` |
| `public.audit_logs` | `after_state` | `jsonb` | `null` |

---

## 4. Detailed Work Units

```
[U1: Forward Migration Creation]
       │
       ▼
[U2: Seed Data Alignment & Backfill]
       │
       ▼
[U3: Repository SQL Verification & Alignment]
       │
       ▼
[U4: Migration Execution & End-to-End Live Verification]
```

### Unit 1 (U1): Database Forward Migration Definition
- **Goal**: Create `supabase/migrations/20261111100000_align_schema_and_add_sts_number.sql` encapsulating all missing columns, format checks, unique indexes, and compatibility triggers.
- **Files Modified/Created**:
  - `supabase/migrations/20261111100000_align_schema_and_add_sts_number.sql`
- **Key Implementation Steps**:
  1. Add columns to `public.students`:
     ```sql
     alter table public.students
       add column if not exists sts_number text,
       add column if not exists dise_number text,
       add column if not exists dob date,
       add column if not exists nationality text default 'Indian',
       add column if not exists mother_tongue text default 'Kannada',
       add column if not exists blood_group text,
       add column if not exists religion text,
       add column if not exists caste text,
       add column if not exists subcaste text,
       add column if not exists category text,
       add column if not exists transport_opted_in boolean not null default false,
       add column if not exists address_line1 text,
       add column if not exists address_line2 text,
       add column if not exists pincode text;

     alter table public.students
       drop constraint if exists students_sts_number_format_chk;
     alter table public.students
       add constraint students_sts_number_format_chk
       check (sts_number is null or sts_number ~ '^[0-9A-Za-z-]{5,20}$');

     create unique index if not exists students_sts_number_key
       on public.students (sts_number)
       where sts_number is not null;
     ```
  2. Populate column aliases on `public.students` from existing data:
     ```sql
     update public.students
     set dob = coalesce(dob, date_of_birth),
         address_line1 = coalesce(address_line1, address_line_1),
         address_line2 = coalesce(address_line2, address_line_2),
         pincode = coalesce(pincode, postal_code);
     ```
  3. Deploy bidirectional sync triggers for `students` and `guardians`.
  4. Add missing columns to `admission_applications`, `guardians`, `admission_status_history`, `student_fee_assessment_lines`, `student_year_certificates`, `certificate_versions`, `payments`, `receipts`, `staff_members`, `sections`, and `audit_logs`.
  5. Grant permissions to `school_app_user`, `authenticated`, `anon`, and `service_role`.
- **Verification**:
  - Run SQL syntax validation using PostgreSQL parser / Supabase dry-run.

---

### Unit 2 (U2): Seed Data Alignment & Demo Backfill
- **Goal**: Update `supabase/seed.sql` to include synthetic STS numbers and populate `sts_number` for the 8 seeded demo students.
- **Files Modified**:
  - `supabase/seed.sql`
- **Key Implementation Steps**:
  1. Update student insert statement in `supabase/seed.sql`:
     ```sql
     insert into public.students
     (first_name,last_name,date_of_birth,gender,email,phone,address_line_1,city,state,postal_code,sts_number,dise_number)
     select v.first_name,v.last_name,v.dob::date,v.gender,v.email,v.phone,v.address_line_1,'Bengaluru','Karnataka',v.postal_code,v.sts_number,v.dise_number
     from (values
      ('Aarav','Sharma','2019-10-12','male','aarav.sharma@student-demo.example','9000000101','12 Demo Garden Road','560001','STS-2026-001','DISE-2901-001'),
      ('Aanya','Rao','2019-06-03','female','aanya.rao@student-demo.example','9000000102','24 Sample Lake View','560002','STS-2026-002','DISE-2901-002'),
      ('Rohan','Iyer','2015-09-23','male','rohan.iyer@student-demo.example','9000000103','8 Fictional Park Lane','560003','STS-2026-003','DISE-2901-003'),
      ('Anika','Kulkarni','2012-11-14','female','anika.kulkarni@student-demo.example','9000000104','19 Mock Residency','560004','STS-2026-004','DISE-2901-004'),
      ('Vihaan','Desai','2021-02-02','male','vihaan.desai@student-demo.example','9000000105','6 Example Cross','560005','STS-2026-005','DISE-2901-005'),
      ('Myra','Shetty','2020-02-02','female','myra.shetty@student-demo.example','9000000106','31 Demo Circle','560006','STS-2026-006','DISE-2901-006'),
      ('Ishaan','Verma','2018-05-17','male','ishaan.verma@student-demo.example','9000000107','14 Placeholder Street','560007','STS-2026-007','DISE-2901-007'),
      ('Kiara','Joshi','2019-03-03','female','kiara.joshi@student-demo.example','9000000108','3 Sample Orchid Road','560008','STS-2026-008','DISE-2901-008')
     ) as v(first_name,last_name,dob,gender,email,phone,address_line_1,postal_code,sts_number,dise_number)
     ...
     ```
  2. Include an idempotent backfill in the migration so that currently running local databases immediately gain demo STS numbers without requiring a destructive `db reset`:
     ```sql
     update public.students set sts_number = 'STS-2026-001', dise_number = 'DISE-2901-001' where email = 'aarav.sharma@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-002', dise_number = 'DISE-2901-002' where email = 'aanya.rao@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-003', dise_number = 'DISE-2901-003' where email = 'rohan.iyer@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-004', dise_number = 'DISE-2901-004' where email = 'anika.kulkarni@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-005', dise_number = 'DISE-2901-005' where email = 'vihaan.desai@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-006', dise_number = 'DISE-2901-006' where email = 'myra.shetty@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-007', dise_number = 'DISE-2901-007' where email = 'ishaan.verma@student-demo.example' and sts_number is null;
     update public.students set sts_number = 'STS-2026-008', dise_number = 'DISE-2901-008' where email = 'kiara.joshi@student-demo.example' and sts_number is null;
     ```
- **Verification**:
  - Query `select id, first_name, sts_number, dise_number from public.students` and verify all seeded records have assigned STS numbers.

---

### Unit 3 (U3): Repository SQL Verification & Alignment
- **Goal**: Review and harden repository SQL statements in [`admissions.repository.ts`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/src/infrastructure/repositories/postgres/admissions.repository.ts) and [`student-records.repository.ts`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/src/infrastructure/repositories/postgres/student-records.repository.ts) to ensure robustness and null-safety.
- **Files Modified**:
  - `src/infrastructure/repositories/postgres/admissions.repository.ts`
  - `src/infrastructure/repositories/postgres/student-records.repository.ts`
- **Key Implementation Steps**:
  1. Verify `getAllApplications` mapping in `admissions.repository.ts`:
     - Ensure `s.sts_number` and `a.fee_generated` are safely mapped when null.
  2. Verify search queries in `student-records.repository.ts`:
     - Ensure `lower(coalesce(s.sts_number, ''))` correctly matches student lookup queries.
- **Verification**:
  - Run existing test suites `tests/phase8_3_6_admissions_persistence.test.ts` and `tests/admissions_api_routes.test.ts`.

---

### Unit 4 (U4): Migration Execution & End-to-End Live Verification
- **Goal**: Apply the migration to the running PostgreSQL database via Supabase CLI and verify live API endpoints.
- **Execution Steps**:
  1. Run `npx supabase migration up` (with `BypassSandbox: true`).
  2. Verify migration status via `npx supabase migration list`.
  3. Execute live database query script against `127.0.0.1:54322` to verify columns in `information_schema.columns`.
  4. Execute HTTP probe tests against:
     - `GET /api/v1/admissions/applications`
     - `GET /api/v1/students`
     - `GET /api/v1/dashboard/metrics`
  5. Run Vitest suite:
     - `npx vitest run tests/admissions_api_routes.test.ts`
     - `npx vitest run tests/student_and_certificates_api_routes.test.ts`
     - `npx vitest run tests/phase8_3_6_admissions_persistence.test.ts`
     - `npx vitest run tests/phase8_3_7_student_records_production.test.ts`

---

## 5. Migration & Rollback Strategy

### Rollback Strategy
If any constraint violation or unexpected conflict occurs during migration:
1. Provide corresponding down migration script:
   `supabase/migrations/20261111100000_align_schema_and_add_sts_number.down.sql`
   ```sql
   drop trigger if exists trg_sync_student_column_aliases on public.students;
   drop function if exists public.sync_student_column_aliases();
   drop index if exists public.students_sts_number_key;
   alter table public.students drop constraint if exists students_sts_number_format_chk;
   alter table public.students
     drop column if exists sts_number,
     drop column if exists dise_number,
     drop column if exists dob,
     drop column if exists nationality,
     drop column if exists mother_tongue,
     drop column if exists blood_group,
     drop column if exists religion,
     drop column if exists caste,
     drop column if exists subcaste,
     drop column if exists category,
     drop column if exists transport_opted_in,
     drop column if exists address_line1,
     drop column if exists address_line2,
     drop column if exists pincode;
   ```
2. Because all additions in the forward migration use `ADD COLUMN IF NOT EXISTS` and `ON CONFLICT DO NOTHING`, applying the migration is completely idempotent and safe against multiple runs.

---

## 6. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Existing non-conforming STS values in DB fail format check | Migration fails to apply | Format check constraint is added with a regex `^[0-9A-Za-z-]{5,20}$` that accommodates Karnataka 9-digit integers, demo codes, and allows `NULL`. |
| Concurrent writes during migration | Row lock contention | `ALTER TABLE ... ADD COLUMN` without heavy locks in Postgres 15/16 executes in milliseconds without table rewrites when default values are constants. |
| Duplicate STS numbers among existing records | Unique index creation fails | Existing students currently have null STS numbers; seeded demo students receive uniquely partitioned numbers (`STS-2026-001` .. `STS-2026-008`). |
| DPDP Act compliance violation | Regulatory risk | Aadhaar numbers, biometric data, and income details remain strictly stored in `student_sensitive_details` with encryption; only public demographic columns are added to `students`. |

---

## 7. Verification Plan & Test Matrix

### Verification Matrix
- [ ] Migration applied cleanly: `npx supabase migration up` returns code 0.
- [ ] Column presence: `sts_number`, `dob`, `fee_generated`, etc. present in `information_schema.columns`.
- [ ] STS format constraint check: Inserting invalid STS like `'abc'` or strings over 20 chars fails with check constraint violation.
- [ ] Partial unique index check: Inserting two identical non-null STS numbers fails with unique constraint violation; multiple NULLs succeed.
- [ ] API integration:
  - `GET /api/v1/admissions/applications` returns 200 with list of applications including student details and `stsNumber`.
  - `GET /api/v1/students` returns 200 with student records.
- [ ] Automated regression tests:
  - `npx vitest run tests/admissions_api_routes.test.ts`
  - `npx vitest run tests/student_and_certificates_api_routes.test.ts`
  - `npx vitest run tests/phase8_3_6_admissions_persistence.test.ts`
  - `npx vitest run tests/phase8_3_7_student_records_production.test.ts`
  - `npx vitest run tests/rbac_enforcement.test.ts`
