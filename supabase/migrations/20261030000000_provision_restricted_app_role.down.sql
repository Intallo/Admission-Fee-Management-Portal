------------------------------------------------------------------------------------
-- Rollback: 20261030000000_provision_restricted_app_role.down.sql
------------------------------------------------------------------------------------

-- Revert receipt number padding back to 4 digits if rolled back
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
  return p_series || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Revoke all permissions from school_app_user
revoke all on all tables in schema public from school_app_user;
revoke all on all sequences in schema public from school_app_user;
revoke all on schema public, private from school_app_user;

-- Drop role
drop role if exists school_app_user;
