------------------------------------------------------------------------------------
-- Migration: 20261030000000_provision_restricted_app_role.sql
-- Satisfies US-33 AC2 (Restricted Application Database User) & Fixes Receipt Padding
------------------------------------------------------------------------------------

-- 1. Create or ensure restricted role exists
do $$
begin
  if not exists (select from pg_roles where rolname = 'school_app_user') then
    create role school_app_user with nologin;
  end if;
end
$$;

-- 2. Schema USAGE grants
grant usage on schema public to school_app_user;
grant usage on schema private to school_app_user;

-- 3. Sequence USAGE grants
grant usage, select on all sequences in schema public to school_app_user;

-- 4. Mutable domain tables: GRANT SELECT, INSERT, UPDATE (NO DELETE)
grant select, insert, update on
  public.staff_members,
  public.academic_years,
  public.grade_levels,
  public.sections,
  public.students,
  public.guardians,
  public.student_guardians,
  public.student_sensitive_details,
  public.student_academic_records,
  public.student_transport_assignments,
  public.admission_applications,
  public.document_types,
  public.document_requirements,
  public.student_documents,
  public.fee_heads,
  public.fee_structures,
  public.fee_structure_lines,
  public.transport_rates,
  public.student_fee_assessments,
  public.student_fee_assessment_lines,
  public.fee_adjustments,
  public.student_year_certificates,
  public.receipt_number_counters
to school_app_user;

-- 5. Immutable ledger, receipt, and audit tables: GRANT SELECT, INSERT ONLY (NO UPDATE, NO DELETE)
grant select, insert on
  public.admission_status_history,
  public.payments,
  public.payment_allocations,
  public.receipts,
  public.consolidated_receipts,
  public.consolidated_receipt_items,
  public.certificate_versions,
  public.audit_logs
to school_app_user;

-- 6. Explicitly revoke DELETE on all tables in public schema for school_app_user (US-33 AC2)
revoke delete on all tables in schema public from school_app_user;

-- 7. Explicitly revoke UPDATE on ledger, receipts, items, and audit tables (US-33 AC2)
revoke update on
  public.admission_status_history,
  public.payments,
  public.payment_allocations,
  public.receipts,
  public.consolidated_receipts,
  public.consolidated_receipt_items,
  public.certificate_versions,
  public.audit_logs
from school_app_user;

-- 8. Execution grants for helper functions
grant execute on function public.issue_receipt_number(text) to school_app_user;

------------------------------------------------------------------------------------
-- 9. Fix Receipt Number Padding: 6 Digits zero-padded (RCT-YYYY-NNNNNN)
------------------------------------------------------------------------------------
create or replace function private.next_receipt_number(p_series text default 'RCT')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_series, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  -- Formats string with 6 zero-padded digits per SRS §3 A-10 and US-27 AC2
  return p_series || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;
