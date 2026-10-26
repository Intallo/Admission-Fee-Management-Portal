-- Integrity tests: each case tries something the database MUST reject (plus one control that must work).
-- Run on a LOCAL database after migrations + seed. Every case is rolled back, nothing is left behind.
-- result = 'pass' (rejected as it should be) | 'FAIL' (database accepted it = gap) | 'SKIP' (no fixture data)

create or replace function pg_temp.expect_reject(t text, stmts text)
returns table(test text, result text) language plpgsql as $$
begin
  begin
    execute stmts;
    raise exception 'ACCEPTED_BY_DB';
  exception when others then
    test := t;
    result := case when sqlerrm = 'ACCEPTED_BY_DB' then 'FAIL' else 'pass' end;
    return next;
  end;
end $$;

create or replace function pg_temp.expect_accept(t text, stmts text)
returns table(test text, result text) language plpgsql as $$
begin
  begin
    execute stmts;
    raise exception 'ROLLBACK_CONTROL';
  exception when others then
    test := t;
    result := case when sqlerrm = 'ROLLBACK_CONTROL' then 'pass' else 'FAIL: ' || sqlerrm end;
    return next;
  end;
end $$;

create or replace function pg_temp.run_integrity_tests()
returns table(test text, result text) language plpgsql as $$
declare
  v_line uuid; v_rec uuid; v_amt numeric; v_staff uuid;
  v_l1 uuid; v_l2 uuid; v_rec2 uuid; v_app uuid; v_stu uuid; v_other uuid;
  col text; ref text;
begin
  select l.id, a.student_academic_record_id, l.assessed_amount into v_line, v_rec, v_amt
  from public.student_fee_assessment_lines l
  join public.student_fee_assessments a on a.id = l.student_fee_assessment_id
  where not exists (select 1 from public.payment_allocations pa where pa.student_fee_assessment_line_id = l.id)
    and not exists (select 1 from public.fee_adjustments fa where fa.student_fee_assessment_line_id = l.id)
  limit 1;
  select id into v_staff from public.staff_members limit 1;

  -- two unallocated lines of different fee categories on the same student record
  select x.l1, x.l2, x.rec into v_l1, v_l2, v_rec2 from (
    select l1.id l1, l2.id l2, a.student_academic_record_id rec
    from public.student_fee_assessments a
    join public.student_fee_assessment_lines l1 on l1.student_fee_assessment_id = a.id
    join public.student_fee_assessment_lines l2 on l2.student_fee_assessment_id = a.id and l2.id <> l1.id
    join public.fee_heads h1 on h1.id = l1.fee_head_id
    join public.fee_heads h2 on h2.id = l2.fee_head_id and h2.category <> h1.category
    where not exists (select 1 from public.payment_allocations p where p.student_fee_assessment_line_id in (l1.id, l2.id))
    limit 1) x;

  select aa.id, aa.student_id into v_app, v_stu from public.admission_applications aa limit 1;
  select id into v_other from public.students where id <> v_stu limit 1;

  -- a collection of 100 on v_line used as the setup of several cases
  col := format($q$
    create temp table if not exists _c(id uuid);
    truncate _c;
    with p as (insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name)
      values (%L,'collection',100,'cash','t') returning id) insert into _c select id from p;
    insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount) select id,%L,100 from _c;
  $q$, v_rec, v_line);

  return query select * from pg_temp.expect_accept('C1 valid collection still works',
    col || ' set constraints all immediate;');

  return query select * from pg_temp.expect_reject('T1 reversal larger than original payment', col || format($q$
    with r as (insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name,reverses_payment_id)
      select %L,'reversal',5000,'cash','t',id from _c returning id)
    insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount) select id,%L,5000 from r;
    set constraints all immediate;$q$, v_rec, v_line));

  return query select * from pg_temp.expect_reject('T2 same payment reversed twice', col || format($q$
    with r as (insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name,reverses_payment_id)
      select %L,'reversal',100,'cash','t',id from _c returning id)
    insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount) select id,%L,100 from r;
    with r as (insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name,reverses_payment_id)
      select %L,'reversal',100,'cash','t',id from _c returning id)
    insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount) select id,%L,100 from r;
    set constraints all immediate;$q$, v_rec, v_line, v_rec, v_line));

  return query select * from pg_temp.expect_reject('T3 refund when nothing was collected', format($q$
    with r as (insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name)
      values (%L,'refund',50,'cash','t') returning id)
    insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount) select id,%L,50 from r;
    set constraints all immediate;$q$, v_rec, v_line));

  return query select * from pg_temp.expect_reject('T4 collection that claims to reverse a payment', col || format($q$
    insert into public.payments(student_academic_record_id,transaction_type,amount,method,payer_name,reverses_payment_id)
      select %L,'collection',10,'cash','t',id from _c;$q$, v_rec));

  if v_l1 is null then
    test := 'T5 one payment across fee categories'; result := 'SKIP (no fixture)'; return next;
    test := 'T6 receipt category differs from payment'; result := 'SKIP (no fixture)'; return next;
  else
    return query select * from pg_temp.expect_reject('T5 one payment across fee categories', format($q$
      with p as (insert into public.payments(student_academic_record_id,amount,method,payer_name)
        values (%L,2,'cash','t') returning id)
      insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount)
        select id,%L::uuid,1 from p union all select id,%L::uuid,1 from p;
      set constraints all immediate;$q$, v_rec2, v_l1, v_l2));
    return query select * from pg_temp.expect_reject('T6 receipt category differs from payment', format($q$
      with p as (insert into public.payments(student_academic_record_id,amount,method,payer_name)
        values (%L,1,'cash','t') returning id),
      a as (insert into public.payment_allocations(payment_id,student_fee_assessment_line_id,amount)
        select id,%L,1 from p returning payment_id)
      insert into public.receipts(payment_id,category,receipt_number,template_version,rendered_snapshot)
        select a.payment_id,
          (case when h.category='books' then 'vehicle' else 'books' end)::public.fee_category,'TEST-X','v1','{}'
        from a, public.student_fee_assessment_lines l join public.fee_heads h on h.id=l.fee_head_id where l.id=%L;
      set constraints all immediate;$q$, v_rec2, v_l1, v_l1));
  end if;

  return query select * from pg_temp.expect_reject('T7 edit amount on an issued assessment line', format(
    $q$update public.student_fee_assessment_lines set assessed_amount = assessed_amount + 1 where id = %L$q$, v_line));

  return query select * from pg_temp.expect_reject('T8 delete lines of an approved fee structure',
    $q$delete from public.fee_structure_lines where fee_structure_id in
         (select id from public.fee_structures where status='approved' limit 1)$q$);

  return query select * from pg_temp.expect_reject('T9 second approved fee structure for same year+grade', format($q$
    insert into public.fee_structures(academic_year_id,grade_level_id,version,status,approved_by,approved_at)
      select academic_year_id,grade_level_id,max(version)+1,'approved',%L,now()
      from public.fee_structures where status='approved' group by 1,2 limit 1$q$, v_staff));

  return query select * from pg_temp.expect_reject('T10 concession larger than assessed amount', format($q$
    insert into public.fee_adjustments(student_fee_assessment_line_id,adjustment_type,amount,reason,requested_by,status,approved_by,approved_at)
      values (%L,'concession',%L,'x',%L,'approved',%L,now())$q$, v_line, v_amt + 1, v_staff, v_staff));

  return query select * from pg_temp.expect_reject('T11 fee structure of another grade', $q$
    insert into public.student_fee_assessments(student_academic_record_id,fee_structure_id,assessment_number)
      select r.id, fs.id, 'TEST-GRADE' from public.student_academic_records r, public.fee_structures fs
      where fs.grade_level_id <> r.grade_level_id limit 1$q$);

  return query select * from pg_temp.expect_reject('T12 document of another student on an application', format($q$
    insert into public.student_documents(student_id,admission_application_id,document_type_id)
      values (%L,%L,(select id from public.document_types limit 1))$q$, v_other, v_app));

  return query select * from pg_temp.expect_reject('T13 invalid gender value',
    $q$insert into public.students(first_name,last_name,gender) values ('Test','Gender','banana')$q$);
end $$;

select * from pg_temp.run_integrity_tests();