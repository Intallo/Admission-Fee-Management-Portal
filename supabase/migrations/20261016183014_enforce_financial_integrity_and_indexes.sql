-- Financial integrity and supporting indexes.
-- Payment and allocation writes should happen in one database transaction.

create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  payment_record_id uuid;
  assessment_record_id uuid;
  assessed numeric(12,2);
  payment_type public.payment_kind;
  approved_adjustment_total numeric(12,2);
  prior_net_collected numeric(12,2);
  remaining_payable numeric(12,2);
begin
  select p.student_academic_record_id, p.transaction_type,
         a.student_academic_record_id, l.assessed_amount
    into payment_record_id, payment_type, assessment_record_id, assessed
  from public.payments p
  join public.student_fee_assessment_lines l
    on l.id = new.student_fee_assessment_line_id
  join public.student_fee_assessments a
    on a.id = l.student_fee_assessment_id
  where p.id = new.payment_id
  for update of l;

  if not found then
    raise exception 'Payment or assessment line does not exist';
  end if;

  if payment_record_id <> assessment_record_id then
    raise exception 'Payment and fee assessment line must belong to the same student academic record'
      using errcode = '23514';
  end if;

  if payment_type = 'collection' then
    select coalesce(sum(
      case when fa.adjustment_type = 'concession' then -fa.amount else fa.amount end
    ), 0)::numeric(12,2)
    into approved_adjustment_total
    from public.fee_adjustments fa
    where fa.student_fee_assessment_line_id = new.student_fee_assessment_line_id
      and fa.status = 'approved';

    select coalesce(sum(
      case when p.transaction_type = 'collection' then pa.amount else -pa.amount end
    ), 0)::numeric(12,2)
    into prior_net_collected
    from public.payment_allocations pa
    join public.payments p on p.id = pa.payment_id
    where pa.student_fee_assessment_line_id = new.student_fee_assessment_line_id
      and p.id <> new.payment_id;

    remaining_payable := assessed + approved_adjustment_total - prior_net_collected;
    if new.amount > remaining_payable then
      raise exception 'Allocation % exceeds remaining payable balance % for assessment line %',
        new.amount, remaining_payable, new.student_fee_assessment_line_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_payment_allocation_before_write
before insert or update on public.payment_allocations
for each row execute function private.validate_payment_allocation();

create or replace function private.assert_payment_allocation_sum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_payment_id uuid;
  expected_amount numeric(12,2);
  allocated_amount numeric(12,2);
begin
  if tg_table_name = 'payments' then
    if tg_op = 'DELETE' then target_payment_id := old.id;
    else target_payment_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then target_payment_id := old.payment_id;
    else target_payment_id := new.payment_id;
    end if;
  end if;

  select p.amount into expected_amount
  from public.payments p where p.id = target_payment_id;

  if not found then return null; end if;

  select coalesce(sum(pa.amount), 0)::numeric(12,2)
    into allocated_amount
  from public.payment_allocations pa
  where pa.payment_id = target_payment_id;

  if allocated_amount <> expected_amount then
    raise exception 'Payment % amount % must equal total allocations %',
      target_payment_id, expected_amount, allocated_amount
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger payments_allocation_sum_after_write
after insert or update on public.payments
deferrable initially deferred
for each row execute function private.assert_payment_allocation_sum();

create constraint trigger allocations_sum_after_write
after insert or update or delete on public.payment_allocations
deferrable initially deferred
for each row execute function private.assert_payment_allocation_sum();

create or replace function private.reject_immutable_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Updates are blocked on %. Use a linked reversal, adjustment, new version, or the approved reprint fields.',
    tg_table_name using errcode = '55000';
end;
$$;

create trigger payments_immutable_update
before update on public.payments
for each row execute function private.reject_immutable_update();

create trigger payment_allocations_immutable_update
before update on public.payment_allocations
for each row execute function private.reject_immutable_update();

create trigger consolidated_receipt_items_immutable_update
before update on public.consolidated_receipt_items
for each row execute function private.reject_immutable_update();

create trigger certificate_versions_immutable_update
before update on public.certificate_versions
for each row execute function private.reject_immutable_update();

create trigger audit_logs_immutable_update
before update on public.audit_logs
for each row execute function private.reject_immutable_update();

create or replace function private.protect_receipt_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id, new.payment_id, new.category, new.receipt_number, new.issued_at,
    new.issued_by, new.template_version, new.rendered_snapshot,
    new.pdf_storage_bucket, new.pdf_storage_object_key, new.created_at
  ) is distinct from row(
    old.id, old.payment_id, old.category, old.receipt_number, old.issued_at,
    old.issued_by, old.template_version, old.rendered_snapshot,
    old.pdf_storage_bucket, old.pdf_storage_object_key, old.created_at
  ) then
    raise exception 'Issued receipt contents are immutable; use the duplicate reprint workflow'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger receipts_snapshot_immutable
before update on public.receipts
for each row execute function private.protect_receipt_snapshot();

create trigger consolidated_receipts_immutable_update
before update on public.consolidated_receipts
for each row execute function private.reject_immutable_update();

create or replace function private.protect_approved_financial_adjustments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'approved' and row(
    new.status, new.amount, new.adjustment_type, new.student_fee_assessment_line_id,
    new.reason, new.requested_by, new.requested_at, new.approved_by, new.approved_at
  ) is distinct from row(
    old.status, old.amount, old.adjustment_type, old.student_fee_assessment_line_id,
    old.reason, old.requested_by, old.requested_at, old.approved_by, old.approved_at
  ) then
    raise exception 'Approved adjustment is immutable; create a linked correction'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger protect_approved_financial_adjustments_before_update
before update on public.fee_adjustments
for each row execute function private.protect_approved_financial_adjustments();

-- Supporting indexes for important foreign-key joins.
create index if not exists admission_applications_created_by_idx on public.admission_applications (created_by);
create index if not exists admission_applications_requested_grade_idx on public.admission_applications (requested_grade_level_id);
create index if not exists admission_applications_requested_section_idx on public.admission_applications (requested_section_id, academic_year_id, requested_grade_level_id);
create index if not exists admission_applications_reviewed_by_idx on public.admission_applications (reviewed_by);
create index if not exists admission_status_history_changed_by_idx on public.admission_status_history (changed_by);
create index if not exists certificate_versions_approved_by_idx on public.certificate_versions (approved_by);
create index if not exists certificate_versions_generated_by_idx on public.certificate_versions (generated_by);
create index if not exists consolidated_receipt_items_receipt_idx on public.consolidated_receipt_items (receipt_id);
create index if not exists consolidated_receipts_generated_by_idx on public.consolidated_receipts (generated_by);
create index if not exists document_requirements_document_type_idx on public.document_requirements (document_type_id);
create index if not exists document_requirements_grade_idx on public.document_requirements (grade_level_id);
create index if not exists fee_adjustments_approved_by_idx on public.fee_adjustments (approved_by);
create index if not exists fee_adjustments_requested_by_idx on public.fee_adjustments (requested_by);
create index if not exists fee_adjustments_assessment_line_idx on public.fee_adjustments (student_fee_assessment_line_id);
create index if not exists fee_structure_lines_fee_head_idx on public.fee_structure_lines (fee_head_id);
create index if not exists fee_structures_approved_by_idx on public.fee_structures (approved_by);
create index if not exists fee_structures_created_by_idx on public.fee_structures (created_by);
create index if not exists fee_structures_grade_idx on public.fee_structures (grade_level_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);
create index if not exists payments_reverses_payment_idx on public.payments (reverses_payment_id);
create index if not exists receipts_issued_by_idx on public.receipts (issued_by);
create index if not exists sections_grade_idx on public.sections (grade_level_id);
create index if not exists student_academic_records_grade_idx on public.student_academic_records (grade_level_id);
create index if not exists student_academic_records_section_fk_idx on public.student_academic_records (section_id, academic_year_id, grade_level_id);
create index if not exists student_documents_type_idx on public.student_documents (document_type_id);
create index if not exists student_documents_replaces_idx on public.student_documents (replaces_document_id);
create index if not exists student_documents_reviewed_by_idx on public.student_documents (reviewed_by);
create index if not exists student_documents_academic_record_idx on public.student_documents (student_academic_record_id);
create index if not exists student_documents_uploaded_by_idx on public.student_documents (uploaded_by);
create index if not exists student_fee_assessments_structure_idx on public.student_fee_assessments (fee_structure_id);
create index if not exists student_fee_assessments_issued_by_idx on public.student_fee_assessments (issued_by);
create index if not exists student_guardians_guardian_idx on public.student_guardians (guardian_id);
create index if not exists student_transport_assignments_rate_idx on public.student_transport_assignments (transport_rate_id);
create index if not exists student_year_certificates_approved_by_idx on public.student_year_certificates (approved_by);
create index if not exists student_year_certificates_generated_by_idx on public.student_year_certificates (generated_by);
