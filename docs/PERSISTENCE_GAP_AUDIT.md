# Persistence Gap Audit & State Durability Architecture

**Document Reference:** PERSISTENCE-GAP-AUDIT-P8-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Authority:** CTO Directive — Phase 8 (Durable Persistence & Runtime Least-Privilege Remediation)  
**Date:** 01 November 2026  
**Status:** **AUTHORITATIVE BASELINE & REMEDIATION PLAN**

---

## 1. Executive Summary

This audit provides a comprehensive, evidence-based review of data persistence, state durability, transaction boundaries, and runtime security across all 10 domain services in the codebase.

### Core Audit Diagnosis:
In Phases 1 through 7, domain services were engineered with robust internal business rules, decimal monetary math, and Zod validation, but relied on **process-local JavaScript `Map` and `Array` vaults** protected by in-process async locks. Database calls to PostgreSQL were either non-existent or wrapped in non-blocking fire-and-forget `try/catch` blocks.

**Critical Risks Confirmed by CTO:**
1. **Finding F-01 (Persistence Failure):** Process restart immediately loses all recorded payments, payment allocations, fee adjustments, receipts, certificate records/versions, draft admissions, and audit events. Multi-instance / clustered deployments diverge instantly.
2. **Finding F-02 (Runtime Privilege Mismatch):** The application database client used `SUPABASE_SERVICE_ROLE_KEY` (Supabase `service_role` superuser bypass), bypassing the `school_app_user` least-privilege boundary. Furthermore, PostgreSQL tables had RLS enabled with zero policies, meaning any non-superuser connection would be rejected (fail-closed).
3. **Finding F-03 (Storage Buckets):** Resolved in commit `fc5f2e3` with migration `20261101000000_provision_private_storage_buckets.sql`.

---

## 2. Module-by-Module Persistence Gap Inventory

The following table provides an exhaustive mapping of every domain module, its current source of truth, read/write path, transaction boundary, fallback behavior, and target PostgreSQL persistence:

| Module & Service File | Current Source of Truth | Read / Write Path | Current Transaction Boundary | Fallback Behavior | Target PostgreSQL Tables & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fees & Ledger**<br>`src/modules/fees-ledger/service.ts` | Process-local Maps (`paymentsVault`, `allocationsVault`, `adjustmentsVault`, `paymentResultsVault`) | In-memory JavaScript Map mutations | Process-local `AsyncLock` (`paymentLock`); zero database transaction | **Silent In-Memory Fallback:** Returns cached result or Map state; zero SQL error if DB is down | `public.payments`, `public.payment_allocations`, `public.fee_adjustments`, `public.student_fee_assessments`. Atomic multi-step transaction with `assert_payment_allocation_sum`, `enforce_single_category_per_payment`. |
| **Receipts**<br>`src/modules/receipts/service.ts` | Process-local Maps (`receiptsVault`, `paymentToReceiptMap`, `consolidatedReceiptsVault`, `receiptCountersVault`) | In-memory Map mutations | Process-local `AsyncLock` (`receiptLock`); zero DB transaction | **Silent In-Memory Fallback:** Increments local counter; zero persistence | `public.receipts`, `public.consolidated_receipts`, `public.consolidated_receipt_items`, `public.receipt_number_counters`. Monotonic row-locked generator via `private.next_receipt_number()`. |
| **Certificates (LC/TC)**<br>`src/modules/certificates-lctc/service.ts` | Process-local Maps (`certificatesVault`, `certificateVersionsVault`, `certificateCountersVault`) | In-memory Map mutations | Process-local `AsyncLock` (`issuanceLock`); zero DB transaction | **Silent In-Memory Fallback:** Version snapshots held in memory | `public.student_year_certificates`, `public.certificate_versions`. Atomic issue transaction creating immutable V1 snapshot. |
| **Admissions**<br>`src/modules/admissions/service.ts` | Process-local Maps (`applicationsVault`, `academicRecordsVault`, `feeAssessmentsVault`, `applicationSeqVault`, `admissionSeqVault`) | In-memory Map mutations; fire-and-forget optional insert to `admission_applications` | Process-local `AsyncLock` (`approvalLock`); in-memory rollback only | **Silent In-Memory Fallback:** If `adminDb.insert` throws, error is caught and ignored | `public.admission_applications`, `public.admission_status_history`, `public.students`, `public.guardians`, `public.student_guardians`, `public.student_sensitive_details`, `public.student_academic_records`, `public.student_fee_assessments`. Single atomic transaction. |
| **Academic Years**<br>`src/modules/academic-years/service.ts` | In-memory array (`academicYearsVault`) initialized from hardcoded list | Try-catch around `adminDb.from('academic_years')` | None (Single row reads/writes) | **Silent In-Memory Fallback:** If DB call throws, falls back to `academicYearsVault` | `public.academic_years`. Strict read/write against PostgreSQL with fail-closed behavior. |
| **Identity & Access**<br>`src/modules/identity-access/service.ts` | Process-local Map (`securityVault`) pre-seeded with 5 accounts | Password verification & lockout counters mutated in `securityVault` | None | **Silent In-Memory Fallback:** Modifies `securityVault` on failed logins and lockout resets | `public.staff_members`, `public.staff_security_profiles`. Durable atomic lockout counters and password hash verification. |
| **Fee Configuration**<br>`src/modules/fee-configuration/service.ts` | In-memory Maps (`feeHeadsVault`, `transportRatesVault`, `feeStructuresVault`) initialized from static constants | In-memory Map mutations | None | **Silent In-Memory Fallback:** Operates exclusively on memory Maps | `public.fee_heads`, `public.fee_structures`, `public.fee_structure_lines`, `public.transport_rates`. Persistent versioning and atomic structure approval. |
| **Document Management**<br>`src/modules/documents/service.ts` | Process-local Map (`studentDocumentsVault`) | Pushes to Map; optional fire-and-forget insert into `student_documents` | None | **Silent In-Memory Fallback:** Swallows DB errors | `public.student_documents` & private Supabase Storage buckets (`admission-documents`, `receipts`, `certificates`). |
| **Student Records**<br>`src/modules/student-records/service.ts` | In-memory Map (`studentStatusHistoryVault`) + delegation to `admissionsService` | Queries memory Maps | None | **Silent In-Memory Fallback:** Operates on memory Maps | `public.student_academic_records`, `public.students`, `public.student_sensitive_details`. Enforces DPDP role masking in SQL. |
| **Audit Reporting**<br>`src/modules/audit-reporting/service.ts` | In-memory array (`auditLogsVault`) | Appends to array; optional fire-and-forget insert into `audit_logs` | None | **Silent In-Memory Fallback:** If `adminDb.insert` fails, swallowed silently; `getLogs` reads array | `public.audit_logs`. Immutable append-only write via direct connection; fail-closed in production. |

---

## 3. Required Behavior & Architectural Directives

### 3.1 Production Fail-Closed Rule
Under no circumstances may a production deployment silently fall back to an in-memory Map or synthetic store.
- **Production Mode:** If `DATABASE_URL` is missing, malformed, points to a forbidden remote database, or connection to PostgreSQL fails, the application **must abort startup or return a 503 Service Unavailable / 500 Internal Error** with standard RFC 7807 problem details.
- **In-Memory Fakes:** In-memory vaults are strictly quarantined as **test fakes** inside `src/infrastructure/repositories/in-memory/` for isolated unit tests (`NODE_ENV === 'test'`) or explicit demonstration mode.

### 3.2 Runtime Least Privilege & RLS Model
1. **Login Role (`school_app_login`):**
   - Direct connection pool connects via `DATABASE_URL` authenticated as `school_app_login`.
   - `school_app_login` is granted membership in `school_app_user`.
   - Has zero `DELETE` privileges across all tables and zero `UPDATE` privileges on immutable ledger, receipt, and audit tables.
2. **Transaction-Local Actor Context:**
   - Server-only PostgreSQL pool executes within each transaction:
     ```sql
     SELECT set_config('app.current_staff_id', $1, true),
            set_config('app.current_role', $2, true);
     ```
   - Parameter `is_local = true` guarantees that settings automatically drop upon `COMMIT` or `ROLLBACK`.
   - Connection release executes `DISCARD TEMP;` or `RESET ALL;` to prevent session variable leakage across pooled connections.
3. **Database RLS Policies:**
   - Active on all 32 tables.
   - Evaluated via `current_setting('app.current_role', true)`.
   - Fails closed (`DENY ALL`) when actor context is absent, malformed, or unauthorized.
   - Prohibits Accounts Officer and System Admin from reading `student_sensitive_details` at the SQL engine level.

---

## 4. Phase 8 Remediation Roadmap

1. **Step 1: Database Migration `20261101120000_provision_school_app_login_and_rls.sql`**
   - Create `school_app_login` role and grant `school_app_user`.
   - Establish context helper functions (`private.current_actor_role()`, `private.current_actor_staff_id()`).
   - Define comprehensive RLS policies on all 32 public tables.
2. **Step 2: Server-Only Direct PostgreSQL Driver & Connection Pool**
   - Implement `src/infrastructure/db/postgres-pool.ts` using `pg.Pool`.
   - Support parameterized queries, transaction lifecycle, transaction-local actor scoping, and safety guards.
3. **Step 3: Repository Pattern Abstraction**
   - Define domain interfaces in `src/infrastructure/repositories/interfaces.ts`.
   - Implement PostgreSQL-backed repositories in `src/infrastructure/repositories/postgres/`.
   - Implement test-only in-memory repositories in `src/infrastructure/repositories/in-memory/`.
   - Introduce registry factory in `src/infrastructure/repositories/index.ts` with strict fail-closed production verification.
4. **Step 4: Bridge Domain Services to Repository Interfaces**
   - Refactor `fees-ledger`, `receipts`, `certificates-lctc`, `admissions`, `audit-reporting`, etc. to consume injected repository interfaces.
5. **Step 5: Automated Verification Suite**
   - Implement unit and integration tests proving data durability across service restarts, RLS enforcement, atomic rollback, and role isolation.
