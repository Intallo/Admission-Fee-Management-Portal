# Database Migration Inventory and Operations Runbook (Phase 7 Handover)

**Document Code:** P7-DB-RUNBOOK-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Database Engine:** PostgreSQL 15+ / Supabase  
**Total Tables:** 32 Tables (31 Public Domain Tables + 1 Security Vault Table)  
**Verification Date:** 29 October 2026  
**Status:** **Audited & Verified** (Idempotent Migrations with Full Rollback Scripts)  

---

## 1. Migration Inventory & Execution Sequence

All schema modifications are tracked as version-controlled SQL files under `supabase/migrations/`. Every migration is designed to be deterministic and idempotent.

| Order | Migration File | Down Script | Purpose & Key Database Objects |
|:---:|---|---|---|
| **1** | `20261016182749_init_admission_fee_management_schema.sql` | `N/A (Baseline Init)` | Creates core 31 tables across academic calendar, staff, student demographics, admission applications, document management, fee heads, fee structures, transport rates, assessments, payments, receipts, certificates, and audit logs. Establishes private schema helper triggers (`prevent_hard_delete`, `set_updated_at`, `reject_immutable_update`). |
| **2** | `20261016183014_enforce_financial_integrity_and_indexes.sql` | `N/A (Baseline Init)` | Adds integrity constraints, foreign key checks, unique indexes (e.g. `student_guardians_one_primary_idx`), performance indexes, and immutability triggers on financial ledger and assessment tables. |
| **3** | `20261016183124_seed_synthetic_admission_fee_demo_data.sql` | `N/A (Baseline Init)` | Seeds realistic synthetic data (5 staff roles, 3 academic years, 14 grade levels, 28 sections, fee structures, transport tariffs, 255 demo students). **Contains zero live student/parent data.** |
| **4** | `20261022090000_harden_financial_integrity.sql` | `N/A (Baseline Init)` | Implements CR-001 financial hardening: single fee category per payment trigger (`enforce_single_category_per_payment`), allocation sum validation (`assert_payment_allocation_sum`), and payment reversal foreign keys (`reverses_payment_id`). |
| **5** | `20261030000000_provision_restricted_app_role.sql` | `20261030000000_provision_restricted_app_role.down.sql` | **Satisfies US-33 AC2:** Provisions restricted database role `school_app_user`. Grants usage, sequence access, and table privileges. **Explicitly revokes DELETE on all tables** in `public` schema. **Explicitly revokes UPDATE on ledger, receipts, items, certificate versions, and audit logs.** Upgrades receipt numbering sequence to 6 zero-padded digits (`RCT-YYYY-NNNNNN`, US-27 AC2). |
| **6** | `20261031000000_staff_auth_security.sql` | `20261031000000_staff_auth_security.down.sql` | **Module 1 Security Hardening:** Creates `public.staff_security_profiles` vault storing scrypt password hashes, failed login attempt counters, 15-minute lockout timestamps (`locked_until`), and `must_change_password` flag. Pre-populates security profiles for seeded staff accounts. |
| **7** | `20261101000000_provision_private_storage_buckets.sql` | `20261101000000_provision_private_storage_buckets.down.sql` | **Storage Security Hardening:** Provisions private buckets (`admission-documents`, `receipts`, `certificates`) with `public = false`, file size limits, MIME type constraints, and RLS policies on `storage.objects`. |

---

## 2. US-33 AC2 Least-Privilege Role Specification (`school_app_user`)

Per signed SRS §4 (`US-33 AC2`) and Milestone M0.4 findings, running application runtime traffic under the PostgreSQL `postgres` superuser or unrestricted role violates institutional security standards. Migration `20261030000000` provisions the dedicated restricted application role `school_app_user`:

```mermaid
flowchart TD
    APP["Node.js Application Server"] -->|Connects as| ROLE["Role: school_app_user"]
    
    subgraph PERM["Granted Privileges"]
        MUT["Mutable Domain Tables<br>(students, applications, staff)"]
        IMMUT["Immutable Ledger & Audit<br>(payments, receipts, audit_logs)"]
    end
    
    ROLE -->|SELECT, INSERT, UPDATE| MUT
    ROLE -->|SELECT, INSERT ONLY| IMMUT
    
    ROLE -.->|DELETE Strictly Revoked (42501)| BLOCKED_DEL["Zero Hard Deletes Across Entire Database"]
    ROLE -.->|UPDATE Strictly Revoked (42501)| BLOCKED_UPD["Zero In-Place Ledger / Audit Modification"]
```

### Verified Privilege Matrix for `school_app_user`:
1. **SELECT, INSERT, UPDATE (NO DELETE):**
   - `staff_members`, `academic_years`, `grade_levels`, `sections`, `students`, `guardians`, `student_guardians`, `student_sensitive_details`, `student_academic_records`, `student_transport_assignments`, `admission_applications`, `document_types`, `document_requirements`, `student_documents`, `fee_heads`, `fee_structures`, `fee_structure_lines`, `transport_rates`, `student_fee_assessments`, `student_fee_assessment_lines`, `fee_adjustments`, `student_year_certificates`, `receipt_number_counters`, `staff_security_profiles`.
2. **SELECT, INSERT ONLY (NO UPDATE, NO DELETE):**
   - `admission_status_history`, `payments`, `payment_allocations`, `receipts`, `consolidated_receipts`, `consolidated_receipt_items`, `certificate_versions`, `audit_logs`.
3. **Automated Verification:**
   - Proved via [`supabase/tests/us33_ac2_least_privilege_tests.sql`](file:///supabase/tests/us33_ac2_least_privilege_tests.sql): 21 negative assertion checks assert that any attempt by `school_app_user` to delete from core tables or update ledger rows results in database engine error `42501 (permission denied)`.

---

## 3. Forward Migration Runbook (Applying Migrations)

### 3.1 Local Development / Test Environment (Supabase CLI)
```powershell
# 1. Start local Supabase containers (PostgreSQL, Storage, Auth)
npx supabase start

# 2. Reset database and apply all migrations sequentially from scratch
npx supabase db reset

# 3. Verify database integrity tests
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/integrity_tests.sql
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/us33_ac2_least_privilege_tests.sql
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/verification.sql
```

### 3.2 Production / Staging Deployment Runbook (Client Responsibility)
When applying migrations to client-managed staging or production PostgreSQL instances:
```powershell
# Pre-requisite: Set DATABASE_URL to client database
# CAUTION: Never connect tests or developmental reset scripts to production!

# 1. Take a full pre-migration logical backup
pg_dump -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -F c -b -v -f "pre_migration_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

# 2. Apply Migration 5 (US-33 AC2 Least Privilege Role & Receipt Padding Fix)
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261030000000_provision_restricted_app_role.sql

# 3. Apply Migration 6 (Staff Security Profiles Vault)
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261031000000_staff_auth_security.sql

# 4. Verify post-migration integrity
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/tests/us33_ac2_least_privilege_tests.sql
```

---

## 4. Rollback and Disaster Recovery Runbook

If a migration must be reverted, apply the corresponding `.down.sql` script in reverse order:

### 4.1 Reverting Migration 6 (`staff_auth_security`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261031000000_staff_auth_security.down.sql
```
*Effect:* Safely drops `public.staff_security_profiles` table and triggers.

### 4.2 Reverting Migration 5 (`provision_restricted_app_role`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261030000000_provision_restricted_app_role.down.sql
```
*Effect:* Restores 4-digit receipt numbering and revokes role privileges for `school_app_user`.
