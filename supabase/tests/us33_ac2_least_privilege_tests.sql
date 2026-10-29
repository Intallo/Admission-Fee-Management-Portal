-- ====================================================================================
-- Test Suite: us33_ac2_least_privilege_tests.sql
-- Proves US-33 AC2 Least-Privilege Role Grants for 'school_app_user'
-- Negative SQL Tests: Asserts that DELETE and UPDATE on immutable ledger/audit tables
-- are strictly rejected at the database engine level with permission denied (42501).
-- ====================================================================================

create or replace function pg_temp.assert_privilege_denied(
  p_test_name text,
  p_table text,
  p_privilege text
) returns table(test text, result text) language plpgsql as $$
declare
  v_has boolean;
begin
  select has_table_privilege('school_app_user', p_table, p_privilege) into v_has;
  test := p_test_name;
  if v_has then
    result := 'FAIL: Privilege ' || p_privilege || ' is granted on ' || p_table || ' to school_app_user';
  else
    result := 'pass';
  end if;
  return next;
end;
$$;

create or replace function pg_temp.run_us33_least_privilege_tests()
returns table(test text, result text) language plpgsql as $$
begin
  -- 1. Immutable Ledger Tables (Zero UPDATE, Zero DELETE)
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.1: Revoke UPDATE on payments', 'public.payments', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.2: Revoke DELETE on payments', 'public.payments', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.3: Revoke UPDATE on payment_allocations', 'public.payment_allocations', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.4: Revoke DELETE on payment_allocations', 'public.payment_allocations', 'DELETE');

  -- 2. Receipt Tables (Zero UPDATE, Zero DELETE)
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.5: Revoke UPDATE on receipts', 'public.receipts', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.6: Revoke DELETE on receipts', 'public.receipts', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.7: Revoke UPDATE on consolidated_receipts', 'public.consolidated_receipts', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.8: Revoke DELETE on consolidated_receipts', 'public.consolidated_receipts', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.9: Revoke UPDATE on consolidated_receipt_items', 'public.consolidated_receipt_items', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.10: Revoke DELETE on consolidated_receipt_items', 'public.consolidated_receipt_items', 'DELETE');

  -- 3. Audit Logs (Zero UPDATE, Zero DELETE)
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.11: Revoke UPDATE on audit_logs', 'public.audit_logs', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.12: Revoke DELETE on audit_logs', 'public.audit_logs', 'DELETE');

  -- 4. Status History & Certificate Versions (Zero UPDATE, Zero DELETE)
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.13: Revoke UPDATE on admission_status_history', 'public.admission_status_history', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.14: Revoke DELETE on admission_status_history', 'public.admission_status_history', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.15: Revoke UPDATE on certificate_versions', 'public.certificate_versions', 'UPDATE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.16: Revoke DELETE on certificate_versions', 'public.certificate_versions', 'DELETE');

  -- 5. Core Domain Entities (Zero DELETE)
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.17: Revoke DELETE on students', 'public.students', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.18: Revoke DELETE on student_academic_records', 'public.student_academic_records', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.19: Revoke DELETE on admission_applications', 'public.admission_applications', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.20: Revoke DELETE on student_documents', 'public.student_documents', 'DELETE');
  return query select * from pg_temp.assert_privilege_denied('US-33 AC2.21: Revoke DELETE on fee_structures', 'public.fee_structures', 'DELETE');
end;
$$;

select * from pg_temp.run_us33_least_privilege_tests();
