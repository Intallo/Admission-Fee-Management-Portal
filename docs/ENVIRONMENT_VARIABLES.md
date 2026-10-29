# Environment Variable Reference & Security Attestation (Phase 7 Handover)

**Document Code:** P7-ENV-REF-001  
**Project:** School Admission & Fee Management Portal  
**Target Organization:** ABC English Medium School  
**Configuration File:** `.env.example` -> `.env.local`  
**Validation Module:** [`src/lib/env.ts`](file:///src/lib/env.ts) (Zod Schema Validation)  
**Verification Date:** 29 October 2026  
**Status:** **Audited & Verified (Zero Committed Secrets)**  

---

## 1. Security Attestation & Secret Isolation Rules

1. **Zero Committed Secrets:** No real production secrets, private encryption keys, actual database passwords, or third-party service tokens are stored in version control or this document.
2. **Strict Client vs Server Isolation:**
   - **Client-Accessible (`NEXT_PUBLIC_*`):** Only variables prefixed with `NEXT_PUBLIC_` are bundled into browser JavaScript. These contain public Supabase endpoints and publishable keys.
   - **Server-Only (Protected Secrets):** Variables without the `NEXT_PUBLIC_` prefix (such as `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`) are strictly forbidden in client-side code. If any client component attempts to import or read server secrets, [`src/lib/env.ts`](file:///src/lib/env.ts) throws an immediate security exception: `[SECURITY VIOLATION] Attempted to access server environment variables from client bundle!`.
3. **Automated Database Target Guard (`assertSafeDatabaseTarget`):**
   - Development and testing environments strictly reject connection attempts to the retained remote Supabase database (`fjrfyzamiirqzitdchkz`).
   - If `ALLOW_REMOTE_DATABASE=false` (default), the application will immediately abort execution if `NEXT_PUBLIC_SUPABASE_URL` or `DATABASE_URL` targets any host other than `127.0.0.1`, `localhost`, or `host.docker.internal`.

---

## 2. Complete Environment Variable Reference Table

| Variable Name | Scope | Required / Optional | Consumed By | Architectural Purpose | Sample / Local Default |
|---|:---:|:---:|---|---|---|
| **`NEXT_PUBLIC_SUPABASE_URL`** | **Client & Server** | **Required** | Browser Supabase client, Server API handlers | The base URL for Supabase API gateway and authentication endpoints. | `http://127.0.0.1:54321` |
| **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** | **Client & Server** | **Required** | Browser Supabase client | The public publishable/anon API key used for public client-side Supabase SDK calls. | `sb_publishable_local_dev_key` |
| **`SUPABASE_SERVICE_ROLE_KEY`** | **Server Only** | **Required** | Server-side domain services & staff lookups | High-privilege service-role key used strictly on trusted server runtime to bypass RLS for administrative operations. **NEVER expose to browser.** | `sb_service_role_local_dev_key` |
| **`DATABASE_URL`** | **Server Only** | Optional (Dev/CLI) | Database migration scripts & CLI tools | Direct PostgreSQL connection string for applying migrations and running SQL tests. | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| **`ALLOW_REMOTE_DATABASE`** | **Server Only** | Optional | [`src/lib/env.ts`](file:///src/lib/env.ts) Safety Guard | Safety toggle. Set to `false` in development and test environments to prevent connection to cloud databases. Must be set to `true` only in verified live production. | `false` |
| **`NEXT_TELEMETRY_DISABLED`** | **Build & Runtime** | Optional (Recommended) | Next.js Engine | Disables Next.js anonymous telemetry pings and outbound network checks. Recommended in isolated CI/build environments. | `1` |
| **`PORT`** | **Runtime** | Optional | Next.js Server | The TCP port for the Next.js HTTP server. Defaults to `3000`. | `3000` |

---

## 3. Template Configuration File (`.env.example`)

The following clean template is maintained in the repository root at [`.env.example`](file:///C:/Users/shash/OneDrive/Desktop/PROJECTS/Admission-Fee-Management-Portal/.env.example):

```ini
# ==============================================================================
# ABC English Medium School — Admission & Fee Management Portal
# Environment Configuration Template
# ==============================================================================
# Copy this file to .env.local for local development.
# NEVER commit .env, .env.local, production credentials, or service keys to git.
# ==============================================================================

# --- Client-Facing Variables (Exposed to Browser) ---
# For local development with Supabase CLI (default):
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_dev_key

# --- Server-Only Variables (STRICTLY FORBIDDEN IN CLIENT BUNDLES) ---
# Privileged service role key used for server-side API handlers and staff directory lookups.
# Never prefix with NEXT_PUBLIC_ or import into client components.
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_local_dev_key

# Local PostgreSQL connection URL (optional, for CLI migrations and direct scripts)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# --- Database Safety Guards ---
# Setting this to false prevents tests and local server from connecting to any non-local database.
# Development and tests connecting to retained remote ref 'fjrfyzamiirqzitdchkz' will abort immediately.
ALLOW_REMOTE_DATABASE=false
NEXT_TELEMETRY_DISABLED=1
```
