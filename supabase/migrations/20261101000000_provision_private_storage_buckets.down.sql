------------------------------------------------------------------------------------
-- Rollback Migration: 20261101000000_provision_private_storage_buckets.down.sql
-- Removes private buckets and storage access policies
------------------------------------------------------------------------------------

do $$
begin
  if exists (select from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    drop policy if exists "Authenticated and service role write private buckets" on storage.objects;
    drop policy if exists "Authenticated and service role read private buckets" on storage.objects;
    delete from storage.buckets where id in ('admission-documents', 'receipts', 'certificates');
  end if;
end
$$;
