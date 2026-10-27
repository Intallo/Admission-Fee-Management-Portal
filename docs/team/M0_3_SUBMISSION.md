# Task Submission — Milestone M0.3: Environment and Script Safety Inventory

**Task Code:** M0.3  
**Task Title:** Environment and Script Safety Inventory  
**Task Owner:** Shashidhar (Project Lead & Architecture Owner)  
**Assigned Reviewer:** Sujal (Frontend / UI-UX & Quality Owner)  
**Submission Date:** 2026-10-27  
**Status:** In Review  
**Git Branch:** `task/m0-3-environment-safety`  

---

## 1. Summary of Changes

- **Audited Configuration:** Created a comprehensive environment variable register in [`ENVIRONMENT_VARIABLES.md`](../../ENVIRONMENT_VARIABLES.md), documenting exact variable names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`), roles, defaults, and strict client/server secret isolation.
- **Audited Tooling & Runbook:** Updated [`SETUP.md`](../../SETUP.md) with verified host tool versions (Node.js, npm, Git, Docker), identified missing prerequisites (Supabase CLI on PATH, application `package.json`), and categorized safe lifecycle commands.
- **Verification Script Safety Review:** Conducted a line-by-line safety analysis of `supabase/tests/verification.sql` (proven **100% read-only**, zero writes, safe for retained database) and `supabase/tests/integrity_tests.sql` (speculative write/rollback tests, strictly restricted to disposable local Docker databases).
- **Zero Secrets / Zero Writes:** No credentials, private tokens, or `.env` values were exposed; zero destructive commands or database writes were executed.

---

## 2. Tool Versions & Host Environment

| Tool | Executed Command | Version Output | Status |
|---|---|---|:---:|
| **Node.js** | `node -v` | `v24.12.0` | Installed |
| **npm** | `npm -v` | `11.6.2` | Installed |
| **Git** | `git --version` | `git version 2.48.1.windows.1` | Installed |
| **Docker** | `docker --version` | `Docker version 29.8.2, build 7fc2dff` | Installed |
| **Python** | `python --version` | `Python 3.14.2` | Installed |
| **Supabase CLI** | `supabase --version` | `CommandNotFoundException` | **BLOCKER (Missing on PATH)** |
| **Application Manifest** | `Test-Path .\package.json` | `False` | **PENDING (Pre-M1.1 ADR)** |

---

## 3. Safe Commands Executed & Redacted Output

### Command 1: Tool Version Check
```powershell
node -v; npm -v; git --version; docker --version; python --version
```
**Output (Redacted):**
```text
v24.12.0
11.6.2
git version 2.48.1.windows.1
Docker version 29.8.2, build 7fc2dff
Python 3.14.2
```

### Command 2: Application Manifest Presence Check
```powershell
Test-Path .\package.json
```
**Output:**
```text
False
```

### Command 3: Verification Script Safety Inspection
Inspected `supabase/tests/verification.sql` via read-only file read.
- **Result:** Single `SELECT jsonb_build_object(...)` statement.
- **Queries:** `SELECT count(*)` on tables, `bool_and(c.relrowsecurity)` for RLS verification, allocation consistency checks.
- **Database Writes:** 0 statements modifying state.

---

## 4. Script Safety Review

| Script Path | Purpose | Execution Safety Profile | Target Environment |
|---|---|---|---|
| `supabase/tests/verification.sql` | Post-migration read-only schema and row-count verification. | **100% Read-Only.** Contains only `SELECT` queries across `information_schema` and public tables. Zero side effects. | **Safe for any database, including remote retained DB.** |
| `supabase/tests/integrity_tests.sql` | Constraint and error-handling tests checking DB rejections. | **Speculative Writes with Rollback.** Executes DML inside `BEGIN ... EXCEPTION ... ROLLBACK`. Creates session temporary functions. | **Restricted to disposable local Docker DB only.** |
| `supabase db reset` | Local database rebuild and synthetic seed reload. | **DESTRUCTIVE.** Drops all local tables, reapplies migrations, and loads `seed.sql`. | **NEVER run on remote / retained database.** |

---

## 5. Known Environment Blockers & Missing Prerequisites

1. **Supabase CLI Missing on PATH:**
   - **Impact:** Local Supabase commands (`supabase start`, `supabase db reset`, `supabase gen types`) cannot run directly from the command line.
   - **Remediation:** Install globally via `npm install -g supabase` or package manager (`winget install Supabase.CLI`).
2. **Missing Application Manifest (`package.json`):**
   - **Impact:** Frontend and application modules have not yet been initialized in this repository baseline.
   - **Remediation:** Expected at milestone M0; framework choice, routing structure, and package dependencies will be evaluated and approved in Milestone M1.1 (Architecture ADR).
3. **Docker Config Permission:**
   - **Impact:** Docker CLI produced a permission warning reading `C:\Users\shash\.docker\config.json`.
   - **Remediation:** Ensure Docker Desktop is launched and running before executing local container commands.

---

## 6. Acceptance Criteria Checklist

| Acceptance Criterion | Result | Evidence / Implementation Reference |
|---|---|---|
| **AC-1:** Required tooling and configuration are documented | **PASS** | `SETUP.md` §2 and `ENVIRONMENT_VARIABLES.md` §1 detail all tools and keys. |
| **AC-2:** Verification script behavior understood before execution | **PASS** | `SETUP.md` §5 and submission §4 review `verification.sql` and `integrity_tests.sql`. |
| **AC-3:** No credentials exposed | **PASS** | Only placeholders used; `.env` ignored; zero real keys or tokens pasted. |
| **AC-4:** No destructive script or database write run | **PASS** | Database impact is strictly read-only; no reset or write executed against retained DB. |
| **AC-5:** Known environment blockers listed | **PASS** | Supabase CLI on PATH, missing `package.json`, and Docker config noted in §5. |

---

## 7. Reviewer Action Required

- **Assigned Reviewer:** Sujal (`sujalv641@gmail.com`)
- **Review Policy:** Per [`docs/team/REVIEW_AND_SUBMISSION_POLICY.md`](REVIEW_AND_SUBMISSION_POLICY.md), author (Shashidhar) cannot self-approve. Sujal must review this environment inventory and verification safety analysis before accepting M0.3.
