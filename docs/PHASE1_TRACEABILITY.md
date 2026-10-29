# Phase 1 Requirements Traceability Matrix (RTM)

**Document Code:** PHASE1-RTM-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Baseline References:** Signed BRD v1.4, Signed SRS v1.4 (Approved 22 October 2026), M0.4 Schema Inventory, CTO Database Audit  
**Auditor / Implementation Owner:** Senior Software Engineer  
**Status:** Phase 1 Deliverable — Complete Audit Baseline  

---

## 1. Traceability Methodology & Status Classifications

This matrix links each user story and acceptance criterion from the authoritative signed requirements to its technical delivery components:
- **UI / Workflow:** Screen, modal, or form workflow.
- **Domain Module:** Target architectural module within `src/modules/*`.
- **API / Server Action:** Route handler or server action contract.
- **Database Assets:** Tables, constraints, functions, triggers, and sequences.
- **Automated Tests:** Unit, integration, or negative database tests.
- **Verification Evidence:** Proof of current execution or test script reference.
- **Implementation Status:** Explicitly partitioned into:
  - `Verified Existing`: Present in repository and validated by audit.
  - `Schema Only`: Database tables/triggers exist, but application logic is absent.
  - `Missing / Proposed`: Needs implementation in subsequent phases.
  - `Withdrawn`: Formally cancelled by signed change order.

---

## 2. Comprehensive Requirements Traceability Matrix (US-01 to US-43)

| Story ID & Name | BRD Ref | Priority | Target Module | Proposed / Existing API Route | Database Tables, Triggers & Constraints | Automated Tests & Evidence | Implementation Status |
|---|---|:---:|---|---|---|---|:---:|
| **US-01 Login** | BR-01 | P1 | `identity-access` | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` | `public.staff_members` (`auth_user_id`, `role`, `is_active`). Cookie sessions via `@supabase/ssr`. | Lockout after 5 failed attempts; session expiry test. | **Missing / Proposed** (Schema exists; Auth UI/API missing) |
| **US-02 Role-based menus** | BR-03 | P1 | `identity-access`, `shared` | `GET /api/auth/me` | `public.staff_members.role`. RBAC lookup against `AUTHORIZATION_MATRIX.md`. | Unit tests for navigation filtering per role. | **Missing / Proposed** (Matrix defined; UI missing) |
| **US-03 Sensitive data protection** | BR-04 | P1 | `identity-access`, `student-records` | `GET /api/students/{id}/sensitive` | `public.student_sensitive_details` (1:1 with `students`, Aadhaar SHA-256 hash index). | Negative test: Non-Principal/ADM receives 403. | **Schema Only** (Table & trigger exist; API missing) |
| **US-04 Account management** | BR-01, DEL-04 | P2 | `identity-access` | `GET /api/admin/staff`, `POST /api/admin/staff`, `PATCH /api/admin/staff/{id}` | `public.staff_members`, `public.audit_logs`. Trigger: `prevent_hard_delete()`. | Integration test: Deactivated user immediately receives 403. | **Schema Only** (Table exists; Admin UI/API missing) |
| **US-05 Select academic year** | BR-02 | P1 | `academic-years` | `GET /api/academic-years`, `POST /api/academic-years/select` | `public.academic_years` (`status IN ('planning', 'current', 'closed')`). | Unit test: Active year stored in session/context. | **Schema Only** (Table exists; UI missing) |
| **US-06 Manage academic years** | BR-02, BR-39 | P2 | `academic-years` | `POST /api/academic-years`, `PATCH /api/academic-years/{id}/close` | `public.academic_years`. Constraint: `check (start_date < end_date)`, June 1 - May 31. Unique index: `single_current_idx`. | Negative test: Closed year rejects mutation with 422. | **Schema Only** (Constraints verified in SQL; UI missing) |
| **US-07 Create application** | BR-05, BR-09 | P1 | `admissions` | `POST /api/admissions/applications` | `public.admission_applications` (`application_number unique`, `status = 'draft'`). | Integration test: Auto-generates `161/2026-27`. | **Missing / Proposed** (Table exists; number generation missing) |
| **US-08 Enter student details** | BR-05 | P1 | `admissions` | `PUT /api/admissions/applications/{id}/student` | `public.students` (demographics, gender validation constraint). | `integrity_tests.sql` T13 (gender rejection passed). | **Verified Existing (Schema)**; UI missing |
| **US-09 Enter parent details** | BR-06 | P1 | `admissions` | `PUT /api/admissions/applications/{id}/guardians` | `public.guardians`, `public.student_guardians` (`is_primary_contact`, unique index). | Constraint test: Exactly 1 primary guardian. | **Schema Only** (Table exists; UI missing) |
| **US-10 Upload documents** | BR-07 | P2 | `documents`, `admissions` | `POST /api/admissions/applications/{id}/documents` | `public.student_documents`, `public.document_types`. Trigger: `validate_document_owner()`. | `integrity_tests.sql` T12 (cross-student doc rejection passed). | **Verified Existing (Schema)**; File upload missing |
| **US-11 Track missing documents** | BR-08 | P2 | `admissions` | `GET /api/admissions/applications/{id}/checklist` | `public.document_requirements` joined with `public.student_documents`. | Unit test: Checklist computation logic. | **Schema Only** (Tables exist; UI missing) |
| **US-12 Save and edit draft** | BR-09 | P1 | `admissions` | `PATCH /api/admissions/applications/{id}` | `public.admission_applications.status = 'draft'`. | Integration test: Draft resume and edit. | **Schema Only** (Table exists; UI missing) |
| **US-13 Submit application** | BR-10 | P1 | `admissions` | `POST /api/admissions/applications/{id}/submit` | `public.admission_applications.status = 'submitted'`, `admission_status_history`. | State machine test: Draft -> Submitted transition. | **Schema Only** (Table exists; UI missing) |
| **US-14 Review applications** | BR-10, BR-11 | P1 | `admissions` | `GET /api/admissions/applications`, `PATCH /api/admissions/applications/{id}/status` | `public.admission_applications` (`under_review`, `on_hold`, `rejected`). | Principal authorization test. | **Schema Only** (Table exists; UI missing) |
| **US-15 Approve admission** | BR-12, BR-37 | P1 | `admissions`, `fees-ledger` | `POST /api/admissions/applications/{id}/approve` | `public.admission_applications` -> `students` -> `student_academic_records` (`admission_number` `ADM-YYYY-NNNN`), `student_fee_assessments`. | **Atomic Business Operation 1**. Test: Admission approved with ZERO payment. | **Missing / Proposed** (Requires atomic stored proc / server action) |
| **US-16 Application status & history** | BR-11 | P1 | `admissions` | `GET /api/admissions/applications/{id}/history` | `public.admission_status_history` (`before_status`, `after_status`, `changed_by`). | Immutability trigger test on history rows. | **Schema Only** (Table exists; UI missing) |
| **US-17 Manage receipt types & fee heads** | BR-14, BR-41, BR-42 | P2 | `fee-configuration` | `GET /api/fee-config/heads`, `POST /api/fee-config/heads` | `public.fee_heads` (`category IN ('school_fee', 'vehicle', 'books')`, `is_variable`). | Category enum constraint test. | **Schema Only** (Table & Enum verified) |
| **US-18 Set up yearly fee structure** | BR-13, BR-44 | P2 | `fee-configuration` | `POST /api/fee-config/structures`, `POST /api/fee-config/structures/{id}/approve` | `public.fee_structures`, `fee_structure_lines`. Triggers: `protect_fee_structure_lines()`. | `integrity_tests.sql` T8, T9 (immutability and duplicate approval rejection passed). | **Verified Existing (Schema)**; UI missing |
| **US-19 Manage vehicle places** | BR-15, BR-44 | P2 | `fee-configuration` | `GET /api/fee-config/transport-rates`, `POST /api/fee-config/transport-rates` | `public.transport_rates` (`place_name`, `rate_amount`, `mode`). | Unique index `(academic_year_id, place_name, mode)` test. | **Schema Only** (Table exists; UI missing) |
| **US-20 View fee breakdown** | BR-16 | P1 | `fees-ledger` | `GET /api/students/{id}/fees` | `public.student_fee_assessments`, `student_fee_assessment_lines`. Triggers: `protect_issued_assessment()`. | `integrity_tests.sql` T7 (assessment amount edit rejection passed). | **Verified Existing (Schema)**; UI missing |
| **US-21 Record payment** | BR-17, BR-18, BR-43 | P1 | `fees-ledger` | `POST /api/fees/payments` | `public.payments`, `payment_allocations`, `receipts`. Triggers: `validate_payment_allocation`, `assert_payment_allocation_sum`, `enforce_single_category_per_payment`. | **Atomic Business Operation 2**. `integrity_tests.sql` C1, T5 passed. | **Partially Verified (Schema/Triggers)**; Stored proc missing |
| **US-22 Payment modes & installments** | BR-17, BR-43 | P1 | `fees-ledger` | `POST /api/fees/payments` | `public.payments.method` (`cash`, `cheque`, `bank_transfer`, `upi_manual`). | Validation of offline payment mode without gateway. | **Schema Only** (Enum verified; UI missing) |
| **US-23 Track fee status & dues** | BR-19, BR-20 | P1 | `fees-ledger` | `GET /api/students/{id}/dues` | Computed from `student_fee_assessment_lines` - `payment_allocations` - `fee_adjustments`. | Unit test: Exact INR decimal balance derivation. | **Missing / Proposed** (Service logic needed) |
| **US-24 Dues reports** | BR-19 | P2 | `fees-ledger`, `audit-reporting` | `GET /api/reports/dues` | Aggregated query grouped by `academic_year_id`, `grade_level_id`, `section_id`. | Integration test: Section dues sum match. | **Missing / Proposed** (Reporting query needed) |
| **US-25 Payment history** | BR-18 | P1 | `fees-ledger` | `GET /api/students/{id}/payments` | `public.payments`, `public.payment_allocations`. Trigger: `reject_immutable_update()`. | Immutability test on payment history. | **Schema Only** (Table exists; UI missing) |
| **US-26 Concessions & adjustments** | BR-21, BR-40 | P2 | `fees-ledger` | `POST /api/fees/adjustments`, `POST /api/fees/adjustments/{id}/approve` | `public.fee_adjustments` (`adjustment_type = 'concession'`). Triggers: `validate_fee_adjustment`, `protect_approved_financial_adjustments`. | **Atomic Business Operation 3**. `integrity_tests.sql` T10 passed. | **Partially Verified (Schema/Triggers)**; RPC missing |
| **US-26A Refund & payment correction** | BR-22 | P2 | `fees-ledger` | `POST /api/fees/payments/{id}/reversal` | `public.payments` (`transaction_type = 'reversal'`). Constraint: `reverses_payment_id NOT NULL`. | **Atomic Business Operation 4**. `integrity_tests.sql` T1, T2, T3, T4 passed. | **Partially Verified (Schema/Triggers)**; RPC missing |
| **US-27 Receipt for each receipt type** | BR-24, BR-26, BR-45 | P1 | `receipts` | `POST /api/receipts/issue-number`, `GET /api/receipts/{id}` | `public.receipts`, `receipt_number_counters`. Triggers: `protect_receipt_snapshot`, `enforce_receipt_category`. | **Atomic Business Operation 5**. Defect: 4 digits padded instead of 6 (`RCT-YYYY-NNNNNN`). | **Defective Helper Present**; Fix required |
| **US-28 Final fees receipt & statement** | BR-25, BR-26, BR-46, BR-47 | P2 | `receipts` | `POST /api/receipts/final`, `GET /api/receipts/statement/{id}` | `public.consolidated_receipts`, `consolidated_receipt_items`. Triggers: `protect_receipt_snapshot`, `reject_immutable_update()`. | **Atomic Business Operation 6**. Test: Rejects final receipt if net balance > ₹0.00. | **Missing / Proposed** (Tables exist; RPC missing) |
| **US-29 Reprint documents** | BR-27 | P2 | `receipts`, `certificates-lctc` | `POST /api/receipts/{id}/reprint`, `POST /api/certificates/{id}/reprint` | `public.receipts.reprint_count`, `last_reprinted_at`, `audit_logs`. | Test: Duplicate watermark applied on reprint. | **Schema Only** (Columns exist; PDF renderer missing) |
| **US-30 Search students** | BR-28 | P1 | `student-records` | `GET /api/students` | `public.students`, `student_academic_records` (indexed on `admission_number`, `sts_number`, name). | Trigram / prefix search query test. | **Schema Only** (Indexes exist; API missing) |
| **US-31 Student profile** | BR-29 | P1 | `student-records` | `GET /api/students/{id}` | Unified view joining `students`, `guardians`, `student_academic_records`, `assessments`, `payments`. | RBAC filtering test (sensitive tab hidden for Clerk/ACC). | **Missing / Proposed** (UI/Service missing) |
| **US-32 Mark student as left** | BR-30 | P2 | `student-records` | `POST /api/students/{id}/status` | `public.student_academic_records.status = 'left' / 'transferred'`, `audit_logs`. Trigger: `prevent_hard_delete()`. | **Atomic Business Operation 8**. Test: Principal sign-off and audit log. | **Missing / Proposed** (Requires server action/RPC) |
| **US-33 Immutable records** | BR-30 | P1 | `student-records`, `shared` | Application-wide security policy | `private.prevent_hard_delete()`, `private.reject_immutable_update()`. | **US-33 AC2 Gap**: No dedicated restricted DB user provisioned in SQL scripts. | **Gap Identified** (Triggers exist; DB user missing) |
| **US-34 Pre-populate annual certificates** | BR-32 | P2 | `certificates-lctc` | `POST /api/certificates/prepopulate` | `public.student_year_certificates` (`certificate_type IN ('LC', 'TC')`, `status = 'draft'`). | Unique constraint `(student_academic_record_id, certificate_type)` test. | **Schema Only** (Table exists; Batch job missing) |
| **US-35 Review & approve TC** | BR-33, BR-36 | P2 | `certificates-lctc` | `POST /api/certificates/{id}/review`, `POST /api/certificates/{id}/approve` | `public.student_year_certificates` (`approved_by`, `approved_at`). | Test: Principal approval required; continuing student enrollment unaffected. | **Schema Only** (Table exists; Workflow missing) |
| **US-36 Generate LC/TC** | BR-34 | P2 | `certificates-lctc` | `POST /api/certificates/{id}/issue` | `public.student_year_certificates`, `certificate_versions`. Constraint: `check (status <> 'issued' OR (certificate_number IS NOT NULL AND issued_at IS NOT NULL))`. | **Atomic Business Operation 7**. Sequential `TC-YYYY-NNNN` generator. | **Missing / Proposed** (Table exists; Generator missing) |
| **US-37 Retrieve & reprint LC/TC** | BR-35 | P2 | `certificates-lctc` | `POST /api/certificates/{id}/reprint` | `public.certificate_versions`, `audit_logs`. | Test: Reprint increments version or logs reprint audit. | **Schema Only** (Table exists; UI missing) |
| **US-38 Audit log** | BR-31 | P1 | `audit-reporting` | `GET /api/audit-logs` | `public.audit_logs`. Indexes: `audit_logs_entity_idx`, `audit_logs_actor_idx`. Triggers: `prevent_hard_delete()`, `reject_immutable_update()`. | Verification: Audit entries are append-only. | **Verified Existing (Schema)**; API missing |
| **US-39 Basic dashboard** | DEL-03 | P2 | `audit-reporting` | `GET /api/dashboard/metrics` | Read-only aggregates over `sections`, `admission_applications`, `payments`. | Aggregation query test. | **Missing / Proposed** (Metrics query needed) |
| **US-40 Developer handover package** | DEL-01 | P2 | `shared` | Repository documentation, setup scripts, Dockerfile | Git repository, `README.md`, `SETUP.md`, `DEPLOYMENT_AND_OPERATIONS.md`. | Clean-machine startup verification test. | **Partially Present** (Docs exist; Dockerfile missing) |
| **US-41 Synthetic demo data** | DEL-02 | P1 | `infrastructure` | Supabase seed runner | `supabase/seed.sql` (255 synthetic rows across 31 tables). | `verification.sql` executed on seed data. | **Verified Existing (Seed)** |
| **US-42 Seat limits** | BR-38 | P2 | `admissions` | `POST /api/admissions/applications/{id}/approve` | `public.sections.max_capacity`. | Negative test: Approval rejected when section count >= max_capacity. | **Missing / Proposed** (Capacity column exists; Trigger/Gate missing) |
| **US-43 Year-end fee closure** | BR-39 | None | N/A | None | Withdrawn by signed CR-001 (SRS §10). Strict annual isolation retained; zero automatic balance sweep. | N/A | **Withdrawn (Out of Scope)** |

---

## 3. Summary of Traceability Findings

1. **43 Active Stories Tracked:**
   - **Verified Existing in Database (Schema/Triggers):** 7 stories (`US-08`, `US-10`, `US-18`, `US-20`, `US-21`, `US-26`, `US-26A`, `US-38`, `US-41`).
   - **Schema Only (Missing UI / API / Service Layer):** 21 stories.
   - **Missing Core Business Operations / Numbering:** 14 stories.
   - **Withdrawn:** 1 story (`US-43`).
2. **Critical Gaps Requiring Immediate Architectural Specification:**
   - **US-33 AC2:** Missing restricted application database role in migrations.
   - **US-27 AC2:** Receipt number generator pads 4 digits (`RCT-YYYY-NNNN`) instead of required 6 digits (`RCT-YYYY-NNNNNN`).
   - **8 Atomic Business Operations:** Zero complete business workflows currently exist as atomic database procedures. All 8 require explicit transaction specifications.
