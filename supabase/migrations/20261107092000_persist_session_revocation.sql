--------------------------------------------------------------------------------
-- Migration: 20261107092000_persist_session_revocation.sql
-- Provides persistent server-side session revocation for logout/token replay.
--
-- Only SECURITY DEFINER functions can inspect or write the private registry.
-- Revoked entries are retained until their signed session has expired.
--------------------------------------------------------------------------------

create schema if not exists private;

create table if not exists private.revoked_sessions (
  session_id text primary key,
  revoked_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null
);

create index if not exists idx_revoked_sessions_expires_at
  on private.revoked_sessions (expires_at);

revoke all on table private.revoked_sessions
  from public, anon, authenticated, school_app_user, school_app_login;

create or replace function private.is_session_revoked(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_session_id is null or pg_catalog.btrim(p_session_id) = '' then true
    else exists (
      select 1
      from private.revoked_sessions rs
      where rs.session_id = p_session_id
        and rs.expires_at > pg_catalog.now()
    )
  end;
$$;

create or replace function private.revoke_session(
  p_session_id text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_id is null or pg_catalog.btrim(p_session_id) = '' or p_expires_at is null then
    raise exception 'A session ID and expiry are required for revocation'
      using errcode = '22023';
  end if;

  if p_expires_at <= pg_catalog.now() then
    return;
  end if;

  insert into private.revoked_sessions (session_id, revoked_at, expires_at)
  values (p_session_id, pg_catalog.now(), p_expires_at)
  on conflict (session_id) do update
    set revoked_at = pg_catalog.now(),
        expires_at = greatest(
          private.revoked_sessions.expires_at,
          excluded.expires_at
        );

  -- Opportunistic cleanup of entries that can no longer represent live tokens.
  delete from private.revoked_sessions
  where expires_at <= pg_catalog.now();
end;
$$;

revoke all on function private.is_session_revoked(text)
  from public, anon, authenticated;
revoke all on function private.revoke_session(text, timestamptz)
  from public, anon, authenticated;

grant usage on schema private
  to school_app_user, school_app_login, postgres;

grant execute on function private.is_session_revoked(text)
  to school_app_user, school_app_login, postgres;
grant execute on function private.revoke_session(text, timestamptz)
  to school_app_user, school_app_login, postgres;
