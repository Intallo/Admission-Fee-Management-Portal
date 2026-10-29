# Developer Setup and Runbook

> **Current Baseline:** Phase 7 — Final Security Hardening, Verification & Handover Baseline  
> **Framework:** Next.js 14 App Router, TypeScript 5.6.3, Tailwind CSS, Vitest 2.1.9, Supabase / PostgreSQL 15+  
> **Security Baseline:** US-33 AC2 Database Privilege Isolation & Server-Only Database Adapters  
> **Comprehensive Guide:** See [docs/DEVELOPER_SETUP_AND_TROUBLESHOOTING.md](docs/DEVELOPER_SETUP_AND_TROUBLESHOOTING.md) for full operational runbooks and troubleshooting.

---

## 1. Responsibility Boundary

- **Vendor (Intallo):** Delivers verified application source code, database migrations, synthetic demo seed data, setup and troubleshooting guides, test suites, and client handover package.
- **Client (ABC English Medium School):** Owns deployment, hosting infrastructure, domain/DNS routing, SSL/TLS certificates, live database operations, automated backup schedules, disaster recovery, end-user management, and ongoing software operations per signed engagement terms (BRD §13, SRS §1.3, DEC-09).

---

## 2. Prerequisites

Before setting up the project, ensure the following runtimes and tools are installed:

- **Node.js:** `v20.x` or `v24.x` (verified with `v24.12.0`)
- **npm:** `v10.x` or `v11.x` (verified with `11.6.2`)
- **Git:** `2.40+`
- **Docker Desktop:** Required for running the disposable local PostgreSQL and Supabase services.
- **Supabase CLI:** (Optional for frontend-only build; required for local migrations: `npm install -g supabase` or `winget install Supabase.CLI`).

---

## 2. Quickstart & Installation

### Step 1: Clone and Enter Repository
```bash
git clone https://github.com/Intallo/Admission-Fee-Management-Portal.git
cd Admission-Fee-Management-Portal
```

### Step 2: Configure Local Environment
Copy the safe template to `.env.local`:
```bash
cp .env.example .env.local
```
Review the `.env.local` settings:
- `NEXT_PUBLIC_SUPABASE_URL`: Defaults to `http://127.0.0.1:54321` (Local Supabase).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Default local publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: Service key for trusted server-side execution.
- `ALLOW_REMOTE_DATABASE`: Kept at `false` to guard against accidental connection to remote instances.

> [!CAUTION]
> **RETAINED REMOTE DATABASE GUARD:**  
> Connecting to the retained remote database (`fjrfyzamiirqzitdchkz`) during development or automated tests is **strictly prohibited**. The runtime environment validator (`src/lib/env.ts`) and database adapters (`src/infrastructure/db/guards.ts`) will fail-closed and abort immediately if any remote database URL is detected.

### Step 3: Install Dependencies
```bash
npm install
```
This generates `package-lock.json` and installs all approved dependencies.

---

## 3. Developer Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles a production-ready Next.js application with strict type and bundle checks |
| `npm run start` | Serves the production build |
| `npm run typecheck` | Executes `tsc --noEmit` to validate all TypeScript types |
| `npm run lint` | Runs Next.js ESLint checks |
| `npm test` | Runs all Vitest unit tests |
| `npm run test:watch` | Runs Vitest in interactive watch mode |

---

## 4. Disposable Local Database Workflow

All development and test executions must use a disposable local PostgreSQL container:

### Starting Local Supabase Stack
```bash
supabase start
```
This initializes local PostgreSQL 17 on `127.0.0.1:54322`, Auth and REST on `127.0.0.1:54321`, and Studio on `http://127.0.0.1:54323`.

### Applying Migrations and Seed
```bash
supabase db reset
```
This applies all migrations up through `20261030000000_provision_restricted_app_role.sql` and populates synthetic demonstration data from `supabase/seed.sql`.

### Verifying US-33 AC2 Least Privilege
The migration `20261030000000_provision_restricted_app_role.sql` provisions the `school_app_user` role with zero `DELETE` privileges across core tables and zero `UPDATE` privileges on the ledger. Run the SQL verification suite to assert rejection of unauthorized mutations:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/integrity_tests.sql
```

---

## 5. Architectural Boundaries & Conventions

1. **Server-Only Database Adapters:**
   - Database operations that use `SUPABASE_SERVICE_ROLE_KEY` are contained in `src/infrastructure/db/supabase-admin.ts` and marked with `import 'server-only'`.
   - Never import server-only database adapters or service keys into client components.
2. **Exact Decimal Monetary Arithmetic:**
   - Never use JavaScript `Number` or floating-point operators for financial math.
   - Always use `src/lib/money/inr.ts` (`addInr`, `subtractInr`, `multiplyInr`, `formatInr`, `amountInWordsInr`).
3. **Structured Logging and Secret Redaction:**
   - Use `logger.info`, `logger.warn`, `logger.error` from `src/lib/logger.ts`.
   - Sensitive fields (Aadhaar, passwords, JWT tokens, bank accounts, connection strings) are automatically redacted.
4. **RFC 7807 Standard Errors:**
   - API endpoints catch errors and format them using `formatErrorResponse` (`src/lib/errors.ts`), returning standardized problem details envelopes with correlation IDs.

---

## 6. Troubleshooting Common Issues

### Issue 1: `[DATABASE SAFETY GUARD] Connection to retained remote database ... is STRICTLY FORBIDDEN`
- **Cause:** Your `.env.local` or environment contains `NEXT_PUBLIC_SUPABASE_URL` or `DATABASE_URL` pointing to `fjrfyzamiirqzitdchkz` or a non-local host.
- **Fix:** Update `.env.local` to use `http://127.0.0.1:54321` and ensure `ALLOW_REMOTE_DATABASE=false`.

### Issue 2: `[SECURITY VIOLATION] Attempted to access server environment variables from client bundle`
- **Cause:** A Client Component (`'use client'`) attempted to import `getServerEnv()` or a server-only adapter.
- **Fix:** Move database queries and sensitive operations into Server Components, Route Handlers (`src/app/api/...`), or Server Actions. In client components, use `createBrowserDbClient()`.

### Issue 3: EPERM or Permission Denied on `node_modules` during `npm install` on Windows
- **Cause:** Windows file locking by IDE or Antivirus.
- **Fix:** Close active development servers or file watchers, delete `node_modules/.cache`, and retry `npm install`.

### Issue 4: Next.js Port 3000 in Use
- **Cause:** Another process is bound to port 3000.
- **Fix:** Run `npm run dev -- -p 3001` or terminate the lingering Node process via PowerShell:
  ```powershell
  Get-Process node | Stop-Process -Force
  ```
