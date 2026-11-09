--------------------------------------------------------------------------------
-- Down Migration: 20261107092000_persist_session_revocation.down.sql
--------------------------------------------------------------------------------

drop function if exists private.revoke_session(text, timestamptz);
drop function if exists private.is_session_revoked(text);
drop table if exists private.revoked_sessions;
