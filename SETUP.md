# Setup and Handover Guide

> **Baseline Status (M0.3 Audited):** This guide reflects direct inspection of repository manifests, local tooling, configuration files, and SQL test scripts. Commands and dependencies are separated into mandatory baseline vs optional tooling.

---

## 1. Responsibility Boundary
- **Intallo:** Delivers source code, database scripts, synthetic seed, setup guide, technical notes, and acceptance evidence.
- **Client:** Owns deployment/hosting, domain/DNS, live HTTPS/TLS, production database operations, backup/restore schedules, monitoring, end-user training, and ongoing maintenance per signed engagement terms.

---

## 2. Verified Tooling & Runtime Inventory

Direct execution on the development host verified the following tool inventory:

| Tool / Runtime | Verified Version | Status | Architectural Role | Mandatory / Optional |
|---|---|:---:|---|:---:|
| **Node.js** | `v24.12.0` | **Installed** | Application runtime for Next.js / React frontend shell | Mandatory for app runtime |
| **npm** | `11.6.2` | **Installed** | Node package manager for installing frontend packages | Mandatory for app dependencies |
| **Git** | `2.48.1.windows.1` | **Installed** | Version control and task-branch workflow | Mandatory |
| **Docker Desktop** | `29.8.2 (build 7fc2dff)` | **Installed** | Local container engine required to run the local Supabase stack | Mandatory for local DB stack |
| **Python** | `3.14.2` | **Installed** | Host scripting / build utility | Optional helper |
| **Supabase CLI** | *Not Found on PATH* | **BLOCKER** | CLI for `supabase start`, `supabase migration`, `supabase gen types` | **Mandatory local prerequisite** |
| **Application Manifest** | `package.json` *Not Present* | **PENDING** | Node project configuration, dependencies, and build scripts | Pending Milestone M1.1 ADR |

---

## 3. Baseline Verification (Read-Only)
- Current baseline commit: `5e1c47e` (Initial Supabase database schema and seed data).
- Hardening migration commit: `d768254` (`20261022090000_harden_financial_integrity.sql` and `supabase/tests/integrity_tests.sql`).
- Remote Supabase project reference: `fjrfyzamiirqzitdchkz` (`https://supabase.com/dashboard/project/fjrfyzamiirqzitdchkz`).
- Retained database state: Schema and synthetic demonstration data were applied to the hosted project prior to baseline repository creation. M0.3 inspection is strictly read-only.

---

## 4. Environment Variables Register
Tracked configuration keys are fully documented in [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md).
- **Public Client Keys:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Safe for browser bundle).
- **Protected Server Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (**CRITICAL SECRETS**; never expose to browser or commit to git).
- Keep [`.env.example`](.env.example) placeholder-only.
- All real environment files (`.env`, `.env.local`) are ignored via [`.gitignore`](.gitignore).

---

## 5. Verification Script Safety Review

The repository contains two SQL test scripts under `supabase/tests/`. Their safety profiles are evaluated below:

### 1. `supabase/tests/verification.sql` (Read-Only Verification Script)
- **Behavior:** Executes a single `SELECT jsonb_build_object(...)` statement querying table metadata and record aggregates.
- **Checks Performed:**
  - Table count: `information_schema.tables` where `table_schema = 'public'`.
  - RLS verification: `bool_and(c.relrowsecurity)` across all public relation tables.
  - Record counts: `students`, `guardians`, `admission_applications`, `payments`, `payment_allocations`, `receipts`, `consolidated_receipts`, `student_year_certificates`.
  - Financial consistency: Confirms payment amount equals allocation sums; checks cross-student allocation boundaries; checks consolidated receipt amount totals.
- **Database Writes:** **ZERO.** Does not contain `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, or `CREATE`.
- **Safety Classification:** **SAFE** to run against any database, including the retained shared database.

### 2. `supabase/tests/integrity_tests.sql` (Constraint & Negative Test Script)
- **Behavior:** Defines temporary PL/pgSQL functions (`pg_temp.expect_reject`) to test boundary constraints (e.g. overpayment, cross-category payment, unauthorized adjustment, and invalid reversals).
- **Database Writes:** Executes speculative DML write statements inside `BEGIN ... EXCEPTION ... ROLLBACK` blocks.
- **Safety Classification:** **RESTRICTED.** Must **NEVER** be run against the retained shared database. Run strictly against a disposable local Docker database.

---

## 6. Commands & Safe Execution Runbook

| Lifecycle Action | Safe Command | Target Environment | Safety Notes |
|---|---|---|---|
| **Check Tooling** | `node -v; npm -v; git --version; docker --version` | Local Host | Completely non-destructive. |
| **Install Supabase CLI** | `npm install -g supabase` *or* `winget install Supabase.CLI` | Local Host | Required to resolve the local environment blocker. |
| **Start Local Stack** | `supabase start` | Local Docker | Starts local PostgreSQL 17, PostgREST, Auth, Storage, and Studio. |
| **Disposable Reset** | `supabase db reset` | **LOCAL DOCKER ONLY** | **DESTRUCTIVE.** Runs all migrations and loads `seed.sql`. **NEVER** run against remote/retained DB. |
| **Check Local Migrations** | `supabase migration list --local` | Local Workspace | Inspects migration timestamps without executing SQL. |
| **Generate TS Types** | `supabase gen types typescript --local > src/types/database.types.ts` | Local Workspace | Generates type definitions from local schema. |
| **Run Safe Verification** | `psql <connection-string> -f supabase/tests/verification.sql` | Any / Retained DB | Read-only JSON validation report. |
| **Run Negative Tests** | `psql <local-connection-string> -f supabase/tests/integrity_tests.sql` | **LOCAL DISPOSABLE ONLY** | Tests rejection triggers; rolls back all operations. |

---

## 7. Known Environment Blockers & Missing Prerequisites

1. **Supabase CLI Not on PATH:**
   - **Impact:** Cannot execute `supabase start`, `supabase db reset`, or regenerate TypeScript database types locally.
   - **Remediation:** Install Supabase CLI via `npm install -g supabase` or Scoop/Homebrew/Winget.
2. **Missing Application Manifest (`package.json`):**
   - **Impact:** Frontend/backend application code cannot be installed, built, or tested locally yet.
   - **Remediation:** Expected at this stage; milestone M1.1 (Architecture ADR) must first evaluate and approve the application framework and module scaffolding.
3. **Docker Desktop Configuration Access Warning:**
   - **Impact:** Docker version 29.8.2 is installed, but CLI warned `open C:\Users\shash\.docker\config.json: Access is denied`.
   - **Remediation:** Ensure Docker Desktop is launched with appropriate user privileges before starting the local Supabase container stack.
