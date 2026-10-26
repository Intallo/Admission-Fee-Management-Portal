-- Hardening pass after schema review.
-- Fixes: reversal/refund validation, one fee category per payment/receipt, frozen issued
-- assessments and approved fee structures, concession limits, cross-table consistency,
-- plus small data-quality constraints and a receipt-number issuing function.
-- NOTE: run on a copy/backup first. Each ADD CONSTRAINT / CREATE UNIQUE INDEX below will
-- fail if existing data already violates it; that failure is information, fix the data first.

------------------------------------------------------------------------------------
-- 1. Payments: reverses_payment_id is only meaningful for reversals
------------------------------------------------------------------------------------
alter table public.payments
  add constraint payments_reverses_only_for_reversal
  check (transaction_type = 'reversal' or reverses_payment_id is null);

------------------------------------------------------------------------------------
-- 2. Allocation validation for collections, reversals AND refunds
------------------------------------------------------------------------------------
create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pay            public.payments%rowtype;
  orig           public.payments%rowtype;
  line_record_id uuid;
  assessed       numeric(12,2);
  adj_total      numeric(12,2);
  net_collected  numeric(12,2);   -- collections minus refunds/reversals, excluding this payment
  orig_alloc     numeric(12,2);
  already_rev    numeric(12,2);
begin
  select p.* into pay from public.payments p where p.id = new.payment_id;
  if not found then raise exception 'Payment does not exist'; end if;

  -- lock the assessment line so concurrent payments on it are serialised
  select a.student_academic_record_id, l.assessed_amount
    into line_record_id, assessed
  from public.student_fee_assessment_lines l
  join public.student_fee_assessments a on a.id = l.student_fee_assessment_id
  where l.id = new.student_fee_assessment_line_id
  for update of l;
  if not found then raise exception 'Assessment line does not exist'; end if;

  if pay.student_academic_record_id <> line_record_id then
    raise exception 'Payment and fee assessment line must belong to the same student academic record'
      using errcode = '23514';
  end if;

  select coalesce(sum(case when p.transaction_type = 'collection' then pa.amount else -pa.amount end), 0)
    into net_collected
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.student_fee_assessment_line_id = new.student_fee_assessment_line_id
    and p.id <> new.payment_id;

  if pay.transaction_type = 'collection' then
    select coalesce(sum(case when fa.adjustment_type = 'concession' then -fa.amount else fa.amount end), 0)
      into adj_total
    from public.fee_adjustments fa
    where fa.student_fee_assessment_line_id = new.student_fee_assessment_line_id
      and fa.status = 'approved';

    if new.amount > assessed + adj_total - net_collected then
      raise exception 'Allocation % exceeds remaining payable balance % for assessment line %',
        new.amount, assessed + adj_total - net_collected, new.student_fee_assessment_line_id
        using errcode = '23514';
    end if;

  elsif pay.transaction_type = 'reversal' then
    select * into orig from public.payments where id = pay.reverses_payment_id;
    if orig.transaction_type is distinct from 'collection' then
      raise exception 'A reversal must point to a collection payment' using errcode = '23514';
    end if;
    if orig.student_academic_record_id <> pay.student_academic_record_id then
      raise exception 'A reversal must belong to the same student academic record as the original payment'
        using errcode = '23514';
    end if;

    select pa.amount into orig_alloc
    from public.payment_allocations pa
    where pa.payment_id = orig.id
      and pa.student_fee_assessment_line_id = new.student_fee_assessment_line_id;
    if orig_alloc is null then
      raise exception 'Original payment % has no allocation on line %', orig.id, new.student_fee_assessment_line_id
        using errcode = '23514';
    end if;

    select coalesce(sum(pa.amount), 0) into already_rev
    from public.payment_allocations pa
    join public.payments r on r.id = pa.payment_id
    where r.transaction_type = 'reversal'
      and r.reverses_payment_id = orig.id
      and r.id <> pay.id
      and pa.student_fee_assessment_line_id = new.student_fee_assessment_line_id;

    if already_rev + new.amount > orig_alloc then
      raise exception 'Reversal % exceeds the unreversed amount % of original payment on line %',
        new.amount, orig_alloc - already_rev, new.student_fee_assessment_line_id
        using errcode = '23514';
    end if;

  elsif pay.transaction_type = 'refund' then
    if new.amount > net_collected then
      raise exception 'Refund % exceeds net collected % on line %',
        new.amount, net_collected, new.student_fee_assessment_line_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------------
-- 3. One fee category per payment; receipt category must match it
------------------------------------------------------------------------------------
create or replace function private.enforce_single_category_per_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  this_cat  public.fee_category;
  other_cat public.fee_category;
begin
  select h.category into this_cat
  from public.student_fee_assessment_lines l
  join public.fee_heads h on h.id = l.fee_head_id
  where l.id = new.student_fee_assessment_line_id;

  select h.category into other_cat
  from public.payment_allocations pa
  join public.student_fee_assessment_lines l on l.id = pa.student_fee_assessment_line_id
  join public.fee_heads h on h.id = l.fee_head_id
  where pa.payment_id = new.payment_id and pa.id <> new.id and h.category <> this_cat
  limit 1;

  if other_cat is not null then
    raise exception 'A payment may only be allocated to one fee category (school_fee, vehicle or books); record separate payments per category'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payment_allocations_single_category
before insert on public.payment_allocations
for each row execute function private.enforce_single_category_per_payment();

create or replace function private.enforce_receipt_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cats public.fee_category[];
begin
  select array_agg(distinct h.category) into cats
  from public.payment_allocations pa
  join public.student_fee_assessment_lines l on l.id = pa.student_fee_assessment_line_id
  join public.fee_heads h on h.id = l.fee_head_id
  where pa.payment_id = new.payment_id;

  if cats is null then
    raise exception 'Create the payment allocations before the receipt' using errcode = '23514';
  end if;
  if array_length(cats, 1) <> 1 or cats[1] <> new.category then
    raise exception 'Receipt category % does not match the fee category of the payment (%)', new.category, cats
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger receipts_category_matches_payment
before insert on public.receipts
for each row execute function private.enforce_receipt_category();

------------------------------------------------------------------------------------
-- 4. Freeze issued assessments and approved/retired fee structures
------------------------------------------------------------------------------------
create unique index fee_structures_one_approved_idx
  on public.fee_structures (academic_year_id, grade_level_id)
  where status = 'approved';

create or replace function private.protect_assessment_lines()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status public.assessment_state;
begin
  select a.status into parent_status
  from public.student_fee_assessments a
  where a.id = old.student_fee_assessment_id;
  if parent_status is not null and parent_status <> 'draft' then
    raise exception 'Lines of an % assessment cannot be changed; cancel it and create a new assessment, or use an adjustment', parent_status
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger assessment_lines_frozen
before update or delete on public.student_fee_assessment_lines
for each row execute function private.protect_assessment_lines();

create or replace function private.protect_issued_assessment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelled' then
    raise exception 'A cancelled assessment cannot be changed' using errcode = '55000';
  end if;
  if old.status = 'issued' and (
       row(new.student_academic_record_id, new.fee_structure_id, new.assessment_number,
           new.assessed_at, new.issued_at, new.issued_by, new.snapshot)
       is distinct from
       row(old.student_academic_record_id, old.fee_structure_id, old.assessment_number,
           old.assessed_at, old.issued_at, old.issued_by, old.snapshot)
       or new.status = 'draft') then
    raise exception 'An issued assessment is immutable (it may only be cancelled)' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger protect_issued_assessment_before_update
before update on public.student_fee_assessments
for each row execute function private.protect_issued_assessment();

create or replace function private.protect_fee_structure_lines()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status public.fee_structure_state;
begin
  select s.status into parent_status from public.fee_structures s where s.id = old.fee_structure_id;
  if parent_status in ('approved', 'retired') then
    raise exception 'Lines of an % fee structure cannot be changed; create a new version', parent_status
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger fee_structure_lines_frozen
before update or delete on public.fee_structure_lines
for each row execute function private.protect_fee_structure_lines();

------------------------------------------------------------------------------------
-- 5. Approved adjustments must keep the payable amount sane
------------------------------------------------------------------------------------
create or replace function private.validate_fee_adjustment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessed      numeric(12,2);
  other_adj     numeric(12,2);
  this_adj      numeric(12,2);
  net_collected numeric(12,2);
  payable       numeric(12,2);
begin
  if new.status <> 'approved' then return new; end if;

  select l.assessed_amount into assessed
  from public.student_fee_assessment_lines l
  where l.id = new.student_fee_assessment_line_id
  for update;

  select coalesce(sum(case when fa.adjustment_type = 'concession' then -fa.amount else fa.amount end), 0)
    into other_adj
  from public.fee_adjustments fa
  where fa.student_fee_assessment_line_id = new.student_fee_assessment_line_id
    and fa.status = 'approved' and fa.id <> new.id;

  this_adj := case when new.adjustment_type = 'concession' then -new.amount else new.amount end;

  select coalesce(sum(case when p.transaction_type = 'collection' then pa.amount else -pa.amount end), 0)
    into net_collected
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.student_fee_assessment_line_id = new.student_fee_assessment_line_id;

  payable := assessed + other_adj + this_adj;
  if payable < 0 then
    raise exception 'Adjustment would make the payable amount negative (%)', payable using errcode = '23514';
  end if;
  if payable < net_collected then
    raise exception 'Adjustment would reduce the payable amount (%) below what is already collected (%); record a refund first',
      payable, net_collected using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_fee_adjustment_before_write
before insert or update on public.fee_adjustments
for each row execute function private.validate_fee_adjustment();

------------------------------------------------------------------------------------
-- 6. Cross-table consistency
------------------------------------------------------------------------------------
create or replace function private.validate_assessment_matches_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.student_academic_records r
    join public.fee_structures s on s.id = new.fee_structure_id
    where r.id = new.student_academic_record_id
      and r.academic_year_id = s.academic_year_id
      and r.grade_level_id = s.grade_level_id
  ) then
    raise exception 'Fee structure must be for the same academic year and grade as the student record'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assessment_matches_record
before insert or update of student_academic_record_id, fee_structure_id on public.student_fee_assessments
for each row execute function private.validate_assessment_matches_record();

create or replace function private.validate_document_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.admission_application_id is not null and not exists (
    select 1 from public.admission_applications a
    where a.id = new.admission_application_id and a.student_id = new.student_id) then
    raise exception 'Document student does not match the admission application''s student' using errcode = '23514';
  end if;
  if new.student_academic_record_id is not null and not exists (
    select 1 from public.student_academic_records r
    where r.id = new.student_academic_record_id and r.student_id = new.student_id) then
    raise exception 'Document student does not match the academic record''s student' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger student_documents_owner_consistent
before insert or update of student_id, admission_application_id, student_academic_record_id
on public.student_documents
for each row execute function private.validate_document_owner();

create or replace function private.validate_transport_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.student_academic_records r
    join public.transport_rates t on t.id = new.transport_rate_id
    where r.id = new.student_academic_record_id and r.academic_year_id = t.academic_year_id) then
    raise exception 'Transport rate must belong to the same academic year as the student record' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transport_assignment_year_matches
before insert or update on public.student_transport_assignments
for each row execute function private.validate_transport_year();

------------------------------------------------------------------------------------
-- 7. Data quality
------------------------------------------------------------------------------------
alter table public.students
  add constraint students_gender_valid
  check (gender is null or gender in ('male', 'female', 'other'));

create unique index student_academic_records_roll_unique_idx
  on public.student_academic_records (academic_year_id, section_id, roll_number)
  where section_id is not null and roll_number is not null;

-- Keyed hash of Aadhaar (HMAC computed in the app, never the raw number) for duplicate detection.
alter table public.student_sensitive_details add column if not exists aadhaar_hash text;
create unique index student_sensitive_aadhaar_hash_idx
  on public.student_sensitive_details (aadhaar_hash) where aadhaar_hash is not null;

------------------------------------------------------------------------------------
-- 8. Receipt numbers: one function, row-locked counter, shared RCT series
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
  return p_series || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;
revoke all on function private.next_receipt_number(text) from public, anon, authenticated;
grant execute on function private.next_receipt_number(text) to service_role;

-- supabase-js can only call functions in exposed schemas, so give the server a thin wrapper.
create or replace function public.issue_receipt_number(p_series text default 'RCT')
returns text
language sql
security definer
set search_path = ''
as $$ select private.next_receipt_number(p_series); $$;
revoke all on function public.issue_receipt_number(text) from public, anon, authenticated;
grant execute on function public.issue_receipt_number(text) to service_role;