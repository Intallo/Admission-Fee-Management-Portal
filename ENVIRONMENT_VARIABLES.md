# Environment Variables Register (Milestone M0.3)

**Task:** M0.3 — Environment and Script Safety Inventory  
**Task Owner:** Shashidhar (Project Lead & Architecture Owner)  
**Independent Reviewer:** Sujal (Frontend / UI-UX & Quality Owner)  
**Authority:** Audited from tracked repository files (`.env.example`, `supabase/config.toml`, `DATABASE.md`)  
**Security Attestation:** No actual secrets, credentials, or production connection strings are included in this document.  

---

## 1. Tracked Environment Variables Table

| Variable Name | Required / Optional | Consumed By | Architectural Purpose | Secret? | Default / Local Handling | Verified In Repository At |
|---|:---:|---|---|:---:|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Mandatory** | Browser & Server Client SDK | Base HTTPS URL endpoint for Supabase REST, Auth, and Storage APIs. | **No** (Public) | Local: `http://127.0.0.1:54321`<br>Hosted: `https://fjrfyzamiirqzitdchkz.supabase.co` | `.env.example:3`<br>`DATABASE.md:53` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Mandatory** | Browser Client SDK | Anon/Publishable API key for client-side queries, strictly constrained by PostgreSQL Row-Level Security (RLS). | **No** (Public) | Generated dynamically by `supabase start` for local development; retrieved from project dashboard for hosted. | `.env.example:4` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Mandatory** | Trusted Server-Side API / Backend Services Only | Privileged service key that bypasses RLS to execute staff-role operations, payment allocations, and audit logs. | **YES (CRITICAL)** | Injected strictly in server environment or local `.env.local`. **NEVER** expose to browser or prefix with `NEXT_PUBLIC_`. | `.env.example:7`<br>`README.md:9`<br>`DATABASE.md:9` |
| `DATABASE_URL` | Optional | Direct CLI, Migrations, Seed, & ORM Tools | Direct PostgreSQL connection URI (`postgresql://user:password@host:port/dbname`). | **YES (CRITICAL)** | Local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Never use shared/production DB credentials here. | `.env.example:10`<br>`DATABASE.md:36` |

---

## 2. Security & Secret Isolation Rules

1. **Strict Client/Server Separation:**
   - Only variables prefixed with `NEXT_PUBLIC_` are allowed in browser-facing bundles.
   - `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` must remain strictly server-side.
2. **Fail-Closed Configuration:**
   - Server-side modules must validate that `SUPABASE_SERVICE_ROLE_KEY` is present at startup and abort immediately with a clear error message (without echoing the key) if missing.
3. **Repository Cleanliness Guardrails:**
   - `.env`, `.env.local`, `.env.production`, `*.pem`, and `*.key` are enforced in [`.gitignore`](.gitignore).
   - `.env.example` contains only non-sensitive placeholder tokens (`YOUR_PROJECT_REF`, `SET_ONLY_IN_TRUSTED_SERVER_ENVIRONMENT`).
   - Never commit live database credentials or session tokens to git or paste them in issue trackers.

---

## 3. Configuration Management by Environment

| Setting / Key | Local Disposable Stack (Docker) | Demo / Staging Environment | Production (Client-Managed) |
|---|---|---|---|
| **Supabase URL** | `http://127.0.0.1:54321` | `https://fjrfyzamiirqzitdchkz.supabase.co` | Client-hosted Supabase URL |
| **Auth Site URL** | `http://localhost:3000` | Configured staging domain | Client production domain |
| **JWT Expiry** | 3600 seconds (1 hour) | 3600 seconds | Configurable per school policy |
| **File Storage Bucket** | `admission-documents` (Local MinIO/Storage) | `admission-documents` (Private S3/GCS) | Private object storage |
| **Max File Upload Size** | 10 MiB (`supabase/config.toml:24`) | 10 MiB | 10 MiB |
