------------------------------------------------------------------------------------
-- Rollback Migration: 20261101130000_verifiable_actor_and_auth_gateway.down.sql
-- Satisfies Milestone M8.3.2 Task 11:
-- Restores valid previous actor-verification and numbering functions from Migration 8
-- before dropping private.system_secrets so RLS policies remain functional.
------------------------------------------------------------------------------------

-- 1. Drop Migration 9 auth gateway functions
drop function if exists private.auth_update_password(uuid, text, boolean);
drop function if exists private.auth_record_login_attempt(uuid, boolean, timestamptz);
drop function if exists private.auth_get_security_profile(uuid);
drop function if exists private.auth_lookup_staff_by_id(uuid);
drop function if exists private.auth_lookup_staff_by_email(text);

-- 2. Drop Migration 9 2-argument numbering functions
drop function if exists private.next_application_number(uuid);
drop function if exists private.next_admission_number(text, uuid);
drop function if exists private.next_certificate_number(text, uuid);
drop function if exists private.next_receipt_number(text, uuid);

-- 3. Restore Migration 8 actor context helper functions BEFORE dropping private.system_secrets
-- Ensures all 32 public tables protected by RLS remain functional during and after rollback.
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
begin
  v_staff_id_raw := pg_catalog.current_setting('app.current_staff_id', true);
  if v_staff_id_raw is null or v_staff_id_raw = '' then
    return null;
  end if;

  begin
    v_staff_id := v_staff_id_raw::uuid;
  exception when others then
    return null;
  end;

  select role, is_active
  into v_db_role, v_is_active
  from public.staff_members
  where id = v_staff_id;

  if not found or v_is_active is not true then
    return null;
  end if;

  v_asserted_role := pg_catalog.current_setting('app.current_role', true);
  if v_asserted_role is not null and v_asserted_role <> '' and v_asserted_role <> v_db_role then
    return null; -- Role forgery detected: asserted role differs from DB role!
  end if;

  return v_db_role;
end;
$$;

create or replace function private.current_actor_staff_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
begin
  v_raw := pg_catalog.current_setting('app.current_staff_id', true);
  if v_raw is null or v_raw = '' then
    return null;
  end if;
  return v_raw::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.current_actor_role() to school_app_user, school_app_login;
grant execute on function private.current_actor_staff_id() to school_app_user, school_app_login;

-- 4. Restore Migration 8 single-argument numbering functions
create or replace function private.next_certificate_number(p_prefix text default 'TC')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_prefix, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  return p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function private.next_admission_number(p_prefix text default 'ADM')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_prefix, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  return p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function private.next_receipt_number(p_series text default 'RCT')
returns text
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  insert into public.receipt_number_counters as c (series_code, next_value)
  values (p_series, 2)
  on conflict (series_code) do update
    set next_value = c.next_value + 1, updated_at = now()
  returning c.next_value - 1 into n;
  return p_series || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

grant execute on function private.next_certificate_number(text) to school_app_user, school_app_login;
grant execute on function private.next_admission_number(text) to school_app_user, school_app_login;
grant execute on function private.next_receipt_number(text) to school_app_user, school_app_login;

-- 5. Safely drop private.system_secrets now that actor functions no longer depend on it
drop table if exists private.system_secrets;
