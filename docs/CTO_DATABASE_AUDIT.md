# Database & Security Audit Report (Phase 1)

**Document Code:** CTO-DB-AUDIT-PHASE1  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Baseline References:** Signed BRD v1.4, Signed SRS v1.4, Git Baseline `5e1c47e`, Hardening Migration `20261022090000`, M0.4 Schema Inventory  
**Auditor:** Senior Software Engineer (Implementation Owner)  
**Reviewed by:** CTO (ChatGPT)  
**Database Safety Boundary:** Strictly Read-Only static repository analysis; zero writes, resets, migrations, or data mutations performed against retained database (`fjrfyzamiirqzitdchkz`).

---

## 1. Executive Summary & Audit Methodology

This report provides a formal, evidence-based architectural audit of the current database migrations (`supabase/migrations/`), SQL test harnesses (`supabase/tests/`), and data dictionary to establish an authoritative baseline for Phase 1.

### 1.1 Methodology
1. **Source Inspection:** Static parsing and verification of all in-tree migration scripts (`20261016182749`, `20261016183014`, `20261016183124`, `20261022090000`), SQL test scripts (`integrity_tests.sql`, `verification.sql`), and generated TypeScript schema types (`src/types/database.types.ts`).
2. **Environment & Safety Isolation:** No connection was made to mutate, reset, reseed, or alter the retained remote database (`fjrfyzamiirqzitdchkz`).
3. **Core Questions Addressed:**
   - Full inventory of tables, constraints, indexes, triggers, and functions.
   - Comprehensive audit of database roles, privileges, and RLS state.
   - Objective determination of whether **US-33 AC2** (restricted application DB user) is satisfied.
   - Verification of the **eight required atomic business operations**.
   - Audit of identifier numbering generators and formats against signed SRS v1.4.
   - Identification of all schema gaps and necessary remediation tasks.

---

## 2. Comprehensive Schema Inventory

The current database defines **31 tables** across the `public` schema and **1 table** in the `private` schema, governed by **16 custom enumerations**.

### 2.1 Table Inventory by Domain

| Domain | Table Name | PK Type | Primary Purpose | RLS State | Soft Delete / Immutability Trigger |
|---|---|:---:|---|:---:|---|
| **Identity & Access** | `public.staff_members` | `uuid` | Staff directory & role assignment linked to `auth.users` | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| **Academic Structure** | `public.academic_years` | `uuid` | Annual academic calendars (planning, current, closed) | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.grade_levels` | `uuid` | Academic grades (Nursery through STD 10) | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.sections` | `uuid` | Class sections with seat capacity controls | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| **Students & Guardians** | `public.students` | `uuid` | Core student demographic record | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.guardians` | `uuid` | Parent and guardian records | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.student_guardians` | `uuid` | M:N student-to-guardian mapping with primary contact flag | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.student_sensitive_details` | `uuid` | Isolated demographic PII (Aadhaar, income, caste) | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.student_academic_records` | `uuid` | Student enrollment scoped to a single academic year | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.student_transport_assignments` | `uuid` | Student opt-in to transport routes | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| **Admissions & Documents** | `public.admission_applications` | `uuid` | Admission lifecycle applications | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.admission_status_history` | `uuid` | Append-only application status transition log | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()` |
| | `public.document_types` | `uuid` | Master catalog of verifiable documents | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.document_requirements` | `uuid` | Mandatory/optional checklist rules per grade | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.student_documents` | `uuid` | Metadata references to stored student files | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| **Fee Configuration** | `public.fee_heads` | `uuid` | Ledger fee categories (`school_fee`, `vehicle`, `books`) | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.fee_structures` | `uuid` | Annual standard fee schedules | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.fee_structure_lines` | `uuid` | Itemized fee head amounts per schedule | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_fee_structure_lines()` |
| | `public.transport_rates` | `uuid` | Vehicle tariff rates by place and vehicle type | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| **Fees & Ledger** | `public.student_fee_assessments` | `uuid` | Student annual billing statement header | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_issued_assessment()` |
| | `public.student_fee_assessment_lines` | `uuid` | Itemized billed fee heads per student | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_assessment_lines()` |
| | `public.payments` | `uuid` | Immutable offline collection/reversal header | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()` |
| | `public.payment_allocations` | `uuid` | Payment distribution across assessment lines | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()`, `validate_payment_allocation()`, `assert_payment_allocation_sum()` |
| | `public.fee_adjustments` | `uuid` | Concessions, waivers, and correction adjustments | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_approved_financial_adjustments()`, `validate_fee_adjustment()` |
| **Receipts** | `public.receipts` | `uuid` | Numbered payment receipt headers with rendered snapshots | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_receipt_snapshot()`, `enforce_receipt_category()` |
| | `public.consolidated_receipts` | `uuid` | Full-year Final Fees Receipt header (zero dues) | Enabled (Fail-Closed) | `prevent_hard_delete()`, `protect_receipt_snapshot()` |
| | `public.consolidated_receipt_items` | `uuid` | Junction binding individual receipts into final receipt | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()` |
| | `public.receipt_number_counters` | `text` (PK: `series_code`) | State table for atomic monotonic receipt sequence | Enabled (Fail-Closed) | Mutated via `private.next_receipt_number()` with row locks |
| **Certificates & Audit** | `public.student_year_certificates` | `uuid` | Annual Leaving/Transfer certificate header | Enabled (Fail-Closed) | `prevent_hard_delete()` |
| | `public.certificate_versions` | `uuid` | Immutable version snapshots of released certificate PDFs | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()` |
| | `public.audit_logs` | `uuid` | Append-only system-wide security & data audit trail | Enabled (Fail-Closed) | `prevent_hard_delete()`, `reject_immutable_update()` |

---

## 3. Database Privileges, Roles & US-33 AC2 Compliance Evaluation

### 3.1 Observed Grants and Privileges

In `20261016182749_init_admission_fee_management_schema.sql` (lines 588–591):
```sql
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
```

In `20261022090000_harden_financial_integrity.sql` (lines 429–430):
```sql
revoke all on function public.issue_receipt_number(text) from public, anon, authenticated;
grant execute on function public.issue_receipt_number(text) to service_role;
```

### 3.2 Evaluation of US-33 AC2

**Signed Requirement (SRS v1.4 US-33 AC2):**
> *"The database scripts create an application database user that has no DELETE permission on core tables and no UPDATE permission on the payment ledger, receipts, and audit log, and the setup guide tells the deployer to use it."*

**Audit Findings & Precise Evidence:**
1. **Absence of Application Role:** There is **no SQL script or migration** that creates a dedicated application database user (e.g. `school_app_user` or `school_backend`).
2. **Blanket Privileges Granted to `service_role`:** All tables, sequences, and procedures are granted `ALL` exclusively to `service_role`. In Supabase/PostgreSQL, `service_role` possesses administrative bypass privileges over Row Level Security.
3. **Procedural vs. Privilege Boundary:** The current codebase enforces immutability **procedurally via triggers** (`private.prevent_hard_delete()`, `private.reject_immutable_update()`). While these triggers effectively abort `DELETE` and `UPDATE` statements if executed under standard roles, **US-33 AC2 explicitly mandates privilege-level restriction** (SQL `GRANT`/`REVOKE` permissions at the database user level).
4. **Missing Negative Role Permission Tests:** The existing test harness (`supabase/tests/integrity_tests.sql`) runs entirely under the table owner / superuser context. It contains zero tests proving that an application user connection receives a PostgreSQL error `42501 permission denied for table ...` when attempting `DELETE` or unauthorized `UPDATE`.

**Conclusion on US-33 AC2:**
**US-33 AC2 is NOT satisfied in the current database migrations.**
*Remediation Plan:* In Phase 2 / Milestone M2.3, a migration must be introduced to provision a restricted PostgreSQL role (e.g., `school_app_user`) with `NOLOGIN` or dedicated credentials, granting:
- `SELECT`, `INSERT`, `UPDATE` on mutable tables (`students`, `guardians`, `admission_applications`, `sections`, etc.).
- `SELECT`, `INSERT` (NO `UPDATE`, NO `DELETE`) on ledger tables (`payments`, `payment_allocations`, `receipts`, `consolidated_receipts`, `audit_logs`).
- `ZERO DELETE` privileges across all 21 protected core tables.

---

## 4. Audit of the Eight Required Atomic Business Operations

The signed SRS specifies eight mission-critical business transactions that require atomic database boundaries. The table below evaluates their presence in the current SQL baseline:

| # | Business Operation | Signed SRS Story | Expected Transaction Boundary | Current DB State | Technical Evidence & Gap Analysis |
|---|---|---|---|:---:|---|
| **1** | **Admission Approval** | US-15 | Atomically validate section capacity, update `admission_applications.status = 'approved'`, generate `admission_number` (`ADM-YYYY-NNNN`), create `students` row (if intake), create `student_academic_records`, generate `student_fee_assessments` and lines from approved fee structure, and write `audit_logs`. | **MISSING** | No stored procedure or RPC exists. Currently requires multi-step external application logic with no single database transaction boundary. |
| **2** | **Payment Recording** | US-21 | Atomically insert `payments`, allocate across `payment_allocations`, ensure single fee category, verify allocation sum == payment amount, call monotonic receipt generator, insert `receipts` with `rendered_snapshot`, and write `audit_logs`. | **MISSING** | Individual trigger constraints exist (`validate_payment_allocation`, `assert_payment_allocation_sum`, `enforce_single_category_per_payment`), but **no complete atomic transaction function/RPC exists**. Separate REST calls leave transactions vulnerable to partial writes. |
| **3** | **Fee Adjustment Approval** | US-26 | Atomically verify Principal role authority, check concession <= net remaining dues, update `fee_adjustments.status = 'approved'`, freeze adjustment record, and write `audit_logs`. | **MISSING** | Triggers `validate_fee_adjustment` and `protect_approved_financial_adjustments` exist, but no atomic approval RPC exists to enforce Principal identity and log audit events atomically. |
| **4** | **Payment Reversal** | US-26A | Atomically verify Principal authorization, insert reversal `payments` referencing original collection, create offsetting negative `payment_allocations`, recalculate dues, update receipt references, and write `audit_logs`. | **MISSING** | Constraints enforce `reverses_payment_id` rules, but no stored procedure orchestrates the atomic reversal workflow. |
| **5** | **Receipt Number Issuance** | SBR-07, US-27 | Atomic row-locked fetch-and-increment on sequence counter without gaps or collisions. | **PARTIALLY PRESENT** *(Defective)* | `private.next_receipt_number()` and `public.issue_receipt_number()` exist with `SELECT ... FOR UPDATE` semantics. **However, it formats numbers with 4 digits (`lpad(n::text, 4, '0')`) instead of the required 6 digits (`lpad(n::text, 6, '0')`).** Furthermore, it is a helper function, not a complete business operation. |
| **6** | **Final Receipt Issuance** | US-28 | Atomically verify student dues == ₹0.00 across all fee heads, gather all prior receipt IDs, generate next unified receipt number, insert `consolidated_receipts` with JSON snapshot, populate `consolidated_receipt_items`, and write `audit_logs`. | **MISSING** | Schema tables exist (`consolidated_receipts`, `consolidated_receipt_items`), but zero stored procedures or atomic functions exist to validate zero dues and execute issuance. |
| **7** | **Certificate Issuance** | US-36 | Atomically verify Principal approval, generate next sequential `certificate_number` (`TC-YYYY-NNNN`), create immutable `certificate_versions` snapshot, update `student_year_certificates.status = 'issued'`, and write `audit_logs`. | **MISSING** | Tables exist, but no stored procedure exists to execute issuance atomically or sequence certificate numbers. |
| **8** | **Student-Left Status Change** | US-32 | Atomically verify Principal authority, update `student_academic_records.status = 'left'` or `'transferred'`, record exit reason and date, and record immutable `audit_logs`. | **MISSING** | No stored procedure or atomic function exists. Relies on unbundled SQL queries. |

**Audit Conclusion on Atomic Operations:**
**0 out of 8 complete business operations exist as atomic database procedures.** Only one helper function (`issue_receipt_number`) exists, and it contains an identifier formatting defect.

---

## 5. Identifier Formats & SQL Implementation Audit

| Identifier Name | Signed SRS Specification | Current Implementation in SQL | Discrepancy & Required Fix |
|---|---|---|---|
| **Application Number** | `161/2026-27` (Sequential within standard/year + academic year label) | Column `admission_applications.application_number` exists (`text unique`). **Zero database generation logic.** | Application must format string as `{sequence}/{academic_year_label}`. Must be sequenced atomically per academic year. |
| **Admission Number** | `ADM-YYYY-NNNN` (e.g. `ADM-2026-0001`) | Column `student_academic_records.admission_number` exists (`text`). **Zero database generation logic.** | Application must format string as `ADM-{YYYY}-{NNNN}` with 4 zero-padded digits from a monotonic sequence. |
| **Receipt Number** | `RCT-YYYY-NNNNNN` (e.g. `RCT-2026-000001`, **6 digits**) | `private.next_receipt_number()` in `20261022090000_harden_financial_integrity.sql:416`: `p_series \|\| '-' \|\| to_char(...) \|\| '-' \|\| lpad(n::text, 4, '0')` | **CRITICAL DEFECT:** SQL pads only **4 digits** (`RCT-YYYY-NNNN`), directly violating SRS §3 A-10 and US-27 AC2. **Fix Required:** Change `lpad(n::text, 4, '0')` to `lpad(n::text, 6, '0')`. |
| **Certificate Number** | `TC-YYYY-NNNN` (e.g. `TC-2026-0001`) | Column `student_year_certificates.certificate_number` exists (`text unique`). **Zero database generation logic.** | Must format string as `TC-{YYYY}-{NNNN}` with 4 zero-padded digits from a monotonic sequence counter table. |

---

## 6. Storage Buckets and Private Storage Policies

1. **Observed Tables:** `student_documents` (column `storage_bucket text default 'admission-documents'`), `receipts` (column `pdf_storage_bucket text default 'receipts'`), `certificate_versions` (column `pdf_storage_bucket text default 'certificates'`).
2. **Storage Migration Status:** The `supabase/migrations/` directory contains **zero storage configuration SQL** (`insert into storage.buckets...`).
3. **Storage Policies:** There are **zero storage RLS policies** (`storage.objects`) authored in the repository.
4. **Architectural Requirement:** All 3 buckets (`admission-documents`, `receipts`, `certificates`) must be configured as `public = false`. File access must be brokered exclusively via server-generated signed URLs (maximum 900 seconds expiry) following RBAC and record-scope verification.

---

## 7. Protections Against Hard Deletes and Tampering

### 7.1 Hard Delete Protection
The database defines `private.prevent_hard_delete()` and attaches it as a `BEFORE DELETE` trigger on **21 tables**:
- `staff_members`, `academic_years`, `grade_levels`, `sections`, `students`, `guardians`, `student_guardians`, `student_sensitive_details`, `student_academic_records`, `student_transport_assignments`, `admission_applications`, `admission_status_history`, `document_types`, `document_requirements`, `student_documents`, `fee_heads`, `fee_structures`, `transport_rates`, `student_fee_assessments`, `payments`, `receipts`, `consolidated_receipts`, `student_year_certificates`, `audit_logs`.
- **Trigger Behavior:** Throws exception `'Physical deletion is not permitted for % table. Use soft-delete / status flags instead.'` with SQLSTATE `23514`. This invariant is robustly enforced.

### 7.2 Immutability Triggers on Financial & Audit Records
Attached as `BEFORE UPDATE` triggers via `private.reject_immutable_update()`:
- `payments`, `payment_allocations`, `consolidated_receipt_items`, `certificate_versions`, `audit_logs`.
- Throws exception `'Updates are prohibited on % table. Records are append-only / immutable.'` with SQLSTATE `23514`.

### 7.3 Snapshot Protection on Issued Receipts
Attached via `private.protect_receipt_snapshot()`:
- `receipts` and `consolidated_receipts`.
- Rejects any update attempting to alter `rendered_snapshot`, `receipt_number`, `student_academic_record_id`, or `payment_id`.
- Permits strictly incrementing `reprint_count` and timestamping `last_reprinted_at`.

---

## 8. Summary of Gaps & Remediation Backlog

1. **G-01 (US-33 AC2):** Create a dedicated, restricted PostgreSQL application role (`school_app_user`) that has zero `DELETE` privileges and zero `UPDATE` privileges on the ledger.
2. **G-02 (Receipt Number Padding):** Modify `private.next_receipt_number()` to pad 6 digits (`lpad(n::text, 6, '0')`) to generate `RCT-YYYY-NNNNNN`.
3. **G-03 (Atomic Financial Operations):** Author PostgreSQL stored procedures / transactional services for the 8 core atomic business workflows.
4. **G-04 (Storage Buckets):** Define private bucket provisioning and presigned URL access mechanisms.
5. **G-05 (Negative Testing Suite):** Add SQL/Vitest test suites executing under non-superuser application credentials to prove US-33 AC2 least-privilege enforcement.
