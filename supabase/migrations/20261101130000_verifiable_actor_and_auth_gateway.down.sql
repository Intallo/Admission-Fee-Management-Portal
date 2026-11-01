------------------------------------------------------------------------------------
-- Rollback Migration: 20261101130000_verifiable_actor_and_auth_gateway.down.sql
------------------------------------------------------------------------------------

drop function if exists private.next_application_number(uuid);
drop function if exists private.next_admission_number(text, uuid);
drop function if exists private.next_certificate_number(text, uuid);
drop function if exists private.next_receipt_number(text, uuid);

drop function if exists private.auth_update_password(uuid, text, boolean);
drop function if exists private.auth_record_login_attempt(uuid, boolean, timestamptz);
drop function if exists private.auth_get_security_profile(uuid);
drop function if exists private.auth_lookup_staff_by_id(uuid);
drop function if exists private.auth_lookup_staff_by_email(text);

drop table if exists private.system_secrets;
