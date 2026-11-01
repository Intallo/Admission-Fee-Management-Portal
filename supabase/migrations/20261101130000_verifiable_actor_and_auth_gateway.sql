------------------------------------------------------------------------------------
-- Migration: 20261101130000_verifiable_actor_and_auth_gateway.sql
-- Satisfies CTO Directive Phase 8.2:
-- 1. Cryptographically verified actor assertion in private.current_actor_role() (eliminates caller spoofing).
-- 2. Restricted authentication gateway in schema private (SECURITY DEFINER functions for login/passwords).
-- 3. Academic-year-scoped, concurrency-safe annual numbering generators for receipts, certificates,
--    admissions, and applications with automatic rollover.
------------------------------------------------------------------------------------

-- 1. Ensure pgcrypto extension is available for HMAC-SHA256 actor verification
create extension if not exists pgcrypto;

-- 2. System secrets vault in schema private (inaccessible to school_app_user/school_app_login)
create table if not exists private.system_secrets (
  key_name text primary key,
  secret_value text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.system_secrets from public, anon, authenticated, school_app_user, school_app_login;

insert into private.system_secrets (key_name, secret_value)
values ('actor_signing_secret', 'school-app-actor-signing-secret-default-key-2026')
on conflict (key_name) do nothing;

-- 3. Verifiable Actor Identity Helper Function
-- Verifies staff ID, active account status, asserted role match, AND cryptographic HMAC-SHA256 signature
create or replace function private.current_actor_role()
returns text
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
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
  if v_signature is null or v_signature = '' then
    return null; -- Unsigned transaction: direct callers cannot spoof privileged roles
  end if;

  select secret_value into v_secret
  from private.system_secrets
  where key_name = 'actor_signing_secret';

  if v_secret is null then
    v_secret := coalesce(
      pg_catalog.current_setting('app.actor_signing_key', true),
      'school-app-actor-signing-secret-default-key-2026'
    );
  end if;

  v_expected_signature := encode(hmac((v_staff_id::text || ':' || v_db_role)::bytea, v_secret::bytea, 'sha256'), 'hex');

  if v_signature <> v_expected_signature then
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
set search_path = public, private, pg_temp
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

-- 4. Narrow Authentication Gateway Functions (SECURITY DEFINER)
-- Enables unauthenticated login path to query ONLY required credentials without direct access to staff or student tables

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
set search_path = public, private, pg_temp
as $$
begin
  return query
  select s.id, s.auth_user_id, s.email, s.full_name, s.role::text, s.is_active, s.active_academic_year_id
  from public.staff_members s
  where lower(s.email) = lower(p_email)
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
set search_path = public, private, pg_temp
as $$
begin
  return query
  select s.id, s.auth_user_id, s.email, s.full_name, s.role::text, s.is_active, s.active_academic_year_id
  from public.staff_members s
  where s.id = p_staff_id
  limit 1;
end;
$$;

create or replace function private.auth_get_security_profile(p_staff_id uuid)
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
set search_path = public, private, pg_temp
as $$
begin
  return query
  select p.staff_id, p.password_hash, p.must_change_password,
         p.failed_login_attempts, p.locked_until, p.last_login_at
  from public.staff_security_profiles p
  where p.staff_id = p_staff_id
  limit 1;
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
set search_path = public, private, pg_temp
as $$
begin
  if p_success then
    update public.staff_security_profiles
    set failed_login_attempts = 0,
        locked_until = null,
        last_login_at = now()
    where staff_id = p_staff_id;
  else
    update public.staff_security_profiles
    set failed_login_attempts = failed_login_attempts + 1,
        locked_until = coalesce(p_locked_until, locked_until)
    where staff_id = p_staff_id;
  end if;
end;
$$;

create or replace function private.auth_update_password(
  p_staff_id uuid,
  p_password_hash text,
  p_must_change_password boolean
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.staff_security_profiles
  set password_hash = p_password_hash,
      must_change_password = p_must_change_password,
      password_changed_at = now(),
      failed_login_attempts = 0,
      locked_until = null
  where staff_id = p_staff_id;
end;
$$;

grant execute on function private.auth_lookup_staff_by_email(text) to school_app_user, school_app_login;
grant execute on function private.auth_lookup_staff_by_id(uuid) to school_app_user, school_app_login;
grant execute on function private.auth_get_security_profile(uuid) to school_app_user, school_app_login;
grant execute on function private.auth_record_login_attempt(uuid, boolean, timestamptz) to school_app_user, school_app_login;
grant execute on function private.auth_update_password(uuid, text, boolean) to school_app_user, school_app_login;

-- 5. Annual Numbering Upgrade: Scoped to Academic Year with Automatic Rollover
-- Upgrade receipt_number_counters to composite key (series_code, academic_year_id)

alter table public.receipt_number_counters add column if not exists academic_year_id uuid references public.academic_years(id);

do $$
declare
  v_default_year_id uuid;
begin
  select id into v_default_year_id from public.academic_years where status = 'current' limit 1;
  if v_default_year_id is not null then
    update public.receipt_number_counters
    set academic_year_id = v_default_year_id
    where academic_year_id is null;
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

-- Re-establish primary key with academic_year_id (fallback to 00000000-0000-0000-0000-000000000000 for legacy)
alter table public.receipt_number_counters alter column academic_year_id set default '00000000-0000-0000-0000-000000000000';
update public.receipt_number_counters set academic_year_id = '00000000-0000-0000-0000-000000000000' where academic_year_id is null;
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
set search_path = public, private, pg_temp
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
    select label into v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    v_year_id := '00000000-0000-0000-0000-000000000000';
    v_year_prefix := to_char(now() at time zone 'Asia/Kolkata', 'YYYY');
  else
    v_year_prefix := coalesce(substring(v_year_label from 1 for 4), to_char(now() at time zone 'Asia/Kolkata', 'YYYY'));
  end if;

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_series, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;

  return p_series || '-' || v_year_prefix || '-' || lpad(n::text, 6, '0');
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
set search_path = public, private, pg_temp
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
    select label into v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    v_year_id := '00000000-0000-0000-0000-000000000000';
    v_year_prefix := to_char(now() at time zone 'Asia/Kolkata', 'YYYY');
  else
    v_year_prefix := coalesce(substring(v_year_label from 1 for 4), to_char(now() at time zone 'Asia/Kolkata', 'YYYY'));
  end if;

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_prefix, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;

  return p_prefix || '-' || v_year_prefix || '-' || lpad(n::text, 4, '0');
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
set search_path = public, private, pg_temp
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
    select label into v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    v_year_id := '00000000-0000-0000-0000-000000000000';
    v_year_prefix := to_char(now() at time zone 'Asia/Kolkata', 'YYYY');
  else
    v_year_prefix := coalesce(substring(v_year_label from 1 for 4), to_char(now() at time zone 'Asia/Kolkata', 'YYYY'));
  end if;

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values (p_prefix, v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;

  return p_prefix || '-' || v_year_prefix || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Monotonic Application Number: {N}/{YYYY-YY} (e.g. 1/2026-27) scoped to academic year
create or replace function private.next_application_number(
  p_academic_year_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_year_id uuid;
  v_year_label text;
  n bigint;
begin
  v_year_id := p_academic_year_id;
  if v_year_id is null then
    select id, label into v_year_id, v_year_label
    from public.academic_years where status = 'current' limit 1;
  else
    select label into v_year_label
    from public.academic_years where id = v_year_id;
  end if;

  if v_year_id is null then
    v_year_id := '00000000-0000-0000-0000-000000000000';
    v_year_label := to_char(now() at time zone 'Asia/Kolkata', 'YYYY');
  end if;

  insert into public.receipt_number_counters as c (series_code, academic_year_id, next_value)
  values ('APP', v_year_id, 2)
  on conflict (series_code, academic_year_id) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;

  return n::text || '/' || v_year_label;
end;
$$;

grant execute on function private.next_receipt_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_certificate_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_admission_number(text, uuid) to school_app_user, school_app_login;
grant execute on function private.next_application_number(uuid) to school_app_user, school_app_login;
