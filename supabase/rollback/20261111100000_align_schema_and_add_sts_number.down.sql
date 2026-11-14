-- Migration Down: 20261111100000_align_schema_and_add_sts_number.down.sql
-- Purpose: Rollback schema alignment changes.

begin;

drop trigger if exists trg_sync_audit_log_aliases on public.audit_logs;
drop function if exists public.sync_audit_log_aliases();

drop trigger if exists trg_sync_guardian_column_aliases on public.guardians;
drop function if exists public.sync_guardian_column_aliases();

drop trigger if exists trg_sync_student_column_aliases on public.students;
drop function if exists public.sync_student_column_aliases();

drop index if exists public.payments_idempotency_key_idx;
drop index if exists public.students_dise_number_idx;
drop index if exists public.students_sts_number_key;

alter table public.students drop constraint if exists students_dise_number_format_chk;
alter table public.students drop constraint if exists students_sts_number_format_chk;

alter table public.audit_logs
  drop column if exists before_state,
  drop column if exists after_state;

alter table public.sections
  drop column if exists updated_at;

alter table public.staff_members
  drop column if exists phone;

alter table public.receipts
  drop column if exists student_academic_record_id;

alter table public.payments
  drop column if exists category,
  drop column if exists idempotency_key;

alter table public.certificate_versions
  drop column if exists snapshot_data,
  drop column if exists issued_at,
  drop column if exists issued_by,
  drop column if exists created_at;

alter table public.student_year_certificates
  drop column if exists certificate_kind,
  drop column if exists review_status,
  drop column if exists reviewed_by,
  drop column if exists reviewed_at,
  drop column if exists reprint_count,
  drop column if exists last_reprinted_at,
  drop column if exists conduct,
  drop column if exists progress,
  drop column if exists reason_for_leaving,
  drop column if exists dues_override_reason;

alter table public.student_fee_assessment_lines
  drop column if exists is_optional;

alter table public.admission_status_history
  drop column if exists created_at;

alter table public.guardians
  drop column if exists relationship,
  drop column if exists annual_income;

alter table public.admission_applications
  drop column if exists fee_generated,
  drop column if exists override_missing_documents_reason;

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

commit;
