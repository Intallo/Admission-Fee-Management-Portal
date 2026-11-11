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
| **8** | `20261101120000_provision_school_app_login_and_rls.sql` | `20261101120000_provision_school_app_login_and_rls.down.sql` | **Phase 8 Remediation (F-01 & F-02):** Provisions dedicated PostgreSQL login role `school_app_login` as a member of `school_app_user`. Creates transaction-local context helpers `private.current_actor_role()` and `private.current_actor_staff_id()`. Establishes fail-closed Row-Level Security (RLS) across all 32 public tables. Strictly denies `student_sensitive_details` access to `accountant` and `system_admin` per DPDP Act. |
| **9** | `20261101130000_verifiable_actor_and_auth_gateway.sql` | `20261101130000_verifiable_actor_and_auth_gateway.down.sql` | **Phase 8.2 & Phase 8.3 Security & Numbering Gateway (M8.3.2, M8.3.3):** Provisions `private.system_secrets` and verifies cryptographic HMAC-SHA256 signature (`app.actor_signature`) in `private.current_actor_role()`. Revokes all table permissions on `public.staff_security_profiles` from `school_app_user, school_app_login`. Provisions 6 hardened `SECURITY DEFINER` gateway functions in `private` schema with `search_path = ''` for login lookup by active email, bounded credential retrieval, deterministic 5-attempt/15-minute lockout enforcement, self/admin password updates (42501 on unauthorized calls), and staff security profile provisioning (`auth_create_security_profile`). Upgrades `public.receipt_number_counters` to composite `(series_code, academic_year_id)` key with atomic rollover for Application (`161/2026-27`), Admission (`ADM-YYYY-NNNN`), Receipt (`RCT-YYYY-NNNNNN`), and TC (`TC-YYYY-NNNN`). |

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

### 3.2 Disposable CI & Containerized Test Environments (Milestone M8.3.1)
When running tests against a clean, vanilla PostgreSQL container (e.g., in GitHub Actions CI or a local Docker `postgres:15-alpine` container), the database lacks pre-provisioned Supabase objects (roles, `auth` schema, `storage` schema).

The repository provides a dedicated, isolated test bootstrap and migration runner:
- **Test Bootstrap:** [`scripts/ci/00_supabase_test_compat_bootstrap.sql`](file:///scripts/ci/00_supabase_test_compat_bootstrap.sql)
- **CI Migration Runner:** [`scripts/ci/run-migrations.sh`](file:///scripts/ci/run-migrations.sh)
- **Programmatic Runner:** [`scripts/ci/migration-runner.ts`](file:///scripts/ci/migration-runner.ts)

#### Supabase Dependencies Inventory for Test Environments:
1. **Roles:** `anon`, `authenticated`, `service_role` (with `bypassrls`), `supabase_admin` (superuser), `authenticator` (proxy role).
2. **Schemas:** `auth` and `storage`.
3. **Compatibility Tables:**
   - `auth.users`: Satisfies `public.staff_members.auth_user_id REFERENCES auth.users(id)`.
   - `storage.buckets` & `storage.objects`: Satisfies migration `20261101000000_provision_private_storage_buckets.sql`.
4. **Helper Functions:** `auth.uid()`, `auth.role()`, `auth.email()`, `auth.jwt()`.
5. **Extensions:** `uuid-ossp`, `pgcrypto`.

#### Execution Command in CI:
```bash
chmod +x scripts/ci/run-migrations.sh
./scripts/ci/run-migrations.sh
```

> [!WARNING]
> **Test Bootstrap Isolation & Production Safeguards:**
> - `scripts/ci/00_supabase_test_compat_bootstrap.sql` is strictly quarantined in `scripts/ci/` and is **never** placed in `supabase/migrations/`.
> - It contains a fail-closed guard that aborts execution if `app.environment = 'production'`.
> - It must **never** be applied to client production databases or the retained Supabase project (`fjrfyzamiirqzitdchkz`).

### 3.3 Production / Staging Deployment Runbook (Client Responsibility)
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

# 4. Apply Migration 7 (Private Storage Buckets)
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261101000000_provision_private_storage_buckets.sql

# 5. Apply Migration 8 (school_app_login role & RLS)
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261101120000_provision_school_app_login_and_rls.sql

# 6. Apply Migration 9 (Verifiable Actor & Auth Gateway)
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/migrations/20261101130000_verifiable_actor_and_auth_gateway.sql

# 7. Provision school_app_login Password and System Secret Out-of-Band (DBA action)
# NEVER commit this password or system secret to version control!
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -c "ALTER ROLE school_app_login WITH PASSWORD '{{STRONG_CLIENT_SUPPLIED_SECRET}}';"
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -c "INSERT INTO private.system_secrets (key_name, secret_value) VALUES ('actor_signing_secret', '{{STRONG_RANDOM_HMAC_SECRET}}') ON CONFLICT (key_name) DO UPDATE SET secret_value = EXCLUDED.secret_value, updated_at = now();"

# 8. Verify post-migration integrity
psql -h <CLIENT_DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/tests/us33_ac2_least_privilege_tests.sql
```

---

## 4. Rollback and Disaster Recovery Runbook

If a migration must be reverted, apply the corresponding `.down.sql` script in reverse order:

### 4.1 Reverting Migration 9 (`verifiable_actor_and_auth_gateway`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/rollbacks/20261101130000_verifiable_actor_and_auth_gateway.down.sql
```
*Effect:* Safely drops all 6 auth gateway functions in `private` (`auth_create_security_profile`, `auth_update_password`, `auth_record_login_attempt`, `auth_get_security_profile`, `auth_lookup_staff_by_id`, `auth_lookup_staff_by_email`), re-grants base table permissions on `staff_security_profiles` expected by Migration 8, restores Migration 8 unverified actor context functions, drops `private.system_secrets`, and reverts `receipt_number_counters` composite key.

### 4.2 Reverting Migration 8 (`provision_school_app_login_and_rls`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/rollbacks/20261101120000_provision_school_app_login_and_rls.down.sql
```
*Effect:* Safely drops `school_app_login` role, RLS policies, and actor context helper functions.

### 4.3 Reverting Migration 7 (`provision_private_storage_buckets`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/rollbacks/20261101000000_provision_private_storage_buckets.down.sql
```
*Effect:* Safely drops private storage buckets and bucket RLS policies.

### 4.4 Reverting Migration 6 (`staff_auth_security`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/rollbacks/20261031000000_staff_auth_security.down.sql
```
*Effect:* Safely drops `public.staff_security_profiles` table and triggers.

### 4.5 Reverting Migration 5 (`provision_restricted_app_role`)
```powershell
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -f supabase/rollbacks/20261030000000_provision_restricted_app_role.down.sql
```
*Effect:* Restores 4-digit receipt numbering and revokes role privileges for `school_app_user`.

---

## 5. HMAC Signing Secret Lifecycle, Rotation & Recovery Runbook

### 5.1 Security Requirements (Milestone M8.3.2)
1. **Zero Hardcoded Secrets:** No default HMAC secret is committed to Git or hardcoded in SQL or TypeScript.
2. **Cryptographic Entropy:** Secrets must be generated using cryptographically secure random bytes (minimum 32 bytes / 64 hex characters):
   ```bash
   openssl rand -hex 32
   ```
3. **Fail-Closed Guarantees:**
   - If `ACTOR_SIGNING_SECRET` is unset or shorter than 32 characters, the application server immediately throws `[SECURITY ERROR]` and halts transaction execution.
   - If `private.system_secrets` lacks `actor_signing_secret` or its length is under 32 characters, `private.current_actor_role()` returns `NULL`, causing all Row-Level Security policies to deny access.
4. **Caller Key Fallback Prohibited:** The caller-controlled `app.actor_signing_key` parameter is eliminated; all actor signatures must validate against the database vault `private.system_secrets`.

### 5.2 Initial Secret Provisioning Procedure
During initial deployment or CI database provisioning:
```bash
# 1. Generate high-entropy secret
SECRET=$(openssl rand -hex 32)

# 2. Store in application environment
export ACTOR_SIGNING_SECRET="$SECRET"

# 3. Provision into database vault as database administrator (postgres)
psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -c \
  "INSERT INTO private.system_secrets (key_name, secret_value, updated_at) \
   VALUES ('actor_signing_secret', '$SECRET', now()) \
   ON CONFLICT (key_name) DO UPDATE SET secret_value = EXCLUDED.secret_value, updated_at = now();"
```

### 5.3 Scheduled Secret Rotation Procedure
When rotating the actor signing secret in production:
1. **Generate New Secret:**
   ```bash
   NEW_SECRET=$(openssl rand -hex 32)
   ```
2. **Stage Update in PostgreSQL Vault:**
   Update the database secret atomically:
   ```bash
   psql -h <DB_HOST> -p 5432 -U postgres -d <DB_NAME> -c \
     "UPDATE private.system_secrets SET secret_value = '$NEW_SECRET', updated_at = now() WHERE key_name = 'actor_signing_secret';"
   ```
3. **Update Application Environment & Perform Rolling Reload:**
   Update `ACTOR_SIGNING_SECRET` in application configuration (e.g. secret manager or `.env`) and trigger a rolling restart of the application pool instances.
4. **Verify Actor Signature Validity:**
   Run the health probe and integration suite to confirm valid transactions complete and forged signatures are rejected.

### 5.4 Emergency Secret Compromise & Recovery
If the signing secret is suspected to be compromised:
1. **Immediate Revocation & Re-keying:**
   Generate and inject a new secret into `private.system_secrets` immediately. Active transactions signed with the old secret will be rejected by `private.current_actor_role()`.
2. **Emergency Rollback (if database must be downgraded):**
   Execute `20261101130000_verifiable_actor_and_auth_gateway.down.sql`. The rollback restores Migration 8's verified actor function *prior* to dropping `private.system_secrets`, maintaining business continuity without policy corruption.
