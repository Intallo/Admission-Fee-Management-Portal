------------------------------------------------------------------------------------
-- Disposable CI & Test Environment Bootstrap Script
-- File: scripts/ci/00_supabase_test_compat_bootstrap.sql
--
-- PURPOSE:
-- Provisions minimal Supabase compatibility objects (roles, auth schema, storage
-- schema, extensions, and standard helper functions) required by repository
-- migrations when running against clean PostgreSQL instances (e.g. CI containers).
--
-- STRICT SAFEGUARD:
-- THIS SCRIPT IS FOR DISPOSABLE CI / LOCAL TEST DATABASES ONLY.
-- IT MUST NEVER BE APPLIED TO CLIENT PRODUCTION OR RETAINED SUPABASE DATABASES.
------------------------------------------------------------------------------------

-- 0. Safety Guard: Fail closed if executed against production
do $$
begin
  if current_setting('app.environment', true) = 'production'
     or current_setting('app.is_production', true) = 'true' then
    raise exception '[FATAL SAFETY GUARD] Supabase test compatibility bootstrap cannot be run against production databases!';
  end if;
end
$$;

-- 1. Required PostgreSQL Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. Required Supabase Roles
-- These roles are standard in Supabase hosted environments and are required
-- by migrations that revoke/grant privileges and configure RLS policies.
do $$
begin
  -- anon: PostgREST role for unauthenticated API traffic
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon with nologin noinherit;
  end if;

  -- authenticated: PostgREST role for authenticated JWT users
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated with nologin noinherit;
  end if;

  -- service_role: privileged backend role with bypassrls
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role with nologin noinherit bypassrls;
  end if;

  -- supabase_admin: administrative superuser role in Supabase stack
  if not exists (select from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin with superuser login;
  end if;

  -- authenticator: connection pool / proxy role that assumes anon/authenticated
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator with login noinherit;
    grant anon to authenticator;
    grant authenticated to authenticator;
    grant service_role to authenticator;
  end if;

  -- Ensure postgres role inherits app roles for test compatibility
  if exists (select from pg_roles where rolname = 'postgres') then
    if exists (select from pg_roles where rolname = 'school_app_user') then
      grant school_app_user to postgres;
    end if;
    if exists (select from pg_roles where rolname = 'school_app_login') then
      grant school_app_login to postgres;
    end if;
  end if;
end
$$;

-- 3. Supabase auth Schema and Compatibility Tables
-- Required by public.staff_members.auth_user_id references auth.users(id)
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_super_admin boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text default null,
  phone_confirmed_at timestamptz default null,
  phone_change text default null,
  phone_change_token varchar(255) default null,
  phone_change_sent_at timestamptz default null,
  confirmed_at timestamptz,
  email_change_token_current varchar(255) default null,
  email_change_confirm_status smallint default 0,
  banned_until timestamptz default null,
  reauthentication_token varchar(255) default null,
  reauthentication_sent_at timestamptz default null,
  is_sso_user boolean not null default false,
  deleted_at timestamptz default null
);

grant select on auth.users to anon, authenticated;
grant all on auth.users to service_role;

-- 4. Supabase auth Standard Helper Functions
-- Required for any RLS policies or audit triggers referencing auth.*
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  )::text;
$$;

create or replace function auth.email()
returns text
language sql stable
as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.email', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text;
$$;

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

-- 5. Supabase storage Schema and Compatibility Tables
-- Required by 20261101000000_provision_private_storage_buckets.sql
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored
);

grant all on storage.buckets to service_role;
grant all on storage.objects to service_role;
grant select on storage.buckets to anon, authenticated;
grant select on storage.objects to anon, authenticated;

-- Confirmation Log
do $$
begin
  raise notice '[BOOTSTRAP] Supabase test compatibility bootstrap successfully applied.';
end
$$;
