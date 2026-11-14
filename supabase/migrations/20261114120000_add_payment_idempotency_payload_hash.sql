-- Migration: 20261114120000_add_payment_idempotency_payload_hash.sql
-- Purpose: Add idempotency_payload_hash to public.payments for deterministic request fingerprinting

begin;

alter table public.payments
  add column if not exists idempotency_payload_hash text;

commit;

