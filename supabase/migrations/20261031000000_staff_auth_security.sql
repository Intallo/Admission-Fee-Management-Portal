------------------------------------------------------------------------------------
-- Migration: 20261031000000_staff_auth_security.sql
-- Module 1: Staff Authentication, Lockout State, and First-Login Password Tracking
------------------------------------------------------------------------------------

create table if not exists public.staff_security_profiles (
  staff_id uuid primary key references public.staff_members(id) on delete restrict,
  password_hash text not null,
  must_change_password boolean not null default false,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_security_profiles is
  'Authentication credentials vault and security state (failed attempts, lockout, must-change-password flag).';

-- Fail-closed RLS
alter table public.staff_security_profiles enable row level security;

-- Prevent physical hard deletion
create trigger prevent_hard_delete_staff_security_profiles
  before delete on public.staff_security_profiles
  for each row execute function private.prevent_hard_delete();

-- Auto update timestamp
create trigger set_updated_at_staff_security_profiles
  before update on public.staff_security_profiles
  for each row execute function private.set_updated_at();

-- Role Privileges
revoke all on public.staff_security_profiles from public, anon, authenticated;
grant all on public.staff_security_profiles to service_role;
grant select, insert, update on public.staff_security_profiles to school_app_user;
revoke delete on public.staff_security_profiles from school_app_user;

-- Pre-populate security profiles for seeded demo staff accounts (Default Password: "School@2026!")
-- Hash generated using scrypt with cost N=16384, r=8, p=1
insert into public.staff_security_profiles (staff_id, password_hash, must_change_password)
select sm.id,
       'scrypt$16384$8$1$669229e612cb7c7f4659b8b0e77d70c5$5bb7cb8d58c8ec6b51bf150a417066f1e582855f7c3e551c6e1fc1634b8bc7359556be8775a2fa3c3d52697ef678b871c53e839e1ff54c1beec6d396a8fa00ef',
       case when sm.email = 'system.admin@school-demo.example' then true else false end
from public.staff_members sm
where not exists (
  select 1 from public.staff_security_profiles ssp where ssp.staff_id = sm.id
);
