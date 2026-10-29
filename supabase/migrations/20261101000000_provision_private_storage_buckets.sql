------------------------------------------------------------------------------------
-- Migration: 20261101000000_provision_private_storage_buckets.sql
-- Satisfies PRIV-DOC-PDF-001 & SRS §4 (Private Buckets & Storage Security)
-- Provisions private buckets with public access disabled:
--   1. admission-documents (10 MiB, images + pdf)
--   2. receipts (5 MiB, pdf)
--   3. certificates (5 MiB, pdf)
------------------------------------------------------------------------------------

do $$
begin
  if exists (select from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    -- 1. Provision private admission-documents bucket
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'admission-documents',
      'admission-documents',
      false,
      10485760, -- 10 MiB
      array['image/jpeg', 'image/png', 'application/pdf']::text[]
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']::text[];

    -- 2. Provision private receipts bucket
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'receipts',
      'receipts',
      false,
      5242880, -- 5 MiB
      array['application/pdf']::text[]
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf']::text[];

    -- 3. Provision private certificates bucket
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'certificates',
      'certificates',
      false,
      5242880, -- 5 MiB
      array['application/pdf']::text[]
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf']::text[];

    -- 4. Enable RLS on storage.objects
    alter table storage.objects enable row level security;

    -- 5. Revoke all public access on storage.objects
    revoke all on storage.objects from anon, public;

    -- 6. Storage access policy for authenticated service/app
    drop policy if exists "Authenticated and service role read private buckets" on storage.objects;
    create policy "Authenticated and service role read private buckets"
      on storage.objects for select
      to authenticated, service_role
      using (bucket_id in ('admission-documents', 'receipts', 'certificates'));

    drop policy if exists "Authenticated and service role write private buckets" on storage.objects;
    create policy "Authenticated and service role write private buckets"
      on storage.objects for insert
      to authenticated, service_role
      with check (bucket_id in ('admission-documents', 'receipts', 'certificates'));
  end if;
end
$$;
