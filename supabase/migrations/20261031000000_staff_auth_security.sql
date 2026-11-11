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
       'scrypt$16384$8$1$2b5c4d6dde398b0bf4670cb892ca6caf$ed8ee9d504f41d5925f48af8789655e2e9ff0151c6e21421264e2773a962c100433428607dd4ac3dab2f35c2918c6fd96719c3bfa891f7ad2801862df5e626eb',
       case when sm.email = 'system.admin@school-demo.example' then true else false end
from public.staff_members sm
where not exists (
  select 1 from public.staff_security_profiles ssp where ssp.staff_id = sm.id
);
