------------------------------------------------------------------------------------
-- Rollback Migration: 20261101120000_provision_school_app_login_and_rls.down.sql
------------------------------------------------------------------------------------

-- 1. Drop RLS policies
drop policy if exists staff_members_select_policy on public.staff_members;
drop policy if exists staff_members_modify_policy on public.staff_members;
drop policy if exists staff_security_profiles_policy on public.staff_security_profiles;
drop policy if exists academic_years_select_policy on public.academic_years;
drop policy if exists academic_years_modify_policy on public.academic_years;
drop policy if exists grade_levels_select_policy on public.grade_levels;
drop policy if exists grade_levels_modify_policy on public.grade_levels;
drop policy if exists sections_select_policy on public.sections;
drop policy if exists sections_modify_policy on public.sections;
drop policy if exists students_select_policy on public.students;
drop policy if exists students_modify_policy on public.students;
drop policy if exists guardians_select_policy on public.guardians;
drop policy if exists guardians_modify_policy on public.guardians;
drop policy if exists student_guardians_select_policy on public.student_guardians;
drop policy if exists student_guardians_modify_policy on public.student_guardians;
drop policy if exists student_sensitive_details_select_policy on public.student_sensitive_details;
drop policy if exists student_sensitive_details_modify_policy on public.student_sensitive_details;
drop policy if exists student_academic_records_select_policy on public.student_academic_records;
drop policy if exists student_academic_records_modify_policy on public.student_academic_records;
drop policy if exists student_transport_assignments_select_policy on public.student_transport_assignments;
drop policy if exists student_transport_assignments_modify_policy on public.student_transport_assignments;
drop policy if exists admission_applications_select_policy on public.admission_applications;
drop policy if exists admission_applications_modify_policy on public.admission_applications;
drop policy if exists admission_status_history_select_policy on public.admission_status_history;
drop policy if exists admission_status_history_insert_policy on public.admission_status_history;
drop policy if exists document_types_select_policy on public.document_types;
drop policy if exists document_requirements_select_policy on public.document_requirements;
drop policy if exists student_documents_select_policy on public.student_documents;
drop policy if exists student_documents_modify_policy on public.student_documents;
drop policy if exists fee_heads_select_policy on public.fee_heads;
drop policy if exists fee_heads_modify_policy on public.fee_heads;
drop policy if exists fee_structures_select_policy on public.fee_structures;
drop policy if exists fee_structures_modify_policy on public.fee_structures;
drop policy if exists fee_structure_lines_select_policy on public.fee_structure_lines;
drop policy if exists fee_structure_lines_modify_policy on public.fee_structure_lines;
drop policy if exists transport_rates_select_policy on public.transport_rates;
drop policy if exists transport_rates_modify_policy on public.transport_rates;
drop policy if exists student_fee_assessments_select_policy on public.student_fee_assessments;
drop policy if exists student_fee_assessments_modify_policy on public.student_fee_assessments;
drop policy if exists student_fee_assessment_lines_select_policy on public.student_fee_assessment_lines;
drop policy if exists student_fee_assessment_lines_modify_policy on public.student_fee_assessment_lines;
drop policy if exists payments_select_policy on public.payments;
drop policy if exists payments_insert_policy on public.payments;
drop policy if exists payment_allocations_select_policy on public.payment_allocations;
drop policy if exists payment_allocations_insert_policy on public.payment_allocations;
drop policy if exists fee_adjustments_select_policy on public.fee_adjustments;
drop policy if exists fee_adjustments_insert_policy on public.fee_adjustments;
drop policy if exists fee_adjustments_update_policy on public.fee_adjustments;
drop policy if exists receipts_select_policy on public.receipts;
drop policy if exists receipts_insert_policy on public.receipts;
drop policy if exists receipts_update_policy on public.receipts;
drop policy if exists consolidated_receipts_select_policy on public.consolidated_receipts;
drop policy if exists consolidated_receipts_insert_policy on public.consolidated_receipts;
drop policy if exists consolidated_receipts_update_policy on public.consolidated_receipts;
drop policy if exists consolidated_receipt_items_select_policy on public.consolidated_receipt_items;
drop policy if exists consolidated_receipt_items_insert_policy on public.consolidated_receipt_items;
drop policy if exists receipt_number_counters_policy on public.receipt_number_counters;
drop policy if exists student_year_certificates_select_policy on public.student_year_certificates;
drop policy if exists student_year_certificates_modify_policy on public.student_year_certificates;
drop policy if exists certificate_versions_select_policy on public.certificate_versions;
drop policy if exists certificate_versions_insert_policy on public.certificate_versions;
drop policy if exists audit_logs_select_policy on public.audit_logs;
drop policy if exists audit_logs_insert_policy on public.audit_logs;

-- 2. Drop helper functions
drop function if exists private.current_actor_staff_id();
drop function if exists private.current_actor_role();

-- 3. Revoke and drop login role
revoke school_app_user from school_app_login;
drop role if exists school_app_login;
