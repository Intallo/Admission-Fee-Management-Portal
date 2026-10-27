# Database Schema & Data Inventory (Milestone M0.4)

**Document Code:** M0.4 — Database Schema & Data Inventory  
**Task Owner:** Ujwal (Admissions & Student Records Owner)  
**Reviewer:** Shashidhar (Project Lead & Architecture Owner)  
**Inspection Type:** Strictly Read-Only Discovery  
**Baseline Commit:** `5e1c47e` (and hardening migration `20261022090000`)  
**Database Safety Attestation:** Zero database writes, resets, migrations, or reseed operations were performed against the retained database. No real student, parent, or financial records are contained in this inventory.  

---

## 1. Executive Summary & Verification Method

This document provides a factual, read-only inventory of the existing PostgreSQL/Supabase database schema supporting the School Admission & Fee Management Portal. It establishes:
1. All 31 tables in the `public` schema with their primary keys, columns, foreign keys, and integrity constraints.
2. The 14 custom PostgreSQL ENUM types.
3. The 16 automated functions and triggers enforcing data immutability, audit logging, and financial ledger rules.
4. The Row-Level Security (RLS) architecture and access control configuration.
5. Migration history and alignment against signed BRD v1.4 and SRS v1.4.
6. A clear separation between **observed database facts** and **unimplemented application requirements / open decisions**.

---

## 2. Table-by-Table Schema Inventory (31 Tables)

### Group A: Academic Calendar & School Structure
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `academic_years` | 8 | `id (uuid)` | None | Defines annual boundaries (`start_date`, `end_date`), state (`planning`, `current`, `closed`). Enforces one active year at a time via partial unique index. |
| `grade_levels` | 8 | `id (uuid)` | None | Standards/grades from Nursery through Standard 10. Grouped into `pre_primary`, `primary`, `high_school`. |
| `sections` | 7 | `id (uuid)` | `academic_year_id`, `grade_level_id` | Class sections (e.g. Standard 1 Section A) per year with `max_capacity` (default 40). |
| `transport_rates` | 8 | `id (uuid)` | `academic_year_id` | Annual vehicle place tariffs (`place_label`, `amount`, `mode`, `is_active`). |

### Group B: Identity & Staff Directory
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `staff_members` | 8 | `id (uuid)` | `auth_user_id -> auth.users` | Directory of school staff profiles. Role enum (`system_admin`, `principal`, `admission_officer`, `clerk`, `accountant`, `read_only`). `auth_user_id` is nullable (unlinked until Supabase Auth user is created). |

### Group C: Students, Guardians & Personal Records
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `students` | 14 | `id (uuid)` | None | Master student demographic record (`first_name`, `last_name`, `date_of_birth`, `gender`, `email`, `phone`, `city`, `state`, `postal_code`, `is_active`). |
| `guardians` | 11 | `id (uuid)` | None | Parent/guardian directory (`full_name`, `relationship_to_student`, `phone`, `email`, `occupation`, address). |
| `student_guardians` | 6 | Composite `(student_id, guardian_id)` | `student_id`, `guardian_id` | Junction mapping students to guardians with `is_primary_contact` and `can_collect_student`. |
| `student_sensitive_details` | 7 | `student_id (uuid)` | `student_id -> students` | Dedicated 1:1 table for sensitive fields: `aadhaar_encrypted`, `aadhaar_last_four`, `annual_family_income`, `caste`, `sub_caste`. Separated from `students` to facilitate field-level access control. |
| `student_academic_records` | 13 | `id (uuid)` | `student_id`, `academic_year_id`, `grade_level_id`, `section_id` | Year-specific student enrollment record. Holds `admission_number`, `roll_number`, `status` (`admitted`, `active`, `left`), `transport_opted_in`. Unique `(student_id, academic_year_id)` ensures year isolation. |
| `student_transport_assignments` | 7 | `id (uuid)` | `student_academic_record_id`, `transport_rate_id` | Links student year record to active vehicle place/tariff for transportation fee billing. |

### Group D: Admissions Workflow & Document Management
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `admission_applications` | 16 | `id (uuid)` | `academic_year_id`, `student_id`, `requested_grade_level_id`, `requested_section_id`, `created_by`, `reviewed_by` | Admission application lifecycle record. Unique `application_number`. Status: `draft`, `submitted`, `under_review`, `on_hold`, `approved`, `rejected`, `withdrawn`. Holds `seat_reserved_until` and `decision_reason`. |
| `admission_status_history` | 7 | `id (uuid)` | `admission_application_id`, `changed_by` | Immutable audit log of all admission status transitions (`from_status` -> `to_status`, timestamp, actor, reason). |
| `document_types` | 7 | `id (uuid)` | None | Catalog of acceptable documents (Birth Certificate, Transfer Certificate, Aadhaar, Caste Certificate, Previous Report Card). |
| `document_requirements` | 8 | `id (uuid)` | `academic_year_id`, `grade_level_id`, `document_type_id` | Configurable checklist defining which documents are required vs optional per grade level and year. |
| `student_documents` | 18 | `id (uuid)` | `student_id`, `admission_application_id`, `student_academic_record_id`, `document_type_id`, `uploaded_by`, `reviewed_by` | Document upload metadata. Stores `storage_bucket`, `storage_object_key`, `original_filename`, `file_size_bytes`, `mime_type`, `verification_status` (`pending`, `verified`, `rejected`, `replaced`). |

### Group E: Fee Configuration & Assessment
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `fee_heads` | 10 | `id (uuid)` | None | Catalog of fee heads. Categorized by `fee_category` (`school_fee`, `vehicle`, `books`). Classified by `is_variable` (e.g. Admission Fee) and `is_optional` (e.g. Transport, Books). |
| `fee_structures` | 11 | `id (uuid)` | `academic_year_id`, `grade_level_id`, `created_by`, `approved_by` | Annual fee schedule container per standard. Status: `draft`, `pending_approval`, `approved`, `retired`. Versioned. |
| `fee_structure_lines` | 7 | `id (uuid)` | `fee_structure_id`, `fee_head_id` | Component amounts within a fee structure (e.g. Tuition Fee ₹25,000, Term Fee ₹5,000). |
| `student_fee_assessments` | 11 | `id (uuid)` | `student_academic_record_id`, `fee_structure_id`, `issued_by` | Student's annual fee billing statement. Unique `assessment_number`. Status: `draft`, `issued`, `cancelled`. Holds complete `snapshot JSONB`. |
| `student_fee_assessment_lines` | 6 | `id (uuid)` | `student_fee_assessment_id`, `fee_head_id` | Itemized billed amount per fee head for a student. Serves as the target line for payments and concessions. |

### Group F: Payments, Ledger & Receipts
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `payments` | 14 | `id (uuid)` | `student_academic_record_id`, `recorded_by`, `reverses_payment_id -> payments` | Master transaction record. Stores `amount`, `currency` (INR), `method` (`cash`, `cheque`, `bank_transfer`, `upi_manual`), `transaction_type` (`collection`, `refund`, `reversal`), `payer_name`, `payer_contact`. Immutable post-insert. |
| `payment_allocations` | 5 | `id (uuid)` | `payment_id`, `student_fee_assessment_line_id` | Allocation lines splitting a payment across specific assessed fee heads. Immutable post-insert. |
| `fee_adjustments` | 11 | `id (uuid)` | `student_fee_assessment_line_id`, `requested_by`, `approved_by` | Approved adjustments modifying billed dues (`concession`, `additional_charge`, `correction`). Frozen post-approval. |
| `receipts` | 13 | `id (uuid)` | `payment_id`, `issued_by` | Individual numbered receipt per recorded payment. Unique `receipt_number`. Stores `rendered_snapshot JSONB`, `pdf_storage_object_key`, `reprint_count`, `last_reprinted_at`. |
| `receipt_number_counters` | 3 | `series_code (text)` | None | Sequence counters maintaining gapless monotonic numbering (e.g. `RCT` series). |
| `consolidated_receipts` | 10 | `id (uuid)` | `student_academic_record_id`, `generated_by` | Final fees receipt issued only when all dues are ₹0.00. Holds `rendered_snapshot JSONB` and signatures. |
| `consolidated_receipt_items` | 7 | `id (uuid)` | `consolidated_receipt_id`, `receipt_id` | References to the individual payment receipts summarized within the consolidated receipt. |

### Group G: Certificates (LC/TC) & System Audit
| Table Name | Col Count | Primary Key | Key Foreign Keys | Purpose & Business Scope |
|---|:---:|---|---|---|
| `student_year_certificates` | 11 | `id (uuid)` | `student_academic_record_id`, `approved_by`, `generated_by` | Annual certificate registry record. `certificate_type` (`LC`, `TC`). Unique `certificate_number`. Status: `draft`, `issued`, `cancelled`. |
| `certificate_versions` | 11 | `id (uuid)` | `student_year_certificate_id`, `generated_by`, `approved_by` | Immutable version snapshot of each generated certificate PDF with `content_snapshot JSONB` and reissue reasons. |
| `audit_logs` | 10 | `id (uuid)` | `actor_staff_id -> staff_members` | System-wide append-only audit trail (`entity_type`, `entity_id`, `action`, `before_snapshot`, `after_snapshot`, `outcome`, `reason`). |

---

## 3. Custom PostgreSQL Enums (14 Types)

The database defines 14 domain-specific enumeration types:
1. `academic_year_state`: `planning`, `current`, `closed`
2. `staff_role`: `system_admin`, `principal`, `admission_officer`, `clerk`, `accountant`, `read_only`
3. `grade_group`: `pre_primary`, `primary`, `high_school`
4. `admission_application_status`: `draft`, `submitted`, `under_review`, `on_hold`, `approved`, `rejected`, `withdrawn`
5. `student_year_status`: `admitted`, `active`, `left`
6. `document_verification_status`: `pending`, `verified`, `rejected`, `replaced`
7. `fee_category`: `school_fee`, `vehicle`, `books`
8. `fee_structure_state`: `draft`, `pending_approval`, `approved`, `retired`
9. `assessment_state`: `draft`, `issued`, `cancelled`
10. `adjustment_kind`: `concession`, `additional_charge`, `correction`
11. `approval_state`: `pending`, `approved`, `rejected`
12. `payment_kind`: `collection`, `refund`, `reversal`
13. `payment_method`: `cash`, `cheque`, `bank_transfer`, `upi_manual`, `other`
14. `certificate_kind`: `LC`, `TC` and `certificate_state`: `draft`, `issued`, `cancelled`

---

## 4. Trigger & Function Architecture (16 Functions & Triggers)

The schema implements active server-side business integrity via database triggers in the `private` schema:

| Function Name | Attached Trigger(s) | Business Rule Enforced |
|---|---|---|
| `private.set_updated_at()` | 17 tables | Automatically sets `updated_at = clock_timestamp()` before row update. |
| `private.prevent_hard_delete()` | 21 core tables | Intercepts `BEFORE DELETE` and raises exception: `Hard deletes are prohibited on public.<table_name>`. (Satisfies SBR-04, NFR-09). |
| `private.reject_immutable_update()` | `payments`, `payment_allocations`, `consolidated_receipt_items`, `certificate_versions`, `audit_logs` | Blocks `UPDATE` queries on committed financial and audit rows. (Satisfies SBR-04, US-33). |
| `private.protect_receipt_snapshot()` | `receipts`, `consolidated_receipts` | Blocks changes to issued receipt snapshots; permits only reprint metadata updates (`reprint_count`, `last_reprinted_at`). (Satisfies BR-27, US-29). |
| `private.protect_approved_financial_adjustments()` | `fee_adjustments` | Freezes adjustments once `status = 'approved'`. (Satisfies BR-21, BR-40). |
| `private.protect_issued_assessment()` | `student_fee_assessments` | Freezes assessment header once `status = 'issued'`. |
| `private.protect_assessment_lines()` | `student_fee_assessment_lines` | Blocks modifications to itemized fee lines once the parent assessment is issued. |
| `private.protect_fee_structure_lines()` | `fee_structure_lines` | Blocks modifications to fee structure lines once the parent fee structure is approved. |
| `private.validate_payment_allocation()` | `payment_allocations` | Validates that allocations do not exceed assessed balances for collections; enforces reversal and refund allocation limits. (Satisfies SBR-06, BR-42). |
| `private.assert_payment_allocation_sum()` | `payment_allocations` | Constraint trigger validating that allocation lines sum up exactly to `payments.amount`. (Satisfies NFR-11). |
| `private.enforce_single_category_per_payment()` | `payment_allocations` | Enforces that all fee heads allocated within a single payment belong to the exact same `fee_category`. (Satisfies BR-17). |
| `private.enforce_receipt_category()` | `receipts` | Verifies that the receipt's category matches the payment's category. |
| `private.validate_fee_adjustment()` | `fee_adjustments` | Verifies concession amounts do not exceed the net assessed head fee. |
| `private.validate_assessment_matches_record()` | `student_fee_assessments` | Ensures academic record and fee structure belongs to the same academic year and grade level. |
| `private.validate_document_owner()` | `student_documents` | Validates foreign key consistency between student ID, admission application, and academic record. |
| `private.next_receipt_number()` / `public.issue_receipt_number()` | Receipt sequence generator | Manages monotonic sequential counter in `receipt_number_counters` with row-level lock (`FOR UPDATE`). |

---

## 5. Row-Level Security (RLS) Configuration

### Observed Fact
1. **RLS is enabled across all 31 public tables:**
   Executed dynamically via `pg_tables` iteration:
   ```sql
   alter table public.<table_name> enable row level security;
   ```
2. **Permissions Revoked:**
   All privileges on schema `public` tables and sequences are explicitly revoked from `public`, `anon`, and `authenticated`:
   ```sql
   revoke all on all tables in schema public from public, anon, authenticated;
   revoke all on all sequences in schema public from public, anon, authenticated;
   ```
3. **Privileges Granted to Service Role:**
   Full usage and CRUD permissions are granted strictly to `service_role`.
4. **Current Policy State:**
   **Zero browser-facing RLS policies (`CREATE POLICY`) currently exist.** The database is deliberately designed in a **fail-closed** configuration. Browser clients connecting directly via Supabase Auth anon/authenticated tokens will receive permission denied on all tables.

### Future Architecture Implication (Gaps to M3.2)
- All database operations in the current project baseline must be executed by trusted server-side services using the Supabase `service_role` key.
- Once user login and session handling are built (Milestone M3.2), role-based RLS policies must be authored to grant granular read/write access based on the verified `staff_role` of the authenticated user.

---

## 6. Migration History & BRD/SRS Alignment

| Migration File | Timestamp | Description | Alignment with Signed BRD/SRS |
|---|---|---|---|
| `20261016182749_init_admission_fee_management_schema.sql` | 2026-10-16 18:27:49 | Core schema: 31 tables, 14 enums, soft-delete triggers, updated_at triggers, RLS activation. | Lays foundational schema for Modules 1 through 10. |
| `20261016183014_enforce_financial_integrity_and_indexes.sql` | 2026-10-16 18:30:14 | Financial integrity triggers (allocation sums, allocation bounds, immutability) and 40+ indexes. | Implements SBR-03, SBR-04, NFR-05, NFR-11 (exact money, ledger immutability). |
| `20261016183124_seed_synthetic_admission_fee_demo_data.sql` | 2026-10-16 18:31:24 | Synthetic demo seed linking academic years, grades, sections, staff, students, fee structures, and receipts. | Fulfills US-41 (Demo data) and enables isolated reproducible verification. |
| `20261022090000_harden_financial_integrity.sql` | 2026-10-22 09:00:00 | Hardening pass post-BRD/SRS v1.4 approval: single-category payments, frozen assessments, receipt numbering. | Implements BR-17, BR-22, SBR-06, SBR-07, SBR-08. |

---

## 7. Gaps Between Database and Required Application Behavior

| # | System Area | Observed Database Fact | Required Application Behavior (SRS v1.4) | Architectural Resolution |
|---|---|---|---|---|
| **1** | **Client Access & RLS** | All tables are fail-closed; 0 client RLS policies exist. | Office staff log in and access filtered screens based on their assigned role (`Principal`, `ADM`, `ACC`). | Server-side API mediation via `service_role` (modular monolith) OR authoring Supabase RLS policies in Milestone M3.2. |
| **2** | **Seat Capacity Gate** | `sections` has `max_capacity`; no DB trigger blocks `admission_applications.status = 'approved'` when capacity is reached. | BR-38 / US-42 requires approval to be blocked when capacity is reached. | Application-level validation guard during Principal approval workflow (Milestone M4.2), pending Open Item #7 resolution. |
| **3** | **Staff Roles Alignment** | DB `staff_role` enum includes `clerk`, `accountant`, `system_admin`, `principal`, `admission_officer`, `read_only`. | SRS v1.4 specifies 4 user classes: `Principal`, `ADM`, `ACC`, and `SYSADMIN` (to confirm). | Map `clerk` -> `ADM`, `accountant` -> `ACC`, or align enum in a future approved migration task. |
| **4** | **Document Storage** | `student_documents` stores bucket name and object key. | NFR-02 requires files stored in private storage and accessed via authorized temporary presigned URLs. | Configure Supabase Storage bucket `admission-documents` as private; implement presigned URL signing in `documents` module (M4.3). |
| **5** | **Receipt & Certificate Rendering** | DB tables store `rendered_snapshot JSONB` and `pdf_storage_object_key`. | Official A4/A5 PDF receipts and certificates must be rendered with school letterhead, signatures, and stamps. | Implement server-side PDF generator service using Client-supplied high-resolution letterhead assets (Milestones M6.2, M6.3). |

---

## 8. Unresolved Technical & Data-Integrity Questions

1. **Staff Bootstrap & Password Lifecycle (Open Item #15):** The seeded staff rows have `auth_user_id IS NULL`. A secure bootstrap script is needed to invite/provision real staff in `auth.users` without exposing passwords in git.
2. **Admission Number Uniqueness Scope (Open Item #5 & SBR-01):** `student_academic_records.admission_number` is populated upon admission approval. Client confirmation is required on whether admission numbers are scoped annually or permanently across the institution.
3. **Seat Capacity Scope (Open Item #7):** Clarification is needed on whether the 100-seat cap in SRS US-42 applies per section, per standard (grade level), or for the entire pre-primary section.

---

## 9. Read-Only Attestation & Sign-Off

- **Inspection Date:** 2026-10-26
- **Attestation:** All findings in this inventory are based on direct inspection of repository migration files, generated TypeScript database types (`src/types/database.types.ts`), and seed definitions.
- **Safety Compliance:** No `supabase db reset`, migrations, seed operations, or tests were executed against the retained database. Baseline commit `5e1c47e` remains pristine.
- **Delivered by:** Ujwal (Admissions & Student Records Owner)  
- **Submitted for Review to:** Shashidhar (Project Lead & Architecture Owner)
