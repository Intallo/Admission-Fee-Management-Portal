# ADR-002: Hardened Authentication Gateway Boundary & Shared Database Credential Limitations

- **Status:** Accepted
- **Date:** 2026-11-02
- **Owner:** Senior Backend Engineer
- **Approvers:** CTO, School Security Architecture Review
- **Related requirements/tasks:** BRD v1.4, SRS v1.4 (US-01, US-04, US-33 AC2), Milestone M8.3.3

---

## 1. Context

The School Admission & Fee Management Portal operates as a modular monolith where the server-side runtime connects to PostgreSQL via a connection pool. Under Milestone M8.1 and M8.2 remediation, all client operations connect through a dedicated, least-privileged PostgreSQL login role: `school_app_login` (a member of `school_app_user`).

However, utilizing a shared database login role introduces architectural security challenges:
1. **Unauthenticated Bootstrap Phase:** When an unauthenticated user arrives at `/login`, no trusted staff actor session exists yet (`app.current_staff_id` and `app.current_role` are unset).
2. **Direct Table Access Exposure:** If `school_app_login` holds direct `SELECT` or `UPDATE` privileges on `public.staff_security_profiles`, an attacker with SQL injection capabilities or direct database access could dump scrypt password hashes or alter password records for arbitrary accounts.
3. **Gateway Over-Privilege:** Previously, gateway functions in schema `private` accepted arbitrary `staff_id` arguments without verifying caller authorization, permitting unauthorized callers to retrieve password hashes, alter passwords, or tamper with account lockout counters.

---

## 2. Decision Drivers

- **Credential Confidentiality (DPDP Act & OWASP Top 10):** Scrypt password hashes, failed login counters, and lockout timestamps must never be accessible directly through table queries.
- **Fail-Closed Least Privilege:** The application database role (`school_app_login`) must be barred from reading or mutating `public.staff_security_profiles` directly.
- **Self-Service & Administrative Authorization:** Password updates must be strictly bounded: users may only modify their own password, and only `system_admin` may perform administrative resets.
- **Lockout Integrity (SRS US-01 AC3):** The 5-failed-attempt / 15-minute account lockout rule must be deterministically enforced by the database; callers must not be able to supply arbitrary lockout timestamps or reset counters without authorization.
- **Search Path Security:** Every `SECURITY DEFINER` function must operate with an immutable, empty `search_path` (`search_path = ''`) to prevent schema-hijacking attacks.

---

## 3. Options Considered

### Option 1: Direct Table Permissions on `public.staff_security_profiles` via RLS Policies
- *Description:* Grant `SELECT`, `UPDATE` on `public.staff_security_profiles` to `school_app_user`, relying exclusively on Row-Level Security (`staff_security_profiles_policy`).
- *Drawbacks:* RLS requires an active actor session. During unauthenticated login, no actor session exists. Allowing an unauthenticated fallback policy in RLS allows any connection to read table rows. Furthermore, if RLS is bypassed or misconfigured, raw password hashes are exposed.

### Option 2: Individual Database Accounts per Staff Member
- *Description:* Provision separate PostgreSQL roles for each staff member.
- *Drawbacks:* Incompatible with connection pooling (`max: 20`). Dynamic creation of hundreds of database roles introduces immense operational complexity and connection exhaustion.

### Option 3: Hardened `SECURITY DEFINER` Gateway Boundary with Cryptographic Actor Verification (Selected)
- *Description:*
  1. Revoke **ALL** table permissions on `public.staff_security_profiles` from `school_app_user` and `school_app_login`.
  2. Route all authentication operations through narrow `SECURITY DEFINER` functions in schema `private`.
  3. Enforce `set search_path = ''` on all `SECURITY DEFINER` functions with fully schema-qualified identifiers.
  4. Require cryptographic HMAC actor verification for password changes (self or `system_admin`) and lockout resets.
  5. Restrict unauthenticated credential lookup exclusively to matching active email addresses.

---

## 4. Decision

We formally adopt **Option 3**. The database boundary is defined as follows:

```
+-----------------------------------------------------------------------------+
|                          NEXT.JS SERVER APPLICATION                         |
|                                                                             |
|  Unauthenticated Flow:                      Authenticated Flow:             |
|  IdentityService.login(email, pass)         IdentityService.changePassword  |
|         |                                            |                      |
|  withSystemTransaction()                    withTransaction(session)        |
|  (actor_role = NULL)                        (signed app.actor_signature)   |
+---------|--------------------------------------------|----------------------+
          |                                            |
          |  Connection Pool (Role: school_app_login)  |
          v                                            v
+-----------------------------------------------------------------------------+
|                              POSTGRESQL ENGINE                              |
|                                                                             |
|  Direct Table Access:                                                       |
|  public.staff_security_profiles  ---> REVOKE ALL FROM school_app_login      |
|                                                                             |
|  Hardened Gateway Functions (Schema: private, search_path = ''):            |
|                                                                             |
|  1. auth_lookup_staff_by_email(email)       ---> Active staff metadata only |
|  2. auth_get_security_profile(id, email)    ---> Bounded by self/admin/email|
|  3. auth_record_login_attempt(id, success)  ---> 5 failures = 15m lock;     |
|                                                  success reset = self/admin |
|  4. auth_update_password(id, hash, must_ch) ---> Strictly self or sysadmin  |
|  5. auth_create_security_profile(id, hash)  ---> Strictly system_admin      |
+-----------------------------------------------------------------------------+
```

---

## 5. Limitations of a Shared Restricted Database Credential

While Option 3 establishes strong defense-in-depth, operations and engineering teams must recognize the inherent architectural limitations of utilizing a shared connection credential (`school_app_login`):

1. **Database Cannot Distinguish Web Worker Threads:**
   Because all pooled connections authenticate with the same database user (`school_app_login`), PostgreSQL cannot determine which end user initiated a query without application-level session variables (`app.current_staff_id`, `app.current_role`, `app.actor_signature`).
2. **Reliance on Server-Side Session Signing:**
   Row-Level Security and gateway authorizations rely on HMAC-SHA256 actor signatures generated using `ACTOR_SIGNING_SECRET`. If `ACTOR_SIGNING_SECRET` were compromised, an attacker connecting as `school_app_login` could forge any staff identity. Hence, secret lifecycle management (ADR-002 & `DATABASE_MIGRATION_RUNBOOK.md` §5) is critical.
3. **Unauthenticated Login Exposure Surface:**
   Because unauthenticated login must verify passwords before an actor session exists, the gateway function `auth_get_security_profile(id, email)` must permit querying password hashes when supplied with an active, matching email address. While arbitrary UUID scanning is prevented, an attacker with direct SQL access who knows a staff email can inspect their scrypt hash through this function. (Mitigated by scrypt work factor `N=16384, r=8, p=1`).

---

## 6. Consequences

### Positive Outcomes
- **Zero Direct Table Access:** Restricted application connections cannot execute direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` against `public.staff_security_profiles`.
- **Arbitrary Password Modification Eliminated:** Calling `auth_update_password` without an authenticated session or for an unrelated staff member fails immediately with PostgreSQL error code `42501` (Unauthorized).
- **Deterministic 15-Minute Lockout:** Failed attempts automatically lock the account for 15 minutes upon reaching 5 failures; caller-controlled lockout durations are completely removed.
- **Search Path Immunity:** All 12 `SECURITY DEFINER` functions enforce `set search_path = ''`, preventing search-path hijacking attacks.

### Trade-offs & Risks
- **Application Pool Hygiene:** Connection pool clients must guarantee execution of `RESET ALL` in `finally` blocks to prevent session variable leakage between transactions.
- **Migration Dependency Order:** Down migrations must restore unverified gateway variants before dropping system secret vaults.

---

## 7. Validation Plan

1. **Direct SQL Least-Privilege Tests (`tests/auth_gateway_security.test.ts`):**
   - Direct `SELECT` against `public.staff_security_profiles` as `school_app_login` throws permission denied.
   - Unauthenticated `auth_get_security_profile(victim_id)` returns 0 rows.
   - Cross-role `auth_get_security_profile` (clerk inspecting principal) returns 0 rows.
   - Unauthenticated `auth_update_password` throws `42501`.
   - Cross-role `auth_update_password` throws `42501`.
   - Unauthenticated `auth_record_login_attempt(victim_id, true)` throws `42501`.
   - 5 consecutive failures deterministically trigger `locked_until = now() + 15 minutes`.
   - Authorized self-service password update succeeds.
   - Authorized administrative password reset succeeds.
2. **End-to-End Vitest & Next.js Build:**
   - 100% pass on Vitest test suite.
   - Clean Next.js production build.
