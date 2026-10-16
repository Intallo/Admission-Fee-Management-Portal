-- School Admission & Fee Management Portal — initial PostgreSQL schema
-- RLS is enabled with no browser-facing policies until approved staff permissions
-- and Supabase Auth integration are implemented.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.staff_role as enum
  ('system_admin', 'principal', 'admission_officer', 'clerk', 'accountant', 'read_only');
create type public.academic_year_state as enum ('planning', 'current', 'closed');
create type public.grade_group as enum ('pre_primary', 'primary', 'high_school');
create type public.student_year_status as enum ('admitted', 'active', 'left', 'transferred', 'withdrawn');
create type public.admission_application_status as enum
  ('draft', 'submitted', 'under_review', 'on_hold', 'approved', 'rejected', 'withdrawn');
create type public.document_verification_status as enum ('pending', 'verified', 'rejected', 'replaced');
create type public.fee_category as enum ('school_fee', 'vehicle', 'books');
create type public.fee_structure_state as enum ('draft', 'pending_approval', 'approved', 'retired');
create type public.assessment_state as enum ('draft', 'issued', 'cancelled');
create type public.payment_method as enum ('cash', 'cheque', 'bank_transfer', 'upi_manual', 'other');
create type public.payment_kind as enum ('collection', 'refund', 'reversal');
create type public.adjustment_kind as enum ('concession', 'additional_charge', 'correction');
create type public.approval_state as enum ('pending', 'approved', 'rejected');
create type public.certificate_kind as enum ('LC', 'TC');
create type public.certificate_state as enum ('draft', 'issued', 'cancelled');
create type public.transport_mode as enum ('school_bus', 'private_vehicle');

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role public.staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.staff_members is
  'Staff role directory. Authentication is managed by Supabase Auth; never trust user-editable metadata for authorization. Seeded demo staff are not login accounts.';

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  status public.academic_year_state not null default 'planning',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date < end_date),
  check (extract(month from start_date) = 6 and extract(day from start_date) = 1),
  check (extract(month from end_date) = 5 and extract(day from end_date) = 31)
);
create unique index academic_years_single_current_idx
  on public.academic_years ((status))
  where status = 'current';

create table public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  group_name public.grade_group not null,
  sort_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  name text not null,
  max_capacity integer not null check (max_capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (academic_year_id, grade_level_id, name),
  unique (id, academic_year_id, grade_level_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text,
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_of_birth is null or date_of_birth <= current_date)
);
create index students_name_idx on public.students (last_name, first_name);
create index students_phone_idx on public.students (phone) where phone is not null;

create table public.student_sensitive_details (
  student_id uuid primary key references public.students(id) on delete restrict,
  aadhaar_encrypted text,
  aadhaar_last_four char(4) check (aadhaar_last_four is null or aadhaar_last_four ~ '^[0-9]{4}$'),
  caste text,
  sub_caste text,
  annual_family_income numeric(12,2) check (annual_family_income is null or annual_family_income >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.student_sensitive_details is
  'Highly sensitive fields. Encrypt Aadhaar in the application before storage or use an approved tokenization design; never store full plain-text Aadhaar. Restrict access to Admission Officer and Principal in application authorization.';

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  relationship_to_student text,
  phone text,
  email text,
  occupation text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_phone_idx on public.guardians (phone) where phone is not null;

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id) on delete restrict,
  relationship_type text not null,
  is_primary_contact boolean not null default false,
  can_collect_student boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);
create unique index student_guardians_one_primary_idx
  on public.student_guardians (student_id) where is_primary_contact;

create table public.student_academic_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  section_id uuid,
  admission_number text,
  status public.student_year_status not null default 'admitted',
  admission_date date,
  roll_number text,
  transport_opted_in boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id),
  unique (id, academic_year_id),
  foreign key (section_id, academic_year_id, grade_level_id)
    references public.sections (id, academic_year_id, grade_level_id) on delete restrict
);
create index student_academic_records_year_grade_idx
  on public.student_academic_records (academic_year_id, grade_level_id, section_id);
create index student_academic_records_admission_number_idx
  on public.student_academic_records (admission_number) where admission_number is not null;
comment on column public.student_academic_records.admission_number is
  'Uniqueness scope remains pending CTO/client confirmation; do not add a uniqueness constraint until approved.';

create table public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  requested_grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  requested_section_id uuid,
  status public.admission_application_status not null default 'draft',
  application_number text unique,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.staff_members(id) on delete restrict,
  decision_reason text,
  admission_fee_recorded_at timestamptz,
  seat_reserved_until timestamptz,
  created_by uuid references public.staff_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id),
  foreign key (requested_section_id, academic_year_id, requested_grade_level_id)
    references public.sections (id, academic_year_id, grade_level_id) on delete restrict,
  check (seat_reserved_until is null or status = 'on_hold')
);
create index admission_applications_review_queue_idx
  on public.admission_applications (academic_year_id, status, created_at);

create table public.admission_status_history (
  id uuid primary key default gen_random_uuid(),
  admission_application_id uuid not null references public.admission_applications(id) on delete restrict,
  from_status public.admission_application_status,
  to_status public.admission_application_status not null,
  changed_by uuid references public.staff_members(id) on delete restrict,
  reason text,
  changed_at timestamptz not null default now()
);
create index admission_status_history_application_idx
  on public.admission_status_history (admission_application_id, changed_at);

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade_level_id uuid references public.grade_levels(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  is_required boolean not null default true,
  applies_to_new_admission boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create unique index document_requirements_general_unique_idx
  on public.document_requirements (academic_year_id, document_type_id)
  where grade_level_id is null;
create unique index document_requirements_grade_unique_idx
  on public.document_requirements (academic_year_id, grade_level_id, document_type_id)
  where grade_level_id is not null;

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  admission_application_id uuid references public.admission_applications(id) on delete restrict,
  student_academic_record_id uuid references public.student_academic_records(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  storage_bucket text,
  storage_object_key text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  verification_status public.document_verification_status not null default 'pending',
  uploaded_by uuid references public.staff_members(id) on delete restrict,
  uploaded_at timestamptz,
  reviewed_by uuid references public.staff_members(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  replaces_document_id uuid references public.student_documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((storage_bucket is null and storage_object_key is null) or
         (storage_bucket is not null and storage_object_key is not null)),
  check (verification_status <> 'verified' or storage_object_key is not null)
);
create index student_documents_student_idx on public.student_documents (student_id, document_type_id);
create index student_documents_application_idx on public.student_documents (admission_application_id)
  where admission_application_id is not null;

create table public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  category public.fee_category not null,
  is_variable boolean not null default false,
  is_optional boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status public.fee_structure_state not null default 'draft',
  approval_notes text,
  created_by uuid references public.staff_members(id) on delete restrict,
  approved_by uuid references public.staff_members(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, grade_level_id, version),
  check ((status = 'approved' and approved_by is not null and approved_at is not null)
      or status <> 'approved')
);
create index fee_structures_lookup_idx
  on public.fee_structures (academic_year_id, grade_level_id, status);

create table public.fee_structure_lines (
  id uuid primary key default gen_random_uuid(),
  fee_structure_id uuid not null references public.fee_structures(id) on delete restrict,
  fee_head_id uuid not null references public.fee_heads(id) on delete restrict,
  amount numeric(12,2),
  applicability_rule text,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (fee_structure_id, fee_head_id),
  check (amount is null or amount >= 0)
);
comment on column public.fee_structure_lines.amount is
  'NULL indicates a variable charge (e.g. the Admission Fee) that must be entered as a student-specific assessed amount. Service validation must ensure NULL is used only for variable fee heads.';

create table public.student_fee_assessments (
  id uuid primary key default gen_random_uuid(),
  student_academic_record_id uuid not null references public.student_academic_records(id) on delete restrict,
  fee_structure_id uuid not null references public.fee_structures(id) on delete restrict,
  assessment_number text not null unique,
  status public.assessment_state not null default 'draft',
  assessed_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.staff_members(id) on delete restrict,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_fee_assessments_record_idx
  on public.student_fee_assessments (student_academic_record_id, status);

create table public.student_fee_assessment_lines (
  id uuid primary key default gen_random_uuid(),
  student_fee_assessment_id uuid not null references public.student_fee_assessments(id) on delete restrict,
  fee_head_id uuid not null references public.fee_heads(id) on delete restrict,
  assessed_amount numeric(12,2) not null check (assessed_amount >= 0),
  description_snapshot text,
  created_at timestamptz not null default now(),
  unique (student_fee_assessment_id, fee_head_id),
  unique (id, student_fee_assessment_id)
);
create index student_fee_assessment_lines_head_idx
  on public.student_fee_assessment_lines (fee_head_id);

create table public.transport_rates (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  mode public.transport_mode not null,
  place_label text not null,
  amount numeric(12,2) not null check (amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, mode, place_label)
);

create table public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(),
  student_academic_record_id uuid not null unique references public.student_academic_records(id) on delete restrict,
  transport_rate_id uuid not null references public.transport_rates(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_academic_record_id uuid not null references public.student_academic_records(id) on delete restrict,
  transaction_type public.payment_kind not null default 'collection',
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  method public.payment_method not null,
  transaction_date timestamptz not null default now(),
  payer_name text not null,
  payer_contact text,
  reference_number text,
  notes text,
  reverses_payment_id uuid references public.payments(id) on delete restrict,
  recorded_by uuid references public.staff_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((transaction_type = 'reversal' and reverses_payment_id is not null)
      or transaction_type <> 'reversal'),
  check (reverses_payment_id is null or reverses_payment_id <> id)
);
create index payments_record_date_idx
  on public.payments (student_academic_record_id, transaction_date desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  student_fee_assessment_line_id uuid not null references public.student_fee_assessment_lines(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, student_fee_assessment_line_id)
);
create index payment_allocations_assessment_line_idx
  on public.payment_allocations (student_fee_assessment_line_id);

create table public.fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_fee_assessment_line_id uuid not null references public.student_fee_assessment_lines(id) on delete restrict,
  adjustment_type public.adjustment_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  status public.approval_state not null default 'pending',
  reason text not null,
  requested_by uuid not null references public.staff_members(id) on delete restrict,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.staff_members(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'approved' and approved_by is not null and approved_at is not null)
      or status <> 'approved')
);
create index fee_adjustments_approval_idx on public.fee_adjustments (status, requested_at);

create table public.receipt_number_counters (
  series_code text primary key,
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now()
);
comment on table public.receipt_number_counters is
  'Increment the counter under a row lock inside the same transaction that creates a receipt. The RCT series is shared by individual and consolidated receipts.';

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  category public.fee_category not null,
  receipt_number text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.staff_members(id) on delete restrict,
  template_version text not null,
  rendered_snapshot jsonb not null,
  pdf_storage_bucket text,
  pdf_storage_object_key text,
  reprint_count integer not null default 0 check (reprint_count >= 0),
  last_reprinted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((pdf_storage_bucket is null and pdf_storage_object_key is null) or
         (pdf_storage_bucket is not null and pdf_storage_object_key is not null))
);
create index receipts_issued_at_idx on public.receipts (issued_at desc);

create table public.consolidated_receipts (
  id uuid primary key default gen_random_uuid(),
  student_academic_record_id uuid not null references public.student_academic_records(id) on delete restrict,
  receipt_number text not null unique,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.staff_members(id) on delete restrict,
  template_version text not null,
  rendered_snapshot jsonb not null,
  pdf_storage_bucket text,
  pdf_storage_object_key text,
  created_at timestamptz not null default now(),
  check ((pdf_storage_bucket is null and pdf_storage_object_key is null) or
         (pdf_storage_bucket is not null and pdf_storage_object_key is not null))
);
create index consolidated_receipts_record_idx
  on public.consolidated_receipts (student_academic_record_id, generated_at desc);

create table public.consolidated_receipt_items (
  id uuid primary key default gen_random_uuid(),
  consolidated_receipt_id uuid not null references public.consolidated_receipts(id) on delete restrict,
  receipt_id uuid not null references public.receipts(id) on delete restrict,
  receipt_number_snapshot text not null,
  amount_snapshot numeric(12,2) not null check (amount_snapshot > 0),
  display_order smallint not null,
  created_at timestamptz not null default now(),
  unique (consolidated_receipt_id, receipt_id),
  unique (consolidated_receipt_id, display_order)
);

create table public.student_year_certificates (
  id uuid primary key default gen_random_uuid(),
  student_academic_record_id uuid not null references public.student_academic_records(id) on delete restrict,
  certificate_type public.certificate_kind not null,
  certificate_number text unique,
  status public.certificate_state not null default 'draft',
  generated_by uuid references public.staff_members(id) on delete restrict,
  approved_by uuid references public.staff_members(id) on delete restrict,
  approved_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_academic_record_id, certificate_type),
  check ((status <> 'issued') or (certificate_number is not null and issued_at is not null))
);
create index student_year_certificates_record_idx
  on public.student_year_certificates (student_academic_record_id, status);

create table public.certificate_versions (
  id uuid primary key default gen_random_uuid(),
  student_year_certificate_id uuid not null references public.student_year_certificates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content_snapshot jsonb not null,
  template_version text not null,
  pdf_storage_bucket text,
  pdf_storage_object_key text,
  issue_or_reissue_reason text,
  generated_by uuid references public.staff_members(id) on delete restrict,
  approved_by uuid references public.staff_members(id) on delete restrict,
  generated_at timestamptz not null default now(),
  unique (student_year_certificate_id, version_number),
  check ((pdf_storage_bucket is null and pdf_storage_object_key is null) or
         (pdf_storage_bucket is not null and pdf_storage_object_key is not null))
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_staff_id uuid references public.staff_members(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  outcome text not null default 'success',
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_staff_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
    group by table_name
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      r.table_name
    );
  end loop;
end $$;

create or replace function private.prevent_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Hard deletes are blocked on %. Use an auditable correction, reversal, or status change instead.', tg_table_name
    using errcode = '55000';
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'students',
    'student_academic_records',
    'admission_applications',
    'admission_status_history',
    'student_documents',
    'student_fee_assessments',
    'student_fee_assessment_lines',
    'payments',
    'payment_allocations',
    'fee_adjustments',
    'receipts',
    'consolidated_receipts',
    'consolidated_receipt_items',
    'student_year_certificates',
    'certificate_versions',
    'audit_logs'
  ]
  loop
    execute format(
      'create trigger prevent_hard_delete before delete on public.%I for each row execute function private.prevent_hard_delete()',
      t
    );
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant usage on schema private to service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select, update on sequences to service_role;
