------------------------------------------------------------------------------------
-- Migration: 20261101120000_provision_school_app_login_and_rls.sql
-- Satisfies CTO Directive Phase 8 & 8.1:
-- 1. Dedicated login role school_app_login without committed password.
-- 2. Secure actor role resolution deriving directly from active staff record in public.staff_members.
-- 3. Fail-closed RLS policies across all 32 public tables with corrected Principal seat-capacity policy.
-- 4. Atomic monotonic numbering functions for receipts (6 digits: RCT-YYYY-NNNNNN),
--    certificates (4 digits: TC-YYYY-NNNN), and admissions (4 digits: ADM-YYYY-NNNN).
------------------------------------------------------------------------------------

-- 1. Create dedicated LOGIN role for the connection pool if not exists
-- Secure deployment: The password must be provisioned out-of-band by the DB admin/bootstrap pipeline:
-- ALTER ROLE school_app_login WITH PASSWORD '{{SUPPLIED_SECRET}}';
do $$
begin
  if not exists (select from pg_roles where rolname = 'school_app_login') then
    create role school_app_login with login;
  end if;
end
$$;

-- 2. Grant school_app_user membership to school_app_login
grant school_app_user to school_app_login;
grant connect on database postgres to school_app_login;

-- Set default search path
alter role school_app_login set search_path = public, private;
alter role school_app_user set search_path = public, private;

-- Grant execution on sequences and helper functions
grant usage on schema public to school_app_login;
grant usage on schema private to school_app_login;
grant usage, select on all sequences in schema public to school_app_login;
grant execute on function public.issue_receipt_number(text) to school_app_login;

-- Dedicated 4-digit certificate numbering function (TC-YYYY-NNNN) per BRD/SRS and Phase 8.1 Directive
create or replace function private.next_certificate_number(p_prefix text default 'TC')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_prefix, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  -- Formats string with 4 zero-padded digits per BRD/SRS: TC-YYYY-NNNN
  return p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Dedicated 4-digit admission numbering function (ADM-YYYY-NNNN) per BRD/SRS and Phase 8.1 Directive
create or replace function private.next_admission_number(p_prefix text default 'ADM')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_prefix, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  -- Formats string with 4 zero-padded digits per BRD/SRS: ADM-YYYY-NNNN
  return p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

grant execute on function private.next_certificate_number(text) to school_app_user, school_app_login;
grant execute on function private.next_admission_number(text) to school_app_user, school_app_login;

-- 3. Actor Context Helper Functions in schema private
-- Secure Actor Role: Resolves trusted role directly from active staff record in public.staff_members.
-- Detects and blocks role forgery if an asserted app.current_role differs from the DB record.
create or replace function private.current_actor_role()
returns text
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_staff_id_raw text;
  v_staff_id uuid;
  v_db_role text;
  v_is_active boolean;
  v_asserted_role text;
begin
  v_staff_id_raw := pg_catalog.current_setting('app.current_staff_id', true);
  if v_staff_id_raw is null or v_staff_id_raw = '' then
    return null;
  end if;

  begin
    v_staff_id := v_staff_id_raw::uuid;
  exception when others then
    return null;
  end;

  select role, is_active
  into v_db_role, v_is_active
  from public.staff_members
  where id = v_staff_id;

  if not found or v_is_active is not true then
    return null;
  end if;

  v_asserted_role := pg_catalog.current_setting('app.current_role', true);
  if v_asserted_role is not null and v_asserted_role <> '' and v_asserted_role <> v_db_role then
    return null; -- Role forgery detected: asserted role differs from DB role!
  end if;

  return v_db_role;
end;
$$;

create or replace function private.current_actor_staff_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
begin
  v_raw := pg_catalog.current_setting('app.current_staff_id', true);
  if v_raw is null or v_raw = '' then
    return null;
  end if;
  return v_raw::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.current_actor_role() to school_app_user, school_app_login;
grant execute on function private.current_actor_staff_id() to school_app_user, school_app_login;

------------------------------------------------------------------------------------
-- 4. Fail-Closed RLS Policies across all 32 public tables
------------------------------------------------------------------------------------

-- 4.1 Staff Directory & Security Profiles
drop policy if exists staff_members_select_policy on public.staff_members;
create policy staff_members_select_policy on public.staff_members
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists staff_members_modify_policy on public.staff_members;
create policy staff_members_modify_policy on public.staff_members
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('system_admin', 'principal'))
  with check (private.current_actor_role() in ('system_admin', 'principal'));

drop policy if exists staff_security_profiles_policy on public.staff_security_profiles;
create policy staff_security_profiles_policy on public.staff_security_profiles
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('system_admin', 'principal'))
  with check (private.current_actor_role() in ('system_admin', 'principal'));

-- 4.2 Academic Structure
-- SBR / SRS: Academic year and grade level creation/updates are Principal authority.
drop policy if exists academic_years_select_policy on public.academic_years;
create policy academic_years_select_policy on public.academic_years
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists academic_years_modify_policy on public.academic_years;
create policy academic_years_modify_policy on public.academic_years
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

drop policy if exists grade_levels_select_policy on public.grade_levels;
create policy grade_levels_select_policy on public.grade_levels
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists grade_levels_modify_policy on public.grade_levels;
create policy grade_levels_modify_policy on public.grade_levels
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

-- SBR-01 / SRS US-18: Section seat-capacity authority belongs to Principal ONLY (system_admin removed).
drop policy if exists sections_select_policy on public.sections;
create policy sections_select_policy on public.sections
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists sections_modify_policy on public.sections;
create policy sections_modify_policy on public.sections
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

-- 4.3 Students, Guardians, Demographics
drop policy if exists students_select_policy on public.students;
create policy students_select_policy on public.students
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists students_modify_policy on public.students;
create policy students_modify_policy on public.students
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

drop policy if exists guardians_select_policy on public.guardians;
create policy guardians_select_policy on public.guardians
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists guardians_modify_policy on public.guardians;
create policy guardians_modify_policy on public.guardians
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

drop policy if exists student_guardians_select_policy on public.student_guardians;
create policy student_guardians_select_policy on public.student_guardians
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_guardians_modify_policy on public.student_guardians;
create policy student_guardians_modify_policy on public.student_guardians
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

-- 4.4 DPDP Sensitive PII: FAIL-CLOSED for Accountant and System Admin
drop policy if exists student_sensitive_details_select_policy on public.student_sensitive_details;
create policy student_sensitive_details_select_policy on public.student_sensitive_details
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer'));

drop policy if exists student_sensitive_details_modify_policy on public.student_sensitive_details;
create policy student_sensitive_details_modify_policy on public.student_sensitive_details
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer'))
  with check (private.current_actor_role() in ('principal', 'admission_officer'));

-- 4.5 Academic Records & Transport Assignments
drop policy if exists student_academic_records_select_policy on public.student_academic_records;
create policy student_academic_records_select_policy on public.student_academic_records
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_academic_records_modify_policy on public.student_academic_records;
create policy student_academic_records_modify_policy on public.student_academic_records
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer'))
  with check (private.current_actor_role() in ('principal', 'admission_officer'));

drop policy if exists student_transport_assignments_select_policy on public.student_transport_assignments;
create policy student_transport_assignments_select_policy on public.student_transport_assignments
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_transport_assignments_modify_policy on public.student_transport_assignments;
create policy student_transport_assignments_modify_policy on public.student_transport_assignments
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'accountant'));

-- 4.6 Admission Applications & History
drop policy if exists admission_applications_select_policy on public.admission_applications;
create policy admission_applications_select_policy on public.admission_applications
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists admission_applications_modify_policy on public.admission_applications;
create policy admission_applications_modify_policy on public.admission_applications
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

drop policy if exists admission_status_history_select_policy on public.admission_status_history;
create policy admission_status_history_select_policy on public.admission_status_history
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists admission_status_history_insert_policy on public.admission_status_history;
create policy admission_status_history_insert_policy on public.admission_status_history
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

-- 4.7 Documents
drop policy if exists document_types_select_policy on public.document_types;
create policy document_types_select_policy on public.document_types
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists document_requirements_select_policy on public.document_requirements;
create policy document_requirements_select_policy on public.document_requirements
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists student_documents_select_policy on public.student_documents;
create policy student_documents_select_policy on public.student_documents
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_documents_modify_policy on public.student_documents;
create policy student_documents_modify_policy on public.student_documents
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

-- 4.8 Fee Configuration (Principal Only for Structure Creation & Modifications)
drop policy if exists fee_heads_select_policy on public.fee_heads;
create policy fee_heads_select_policy on public.fee_heads
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists fee_heads_modify_policy on public.fee_heads;
create policy fee_heads_modify_policy on public.fee_heads
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

drop policy if exists fee_structures_select_policy on public.fee_structures;
create policy fee_structures_select_policy on public.fee_structures
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists fee_structures_modify_policy on public.fee_structures;
create policy fee_structures_modify_policy on public.fee_structures
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

drop policy if exists fee_structure_lines_select_policy on public.fee_structure_lines;
create policy fee_structure_lines_select_policy on public.fee_structure_lines
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists fee_structure_lines_modify_policy on public.fee_structure_lines;
create policy fee_structure_lines_modify_policy on public.fee_structure_lines
  for all to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

drop policy if exists transport_rates_select_policy on public.transport_rates;
create policy transport_rates_select_policy on public.transport_rates
  for select to school_app_user, school_app_login
  using (private.current_actor_role() is not null);

drop policy if exists transport_rates_modify_policy on public.transport_rates;
create policy transport_rates_modify_policy on public.transport_rates
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant'))
  with check (private.current_actor_role() in ('principal', 'accountant'));

-- 4.9 Fee Assessments & Lines
drop policy if exists student_fee_assessments_select_policy on public.student_fee_assessments;
create policy student_fee_assessments_select_policy on public.student_fee_assessments
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_fee_assessments_modify_policy on public.student_fee_assessments;
create policy student_fee_assessments_modify_policy on public.student_fee_assessments
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'admission_officer'))
  with check (private.current_actor_role() in ('principal', 'accountant', 'admission_officer'));

drop policy if exists student_fee_assessment_lines_select_policy on public.student_fee_assessment_lines;
create policy student_fee_assessment_lines_select_policy on public.student_fee_assessment_lines
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'accountant', 'clerk'));

drop policy if exists student_fee_assessment_lines_modify_policy on public.student_fee_assessment_lines;
create policy student_fee_assessment_lines_modify_policy on public.student_fee_assessment_lines
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'admission_officer'))
  with check (private.current_actor_role() in ('principal', 'accountant', 'admission_officer'));

-- 4.10 Payments, Allocations & Adjustments
drop policy if exists payments_select_policy on public.payments;
create policy payments_select_policy on public.payments
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists payments_insert_policy on public.payments;
create policy payments_insert_policy on public.payments
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists payment_allocations_select_policy on public.payment_allocations;
create policy payment_allocations_select_policy on public.payment_allocations
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists payment_allocations_insert_policy on public.payment_allocations;
create policy payment_allocations_insert_policy on public.payment_allocations
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists fee_adjustments_select_policy on public.fee_adjustments;
create policy fee_adjustments_select_policy on public.fee_adjustments
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant'));

drop policy if exists fee_adjustments_insert_policy on public.fee_adjustments;
create policy fee_adjustments_insert_policy on public.fee_adjustments
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant'));

drop policy if exists fee_adjustments_update_policy on public.fee_adjustments;
create policy fee_adjustments_update_policy on public.fee_adjustments
  for update to school_app_user, school_app_login
  using (private.current_actor_role() = 'principal')
  with check (private.current_actor_role() = 'principal');

-- 4.11 Receipts & Counters
drop policy if exists receipts_select_policy on public.receipts;
create policy receipts_select_policy on public.receipts
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists receipts_insert_policy on public.receipts;
create policy receipts_insert_policy on public.receipts
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists receipts_update_policy on public.receipts;
create policy receipts_update_policy on public.receipts
  for update to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists consolidated_receipts_select_policy on public.consolidated_receipts;
create policy consolidated_receipts_select_policy on public.consolidated_receipts
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists consolidated_receipts_insert_policy on public.consolidated_receipts;
create policy consolidated_receipts_insert_policy on public.consolidated_receipts
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant'));

drop policy if exists consolidated_receipts_update_policy on public.consolidated_receipts;
create policy consolidated_receipts_update_policy on public.consolidated_receipts
  for update to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant'))
  with check (private.current_actor_role() in ('principal', 'accountant'));

drop policy if exists consolidated_receipt_items_select_policy on public.consolidated_receipt_items;
create policy consolidated_receipt_items_select_policy on public.consolidated_receipt_items
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

drop policy if exists consolidated_receipt_items_insert_policy on public.consolidated_receipt_items;
create policy consolidated_receipt_items_insert_policy on public.consolidated_receipt_items
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'accountant'));

drop policy if exists receipt_number_counters_policy on public.receipt_number_counters;
create policy receipt_number_counters_policy on public.receipt_number_counters
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'accountant', 'clerk'))
  with check (private.current_actor_role() in ('principal', 'accountant', 'clerk'));

-- 4.12 Certificates
drop policy if exists student_year_certificates_select_policy on public.student_year_certificates;
create policy student_year_certificates_select_policy on public.student_year_certificates
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

drop policy if exists student_year_certificates_modify_policy on public.student_year_certificates;
create policy student_year_certificates_modify_policy on public.student_year_certificates
  for all to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer'))
  with check (private.current_actor_role() in ('principal', 'admission_officer'));

drop policy if exists certificate_versions_select_policy on public.certificate_versions;
create policy certificate_versions_select_policy on public.certificate_versions
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'admission_officer', 'clerk'));

drop policy if exists certificate_versions_insert_policy on public.certificate_versions;
create policy certificate_versions_insert_policy on public.certificate_versions
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() in ('principal', 'admission_officer'));

-- 4.13 Audit Logs (Append-Only)
drop policy if exists audit_logs_select_policy on public.audit_logs;
create policy audit_logs_select_policy on public.audit_logs
  for select to school_app_user, school_app_login
  using (private.current_actor_role() in ('principal', 'system_admin'));

drop policy if exists audit_logs_insert_policy on public.audit_logs;
create policy audit_logs_insert_policy on public.audit_logs
  for insert to school_app_user, school_app_login
  with check (private.current_actor_role() is not null);
