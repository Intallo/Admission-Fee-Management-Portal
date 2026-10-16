-- Read-only checks after running migrations and seed against the intended database.
select jsonb_build_object(
  'public_table_count', (
    select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
  ),
  'all_public_tables_have_rls', (
    select bool_and(c.relrowsecurity) from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
  ),
  'row_counts', jsonb_build_object(
    'students',(select count(*) from public.students),
    'guardians',(select count(*) from public.guardians),
    'admission_applications',(select count(*) from public.admission_applications),
    'payments',(select count(*) from public.payments),
    'payment_allocations',(select count(*) from public.payment_allocations),
    'receipts',(select count(*) from public.receipts),
    'consolidated_receipts',(select count(*) from public.consolidated_receipts),
    'certificates',(select count(*) from public.student_year_certificates)
  ),
  'payment_allocation_mismatches', (
    select count(*) from public.payments p where p.amount <>
      coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.payment_id=p.id),0)
  ),
  'cross_student_allocations', (
    select count(*) from public.payment_allocations pa
    join public.payments p on p.id=pa.payment_id
    join public.student_fee_assessment_lines l on l.id=pa.student_fee_assessment_line_id
    join public.student_fee_assessments a on a.id=l.student_fee_assessment_id
    where p.student_academic_record_id<>a.student_academic_record_id
  ),
  'consolidated_receipt_reconciliation_failures', (
    select count(*) from public.consolidated_receipts cr
    where (cr.rendered_snapshot->>'total_amount_inr')::numeric <>
      coalesce((select sum(i.amount_snapshot) from public.consolidated_receipt_items i
                where i.consolidated_receipt_id=cr.id),0)
  )
) as verification;
