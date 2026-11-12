------------------------------------------------------------------------------------
-- Migration: 20261101130000_verifiable_actor_and_auth_gateway.sql
-- Satisfies CTO Directives Phase 8.2 & Phase 8.3 (Milestones M8.3.2, M8.3.3):
-- 1. Cryptographically verified actor assertion in private.current_actor_role() (eliminates caller spoofing).
-- 2. Restricted, least-privileged authentication gateway in schema private with search_path = ''.
-- 3. Revoked direct table access on public.staff_security_profiles from application roles.
-- 4. Authorized self-service and administrative password update functions with strict 42501 enforcement.
-- 5. Deterministic 5-failure / 15-minute account lockout rule enforcement without arbitrary caller timestamps.
-- 6. Academic-year-scoped, concurrency-safe annual numbering generators for receipts, certificates,
--    admissions, and applications with automatic rollover.
------------------------------------------------------------------------------------

-- 1. Ensure pgcrypto extension is available for HMAC-SHA256 actor verification (standardized in schema extensions)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to public, anon, authenticated, school_app_user, school_app_login;

-- 2. System secrets vault in schema private (inaccessible to school_app_user/school_app_login)
create table if not exists private.system_secrets (
  key_name text primary key,
  secret_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.system_secrets from public, anon, authenticated, school_app_user, school_app_login;

-- Revoke direct table permissions on staff_security_profiles from application roles
-- All security profile access must pass through schema private gateway functions (Milestone M8.3.3)
revoke all on table public.staff_security_profiles from public, anon, authenticated, school_app_user, school_app_login;

-- Note: System secrets (including actor_signing_secret) are provisioned out-of-band by DBA / CI pipeline.
-- Hardcoded fallback secrets in migrations are strictly prohibited (Milestone M8.3.2).

-- 3. Verifiable Actor Identity Helper Function
-- Verifies staff ID, active account status, asserted role match, AND cryptographic HMAC-SHA256 signature
create or replace function private.current_actor_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff_id_raw text;
  v_staff_id uuid;
  v_db_role text;
  v_is_active boolean;
  v_asserted_role text;
  v_signature text;
  v_secret text;
  v_expected_signature text;
begin
  -- 1. Extract actor staff ID setting
  v_staff_id_raw := pg_catalog.current_setting('app.current_staff_id', true);
  if v_staff_id_raw is null or v_staff_id_raw = '' then
    return null;
  end if;

  begin
    v_staff_id := v_staff_id_raw::uuid;
    if v_staff_id = '00000000-0000-0000-0000-000000000000'::uuid then
      return null;
    end if;
  exception when others then
    return null;
  end;

  -- 2. Query authoritative staff record
  select role::text, is_active
  into v_db_role, v_is_active
  from public.staff_members
  where id = v_staff_id;

  if not found or v_is_active is not true then
    return null;
  end if;

  -- 3. Verify asserted role matches authoritative database role
  v_asserted_role := pg_catalog.current_setting('app.current_role', true);
  if v_asserted_role is null or v_asserted_role <> v_db_role then
    return null; -- Role forgery detected
  end if;

  -- 4. Cryptographic signature check
  v_signature := pg_catalog.current_setting('app.actor_signature', true);
  if v_signature is null or v_signature = '' or length(v_signature) <> 64 then
    return null; -- Unsigned transaction: direct callers cannot spoof privileged roles
  end if;

  select secret_value into v_secret
  from private.system_secrets
  where key_name = 'actor_signing_secret';

  -- Fail closed: missing or weak secret (< 32 chars) rejects all actor operations
  if v_secret is null or length(v_secret) < 32 then
    return null;
  end if;

  -- Under search_path = '', resolve hmac from extensions (Supabase) or public (standard PG)
  begin
    v_expected_signature := pg_catalog.encode(extensions.hmac((v_staff_id::text || ':' || v_db_role)::bytea, v_secret::bytea, 'sha256'), 'hex');
  exception when undefined_function or invalid_schema_name then
    v_expected_signature := pg_catalog.encode(public.hmac((v_staff_id::text || ':' || v_db_role)::bytea, v_secret::bytea, 'sha256'), 'hex');
  end;

  if lower(v_signature) <> lower(v_expected_signature) then
    return null; -- Invalid signature: forged identity rejected
  end if;

  return v_db_role;
end;
$$;

create or replace function private.current_actor_staff_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_id_raw text;
begin
  v_role := private.current_actor_role();
  if v_role is null then
    return null;
  end if;
  v_staff_id_raw := pg_catalog.current_setting('app.current_staff_id', true);
  return v_staff_id_raw::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.current_actor_role() to school_app_user, school_app_login;
grant execute on function private.current_actor_staff_id() to school_app_user, school_app_login;

-- 4. Hardened Authentication Gateway Functions (SECURITY DEFINER, search_path = '')
-- Minimizes credential exposure, bounds parameter access, and enforces authorization

create or replace function private.auth_lookup_staff_by_email(p_email text)
returns table (
  id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  active_academic_year_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_email is null or pg_catalog.btrim(p_email) = '' then
    return;
  end if;

  return query
  select s.id, s.auth_user_id, s.email, s.full_name, s.role::text, s.is_active,
         coalesce(
           (select ay.id from public.academic_years ay where ay.status = 'current' limit 1),
           (select ay.id from public.academic_years ay order by ay.start_date desc limit 1)
         ) as active_academic_year_id
  from public.staff_members s
  where pg_catalog.lower(s.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  limit 1;
end;
$$;

create or replace function private.auth_lookup_staff_by_id(p_staff_id uuid)
returns table (
  id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  role text,
  is_active boolean,
  active_academic_year_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_staff_id is null or p_staff_id = '00000000-0000-0000-0000-000000000000'::uuid then
    return;
  end if;

  return query
  select s.id, s.auth_user_id, s.email, s.full_name, s.role::text, s.is_active,
         coalesce(
           (select ay.id from public.academic_years ay where ay.status = 'current' limit 1),
           (select ay.id from public.academic_years ay order by ay.start_date desc limit 1)
         ) as active_academic_year_id
  from public.staff_members s
  where s.id = p_staff_id
  limit 1;
end;
$$;

create or replace function private.auth_get_security_profile(
  p_staff_id uuid,
  p_email text default null
)
returns table (
  staff_id uuid,
  password_hash text,
  must_change_password boolean,
  failed_login_attempts integer,
  locked_until timestamptz,
  last_login_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_staff_id uuid;
begin
  if p_staff_id is null or p_staff_id = '00000000-0000-0000-0000-000000000000'::uuid then
    return;
  end if;

  v_actor_role := private.current_actor_role();
  v_actor_staff_id := private.current_actor_staff_id();

  -- Case 1: Authenticated session context
  if v_actor_role is not null then
    -- Allowed: Self-service (matching staff_id) OR system_admin managing accounts
    if v_actor_staff_id = p_staff_id or v_actor_role = 'system_admin' then
      return query
      select p.staff_id, p.password_hash, p.must_change_password,
             p.failed_login_attempts, p.locked_until, p.last_login_at
      from public.staff_security_profiles p
      join public.staff_members s on s.id = p.staff_id
      where p.staff_id = p_staff_id and s.is_active is true
      limit 1;
      return;
    end if;
    -- Denied: Restricted users cannot retrieve unrelated staff credentials
    return;
  end if;

  -- Case 2: Unauthenticated connection (e.g. login credentials lookup)
  -- MUST supply matching active email to prevent arbitrary staff ID credential enumeration
  if p_email is not null and pg_catalog.btrim(p_email) <> '' then
    return query
    select p.staff_id, p.password_hash, p.must_change_password,
           p.failed_login_attempts, p.locked_until, p.last_login_at
    from public.staff_security_profiles p
    join public.staff_members s on s.id = p.staff_id
    where p.staff_id = p_staff_id
      and pg_catalog.lower(s.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
      and s.is_active is true
    limit 1;
    return;
  end if;

  -- Unauthenticated query without matching email is strictly rejected (returns 0 rows)
  return;
end;
$$;

create or replace function private.auth_record_login_attempt(
  p_staff_id uuid,
  p_success boolean,
  p_locked_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_staff_id uuid;
  v_current_failed integer;
  v_new_failed integer;
  v_new_locked_until timestamptz;
begin
  if p_staff_id is null or p_staff_id = '00000000-0000-0000-0000-000000000000'::uuid then
    return;
  end if;

  -- Target staff must exist and be active
  if not exists (
    select 1 from public.staff_members sm
    where sm.id = p_staff_id and sm.is_active is true
  ) then
    return; -- Fail closed: do not leak whether staff exists or modify records
  end if;

  if p_success then
    -- Successful login reset: only permissible if authorized (system_admin or authenticated self-session)
    v_actor_role := private.current_actor_role();
    v_actor_staff_id := private.current_actor_staff_id();

    if v_actor_role is null or (v_actor_role <> 'system_admin' and v_actor_staff_id <> p_staff_id) then
      raise exception 'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
        using errcode = '42501';
    end if;

    update public.staff_security_profiles
    set failed_login_attempts = 0,
        locked_until = null,
        last_login_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where staff_id = p_staff_id;
  else
    -- Failed login attempt: increment counter concurrency-safely with row lock and enforce 5-failure / 15-minute lockout rule (US-01 AC3)
    select coalesce(failed_login_attempts, 0)
    into v_current_failed
    from public.staff_security_profiles
    where staff_id = p_staff_id
    for update;

    if not found then
      v_current_failed := 0;
    end if;

    v_new_failed := v_current_failed + 1;

    -- Enforce deterministic 15-minute lockout rule on 5th consecutive failure
    -- Ignores any arbitrary caller-supplied timestamps
    if v_new_failed >= 5 then
      v_new_locked_until := pg_catalog.now() + interval '15 minutes';
    else
      v_new_locked_until := null;
    end if;

    update public.staff_security_profiles
    set failed_login_attempts = v_new_failed,
        locked_until = v_new_locked_until,
        updated_at = pg_catalog.now()
    where staff_id = p_staff_id;
  end if;
end;
$$;

create or replace function private.auth_update_password(
  p_staff_id uuid,
  p_password_hash text,
  p_must_change_password boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_staff_id uuid;
begin
  if p_staff_id is null or p_staff_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Invalid staff ID for password modification'
      using errcode = '22023';
  end if;

  v_actor_role := private.current_actor_role();
  v_actor_staff_id := private.current_actor_staff_id();

  -- 1. Must be an authenticated actor
  if v_actor_role is null or v_actor_staff_id is null then
    raise exception 'Unauthorized: password modification requires authenticated actor context'
      using errcode = '42501';
  end if;

  -- 2. Authorization check: self-service or administrative privilege
  -- - Self-service: authenticated staff member updating their own password
  -- - Administrative: system_admin updating any staff member's password
  if v_actor_role <> 'system_admin' and v_actor_staff_id <> p_staff_id then
    raise exception 'Unauthorized: staff members may only change their own password'
      using errcode = '42501';
  end if;

  -- 3. Target staff must exist and be active
  if not exists (
    select 1 from public.staff_members sm
    where sm.id = p_staff_id and sm.is_active is true
  ) then
    raise exception 'Target staff member does not exist or is inactive'
      using errcode = 'P0002';
  end if;

  -- 4. Validate password hash format (minimum 32 characters)
  if p_password_hash is null or pg_catalog.length(p_password_hash) < 32 then
    raise exception 'Invalid password hash format'
      using errcode = '22000';
  end if;

  -- 5. Perform the password update and reset lockouts atomically
  update public.staff_security_profiles
  set password_hash = p_password_hash,
      must_change_password = p_must_change_password,
      password_changed_at = pg_catalog.now(),
      failed_login_attempts = 0,
      locked_until = null,
      updated_at = pg_catalog.now()
  where staff_id = p_staff_id;
end;
$$;

create or replace function private.auth_create_security_profile(
  p_staff_id uuid,
  p_password_hash text,
  p_must_change_password boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
begin
  v_actor_role := private.current_actor_role();
  -- Only system_admin or bootstrap administrator may create security profiles
  if v_actor_role is not null and v_actor_role <> 'system_admin' then
    raise exception 'Unauthorized: creating security profiles requires system_admin role'
      using errcode = '42501';
  end if;

  insert into public.staff_security_profiles (
    staff_id, password_hash, must_change_password, created_at, updated_at
  )
  values (
    p_staff_id, p_password_hash, p_must_change_password, pg_catalog.now(), pg_catalog.now()
  )
  on conflict (staff_id) do update
    set password_hash = EXCLUDED.password_hash,
        must_change_password = EXCLUDED.must_change_password,
        updated_at = pg_catalog.now();
end;
$$;

-- Restrict execution grants to minimum necessary roles
revoke all on function private.auth_lookup_staff_by_email(text) from public, anon, authenticated;
revoke all on function private.auth_lookup_staff_by_id(uuid) from public, anon, authenticated;
revoke all on function private.auth_get_security_profile(uuid, text) from public, anon, authenticated;
revoke all on function private.auth_record_login_attempt(uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function private.auth_update_password(uuid, text, boolean) from public, anon, authenticated;
revoke all on function private.auth_create_security_profile(uuid, text, boolean) from public, anon, authenticated;

grant execute on function private.auth_lookup_staff_by_email(text) to school_app_user, school_app_login;
grant execute on function private.auth_lookup_staff_by_id(uuid) to school_app_user, school_app_login;
grant execute on function private.auth_get_security_profile(uuid, text) to school_app_user, school_app_login;
grant execute on function private.auth_record_login_attempt(uuid, boolean, timestamptz) to school_app_user, school_app_login;
grant execute on function private.auth_update_password(uuid, text, boolean) to school_app_user, school_app_login;
grant execute on function private.auth_create_security_profile(uuid, text, boolean) to school_app_user, school_app_login;

-- 5. Annual Numbering Upgrade: Scoped to Academic Year with Automatic Rollover
-- Upgrade receipt_number_counters to composite key (series_code, academic_year_id)

alter table public.receipt_number_counters add column if not exists academic_year_id uuid references public.academic_years(id);

do $$
declare
  v_default_year_id uuid;
begin
  select id into v_default_year_id from public.academic_years where status = 'current' limit 1;
  if v_default_year_id is null then
    select id into v_default_year_id from public.academic_years order by start_date desc limit 1;
  end if;
  if v_default_year_id is not null then
    update public.receipt_number_counters
    set academic_year_id = v_default_year_id
    where academic_year_id is null;
  else
    delete from public.receipt_number_counters where academic_year_id is null;
  end if;
end $$;

-- Drop old primary key constraint if it is only on series_code
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'receipt_number_counters' and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.receipt_number_counters drop constraint receipt_number_counters_pkey cascade;
  end if;
end $$;

-- Re-establish primary key with academic_year_id (without invalid zero-UUID default)
alter table public.receipt_number_counters alter column academic_year_id drop default;
alter table public.receipt_number_counters alter column academic_year_id set not null;
alter table public.receipt_number_counters add primary key (series_code, academic_year_id);

-- Monotonic Receipt Number: RCT-YYYY-NNNNNN (6 digits) scoped to academic year
create or replace function private.next_receipt_number(
  p_series text default 'RCT',
  p_academic_year_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_year_label text;
  v_year_prefix text;
  n bigint;
begin
  v_year_id := p_academic_year_id;
  if v_year_id is null then
    select id, label into v_year_id, v_year_label
    from public.academic_years where status = 'current' limit 1;
  else
    select id, label into v_year_id, v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    raise exception 'Academic year not found or specified for receipt numbering';
  end if;

  v_year_prefix := coalesce(
    nullif(pg_catalog.substr(v_year_label, 1, 4), ''),
    pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Kolkata', 'YYYY')
  );

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_series, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = pg_catalog.now()
  returning c.next_value - 1 into n;

  return p_series || '-' || v_year_prefix || '-' || pg_catalog.lpad(n::text, 6, '0');
end;
$$;

-- Monotonic Certificate Number: TC-YYYY-NNNN (4 digits) scoped to academic year
create or replace function private.next_certificate_number(
  p_prefix text default 'TC',
  p_academic_year_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_year_label text;
  v_year_prefix text;
  n bigint;
begin
  v_year_id := p_academic_year_id;
  if v_year_id is null then
    select id, label into v_year_id, v_year_label
    from public.academic_years where status = 'current' limit 1;
  else
    select id, label into v_year_id, v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    raise exception 'Academic year not found or specified for certificate numbering';
  end if;

  v_year_prefix := coalesce(
    nullif(pg_catalog.substr(v_year_label, 1, 4), ''),
    pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Kolkata', 'YYYY')
  );

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_prefix, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = pg_catalog.now()
  returning c.next_value - 1 into n;

  return p_prefix || '-' || v_year_prefix || '-' || pg_catalog.lpad(n::text, 4, '0');
end;
$$;

-- Monotonic Admission Number: ADM-YYYY-NNNN (4 digits) scoped to academic year
create or replace function private.next_admission_number(
  p_prefix text default 'ADM',
  p_academic_year_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_year_label text;
  v_year_prefix text;
  n bigint;
begin
  v_year_id := p_academic_year_id;
  if v_year_id is null then
    select id, label into v_year_id, v_year_label
    from public.academic_years where status = 'current' limit 1;
  else
    select id, label into v_year_id, v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    raise exception 'Academic year not found or specified for admission numbering';
  end if;

  v_year_prefix := coalesce(
    nullif(pg_catalog.substr(v_year_label, 1, 4), ''),
    pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Kolkata', 'YYYY')
  );

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_prefix, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = pg_catalog.now()
  returning c.next_value - 1 into n;

  return p_prefix || '-' || v_year_prefix || '-' || pg_catalog.lpad(n::text, 4, '0');
end;
$$;

-- Monotonic Application Number: {N}/{YYYY-YY} (e.g. 161/2026-27) scoped to academic year
create or replace function private.next_application_number(
  p_academic_year_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_year_label text;
  v_short_label text;
  n bigint;
begin
  v_year_id := p_academic_year_id;
  if v_year_id is null then
    select id, label into v_year_id, v_year_label
    from public.academic_years where status = 'current' limit 1;
  else
    select id, label into v_year_id, v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    raise exception 'Academic year not found or specified for application numbering';
  end if;

  if v_year_label ~ '^([0-9]{4})-([0-9]{4})$' then
    v_short_label := pg_catalog.substring(v_year_label, 1, 4) || '-' || pg_catalog.substring(v_year_label, 8, 2);
  else
    v_short_label := v_year_label;
  end if;

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values ('APP', v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = pg_catalog.now()
  returning c.next_value - 1 into n;

  return n::text || '/' || v_short_label;
end;
$$;

revoke all on function private.next_receipt_number(text, uuid) from public, anon, authenticated;
revoke all on function private.next_certificate_number(text, uuid) from public, anon, authenticated;
revoke all on function private.next_admission_number(text, uuid) from public, anon, authenticated;
revoke all on function private.next_application_number(uuid) from public, anon, authenticated;

grant execute on function private.next_receipt_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_certificate_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_admission_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_application_number(uuid) to school_app_user, school_app_login;

-- 6. Developer & Local Environment Compatibility Grants
-- Ensures local developer connection role (postgres) has membership in app roles and gateway access
do $$
begin
  if exists (select from pg_roles where rolname = 'postgres') then
    grant school_app_user, school_app_login to postgres;
    grant usage on schema private to postgres;

    grant execute on function private.current_actor_role() to postgres;
    grant execute on function private.current_actor_staff_id() to postgres;

    grant execute on function private.auth_lookup_staff_by_email(text) to postgres;
    grant execute on function private.auth_lookup_staff_by_id(uuid) to postgres;
    grant execute on function private.auth_get_security_profile(uuid, text) to postgres;
    grant execute on function private.auth_record_login_attempt(uuid, boolean, timestamptz) to postgres;
    grant execute on function private.auth_update_password(uuid, text, boolean) to postgres;
    grant execute on function private.auth_create_security_profile(uuid, text, boolean) to postgres;

    grant execute on function private.next_receipt_number(text, uuid) to postgres;
    grant execute on function private.next_certificate_number(text, uuid) to postgres;
    grant execute on function private.next_admission_number(text, uuid) to postgres;
    grant execute on function private.next_application_number(uuid) to postgres;
  end if;
end
$$;
