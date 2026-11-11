-- Migration: 20261111100000_align_schema_and_add_sts_number.sql
-- Purpose: Add sts_number, dise_number, demographic fields, compatibility aliases,
-- and missing columns across admission_applications, guardians, payments, receipts,
-- certificates, sections, and audit_logs to resolve schema drift.

begin;

-- ============================================================================
-- 1. public.students: STS Number, DISE Number, Demographics & Aliases
-- ============================================================================

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

-- Format constraints on students
alter table public.students
  drop constraint if exists students_sts_number_format_chk;
alter table public.students
  add constraint students_sts_number_format_chk
  check (sts_number is null or sts_number ~ '^[0-9A-Za-z-]{5,20}$');

alter table public.students
  drop constraint if exists students_dise_number_format_chk;
alter table public.students
  add constraint students_dise_number_format_chk
  check (dise_number is null or dise_number ~ '^[0-9A-Za-z-]{5,20}$');

create unique index if not exists students_sts_number_key
  on public.students (sts_number)
  where sts_number is not null;

create index if not exists students_dise_number_idx
  on public.students (dise_number)
  where dise_number is not null;

-- Synchronize existing student column data
update public.students
set dob = coalesce(dob, date_of_birth),
    address_line1 = coalesce(address_line1, address_line_1),
    address_line2 = coalesce(address_line2, address_line_2),
    pincode = coalesce(pincode, postal_code);

-- Bi-directional synchronization trigger for student column aliases
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

drop trigger if exists trg_sync_student_column_aliases on public.students;
create trigger trg_sync_student_column_aliases
  before insert or update on public.students
  for each row execute function public.sync_student_column_aliases();


-- ============================================================================
-- 2. public.admission_applications: fee_generated & override reason
-- ============================================================================

alter table public.admission_applications
  add column if not exists fee_generated boolean not null default false,
  add column if not exists override_missing_documents_reason text;


-- ============================================================================
-- 3. public.guardians: relationship alias & annual_income
-- ============================================================================

alter table public.guardians
  add column if not exists relationship text,
  add column if not exists annual_income numeric(12, 2);

update public.guardians
set relationship = coalesce(relationship, relationship_to_student);

create or replace function public.sync_guardian_column_aliases()
returns trigger language plpgsql as $$
begin
  new.relationship := coalesce(new.relationship, new.relationship_to_student);
  new.relationship_to_student := coalesce(new.relationship_to_student, new.relationship);
  return new;
end;
$$;

drop trigger if exists trg_sync_guardian_column_aliases on public.guardians;
create trigger trg_sync_guardian_column_aliases
  before insert or update on public.guardians
  for each row execute function public.sync_guardian_column_aliases();


-- ============================================================================
-- 4. public.admission_status_history: created_at timestamp
-- ============================================================================

alter table public.admission_status_history
  add column if not exists created_at timestamptz not null default now();

update public.admission_status_history
set created_at = coalesce(created_at, changed_at);


-- ============================================================================
-- 5. public.student_fee_assessment_lines: is_optional flag
-- ============================================================================

alter table public.student_fee_assessment_lines
  add column if not exists is_optional boolean not null default false;


-- ============================================================================
-- 6. public.student_year_certificates & certificate_versions
-- ============================================================================

alter table public.student_year_certificates
  add column if not exists certificate_kind text,
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_by uuid references public.staff_members(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reprint_count integer not null default 0,
  add column if not exists last_reprinted_at timestamptz,
  add column if not exists conduct text default 'Good',
  add column if not exists progress text default 'Satisfactory',
  add column if not exists reason_for_leaving text,
  add column if not exists dues_override_reason text;

update public.student_year_certificates
set certificate_kind = coalesce(certificate_kind, certificate_type::text);

alter table public.certificate_versions
  add column if not exists snapshot_data jsonb,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references public.staff_members(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.certificate_versions
  alter column content_snapshot drop not null,
  alter column template_version set default '1.0';

create or replace function public.sync_certificate_version_aliases()
returns trigger language plpgsql as $$
begin
  new.content_snapshot := coalesce(new.content_snapshot, new.snapshot_data, '{}'::jsonb);
  new.snapshot_data := coalesce(new.snapshot_data, new.content_snapshot);
  new.template_version := coalesce(new.template_version, '1.0');
  new.generated_by := coalesce(new.generated_by, new.issued_by);
  new.issued_by := coalesce(new.issued_by, new.generated_by);
  new.generated_at := coalesce(new.generated_at, new.issued_at, now());
  new.issued_at := coalesce(new.issued_at, new.generated_at);
  return new;
end;
$$;

drop trigger if exists trg_sync_certificate_version_aliases on public.certificate_versions;
create trigger trg_sync_certificate_version_aliases
  before insert on public.certificate_versions
  for each row execute function public.sync_certificate_version_aliases();


-- ============================================================================
-- 7. public.payments & receipts
-- ============================================================================

alter table public.payments
  add column if not exists category text default 'tuition',
  add column if not exists idempotency_key text;

create unique index if not exists payments_idempotency_key_idx
  on public.payments (idempotency_key)
  where idempotency_key is not null;

alter table public.receipts
  add column if not exists student_academic_record_id uuid references public.student_academic_records(id) on delete restrict;

update public.receipts r
set student_academic_record_id = p.student_academic_record_id
from public.payments p
where r.payment_id = p.id and r.student_academic_record_id is null;


-- ============================================================================
-- 8. public.staff_members & sections & audit_logs
-- ============================================================================

alter table public.staff_members
  add column if not exists phone text;

alter table public.sections
  add column if not exists updated_at timestamptz not null default now();

alter table public.audit_logs
  add column if not exists before_state jsonb,
  add column if not exists after_state jsonb;

create or replace function public.sync_audit_log_aliases()
returns trigger language plpgsql as $$
begin
  new.before_state := coalesce(new.before_state, new.before_snapshot);
  new.before_snapshot := coalesce(new.before_snapshot, new.before_state);
  new.after_state := coalesce(new.after_state, new.after_snapshot);
  new.after_snapshot := coalesce(new.after_snapshot, new.after_state);
  return new;
end;
$$;

drop trigger if exists trg_sync_audit_log_aliases on public.audit_logs;
create trigger trg_sync_audit_log_aliases
  before insert on public.audit_logs
  for each row execute function public.sync_audit_log_aliases();


-- ============================================================================
-- 9. Permissions & Grants
-- ============================================================================

grant select, insert, update on all tables in schema public to authenticated, anon, service_role, school_app_user;
grant usage, select on all sequences in schema public to authenticated, anon, service_role, school_app_user;


-- ============================================================================
-- 10. Synthetic Demo Students STS & DISE Number Backfill
-- ============================================================================

update public.students set sts_number = 'STS-2026-001', dise_number = 'DISE-2901-001' where email = 'aarav.sharma@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-002', dise_number = 'DISE-2901-002' where email = 'aanya.rao@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-003', dise_number = 'DISE-2901-003' where email = 'rohan.iyer@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-004', dise_number = 'DISE-2901-004' where email = 'anika.kulkarni@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-005', dise_number = 'DISE-2901-005' where email = 'vihaan.desai@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-006', dise_number = 'DISE-2901-006' where email = 'myra.shetty@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-007', dise_number = 'DISE-2901-007' where email = 'ishaan.verma@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-008', dise_number = 'DISE-2901-008' where email = 'kiara.joshi@student-demo.example' and sts_number is null;
update public.students set sts_number = 'STS-2026-009', dise_number = 'DISE-2901-009' where email = 'nikhil.bhat@student-demo.example' and sts_number is null;

commit;
