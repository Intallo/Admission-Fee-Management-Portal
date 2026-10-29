# Developer Setup, Operations & Troubleshooting Guide (Phase 7 Handover)

**Document Code:** P7-SETUP-GUIDE-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Vendor:** Intallo  
**Framework Stack:** Next.js 14 (App Router), TypeScript 5.6.3, Tailwind CSS, React 18, Supabase / PostgreSQL 15+, Vitest 2.1.9  
**Verification Date:** 29 October 2026  
**Status:** **Audited & Verified** (Tested on Clean Development Environment)  

---

## 1. Responsibility Boundary

In accordance with signed BRD v1.4 §13, signed SRS v1.4 §1.3, and confirmed Decision `DEC-09`:
- **Intallo (Vendor):** Delivers verified source code, database migrations, synthetic demo seed data, setup and troubleshooting guides, test suites, and client handover package. Intallo does not deploy to live production or configure live DNS/TLS without authorized agreement.
- **ABC English Medium School (Client):** Owns deployment, hosting infrastructure, domain/DNS routing, SSL/TLS certificates, live database operations, automated backup schedules, disaster recovery, end-user management, and ongoing software operations.

---

## 2. Prerequisites & Verified Tooling Inventory

Ensure the following runtimes and utilities are installed on the development host:

| Tool / Runtime | Verified Version | Architectural Role | Mandatory / Optional |
|---|---|---|:---:|
| **Node.js** | `v18.x` to `v24.x` (Tested on `v24.12.0`) | JavaScript/TypeScript application runtime | **Mandatory** |
| **npm** | `10.x` or `11.x` (Tested on `11.6.2`) | Package dependency manager | **Mandatory** |
| **Git** | `2.40+` (Tested on `2.48.1`) | Version control & release candidate branch management | **Mandatory** |
| **Supabase CLI** | `1.180+` | Local PostgreSQL runtime, migrations & storage emulator | **Mandatory for local DB** |
| **Docker Desktop** | `4.25+` | Required by Supabase CLI for running local PostgreSQL containers | **Mandatory for local DB** |
| **PostgreSQL Client (`psql`)** | `15+` | Command-line database query and verification tool | Optional (CLI verification) |

---

## 3. Step-by-Step Developer Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/Intallo/School-Admission-Fee-Management-Portal.git
cd School-Admission-Fee-Management-Portal
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```
*Note for Windows users:* If an `EPERM` error occurs on temporary cache directories during installation, re-run the command once.

### Step 3: Configure Environment Variables
Copy the template configuration file to `.env.local`:
```bash
cp .env.example .env.local
```
Review `.env.local` to ensure local development variables are set:
```ini
# Client-Facing Variables (Exposed to Browser)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_dev_key

# Server-Only Variables (STRICTLY FORBIDDEN IN CLIENT BUNDLES)
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_local_dev_key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Database Safety Guard (Prevents accidental connections to remote database)
ALLOW_REMOTE_DATABASE=false
NEXT_TELEMETRY_DISABLED=1
```

### Step 4: Start Local Database and Apply Migrations
If using Supabase CLI with Docker:
```bash
npx supabase start
npx supabase db reset
```
This starts PostgreSQL on port `54322`, applies all 6 schema migrations in order, and seeds 255 synthetic demo students with historical transactions.

### Step 5: Execute Verification Test Suites
Run the full test suite, linter, and static typechecker to verify system integrity:
```bash
npm run test        # Runs all 26 Vitest test suites (219 tests)
npm run lint        # Verifies ESLint zero-defect code standards
npm run typecheck   # Executes strict TypeScript compilation checks
```

### Step 6: Launch Developer Server
```bash
npm run dev
```
Open your desktop browser (latest Google Chrome recommended per SRS §2.3) at:  
👉 **`http://localhost:3000`**

---

## 4. Default Seed Staff Accounts (Synthetic Demo Credentials)

The system comes pre-configured with 5 standard demo accounts covering all institutional roles.  
**Default Password for all demo accounts:** `School@2026!`

| Email Address | Assigned Role | Institutional Authority & Scope | First Login Action |
|---|---|---|---|
| `principal@school-demo.example` | **Principal** | Sole authority for admissions, fee concessions, reversals, fee structures, and Transfer Certificates. | Normal login |
| `admissions@school-demo.example` | **Admission Officer** | Intake forms, applicant demographic entry, document checklist verification, and Step 1 TC review. | Normal login |
| `accounts@school-demo.example` | **Accounts Officer** | Fee structure drafting, vehicle places, offline payment recording, receipts, and outstanding dues reports. | Normal login |
| `system.admin@school-demo.example` | **System Admin** | Staff directory provisioning, user deactivation, password resets, and system audit logs. | **Mandatory password change prompted on first login** |
| `clerk@school-demo.example` | **Clerk** | Front-desk application drafting and general student records search. | Normal login |

---

## 5. Production Build & Server Launch

To build the standalone production artifact and start the Node.js production server:

```powershell
# 1. Disable Next.js telemetry (recommended for isolated CI/build environments)
$env:NEXT_TELEMETRY_DISABLED="1"

# 2. Build production standalone bundle
npm run build

# 3. Launch production server
npm run start
```
The server will bind to port `3000` with pre-rendered static shells and dynamic API route handlers.

---

## 6. Comprehensive Troubleshooting Guide

### 6.1 Issue: Next.js Build Hangs or Pauses after `Environments: .env`
- **Root Cause:** Next.js by default attempts external outbound network checks for telemetry and canary version pings. In firewalled, air-gapped, or sandboxed environments, these calls hang until timeout.
- **Solution:** Always set `NEXT_TELEMETRY_DISABLED=1` and `NEXT_DISABLE_VERSION_CHECK=1` before building:
  ```powershell
  $env:NEXT_TELEMETRY_DISABLED="1"; $env:NEXT_DISABLE_VERSION_CHECK="1"; npm run build
  ```

### 6.2 Issue: `[DATABASE SAFETY GUARD] Connection to retained remote database is STRICTLY FORBIDDEN`
- **Root Cause:** The environment variable `NEXT_PUBLIC_SUPABASE_URL` or `DATABASE_URL` contains the protected reference `fjrfyzamiirqzitdchkz` or a non-local cloud hostname while running in development/test mode.
- **Solution:** Verify `.env.local` points strictly to `http://127.0.0.1:54321` or `localhost`. Never point development or test runs to remote cloud databases.

### 6.3 Issue: `Account is temporarily locked due to consecutive failed attempts`
- **Root Cause:** Per US-01 AC3, 5 consecutive incorrect passwords trigger an automatic 15-minute security lockout.
- **Solution:**
  1. Wait 15 minutes for the rolling lockout window to expire automatically.
  2. For development/testing, unlock immediately via SQL:
     ```sql
     UPDATE public.staff_security_profiles 
     SET locked_until = NULL, failed_login_attempts = 0 
     WHERE staff_id = (SELECT id FROM public.staff_members WHERE email = 'accounts@school-demo.example');
     ```

### 6.4 Issue: `403 Forbidden: You do not possess the required permission`
- **Root Cause:** Attempting an operation restricted to another role (e.g., Accounts Officer attempting to approve an admission application or waive a fee).
- **Solution:** Check the [Role Permission Matrix](file:///docs/ROLE_PERMISSION_MATRIX.md). Log in with the required role (e.g. Principal for admissions and concessions).

### 6.5 Issue: Port Conflict on 3000, 54321, or 54322
- **Root Cause:** Another Node process or PostgreSQL instance is already bound to the port.
- **Solution:**
  - For Next.js port conflict: Run on a different port using `npm run dev -- -p 3001`.
  - For Supabase port conflict: Stop conflicting Docker containers or existing PostgreSQL services:
    ```powershell
    npx supabase stop
    npx supabase start
    ```
