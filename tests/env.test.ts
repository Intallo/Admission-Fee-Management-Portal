import { describe, it, expect, beforeEach } from 'vitest';
import { assertSafeDatabaseTarget, clientEnvSchema, serverEnvSchema, PROTECTED_REMOTE_REF } from '../src/lib/env';

describe('Environment Validation & Remote Database Isolation Guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  it('validates client environment schema correctly', () => {
    const valid = {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'valid_publishable_key',
    };
    const result = clientEnvSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid client environment URLs', () => {
    const invalid = {
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-valid-url',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'valid_key',
    };
    const result = clientEnvSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('assertSafeDatabaseTarget strictly forbids connection to retained remote database (fjrfyzamiirqzitdchkz)', () => {
    const remoteUrl = `https://${PROTECTED_REMOTE_REF}.supabase.co`;
    expect(() => {
      assertSafeDatabaseTarget(remoteUrl, undefined, false);
    }).toThrow(/Connection to retained remote database .* is STRICTLY FORBIDDEN/);

    expect(() => {
      assertSafeDatabaseTarget(undefined, `postgresql://postgres:pass@db.${PROTECTED_REMOTE_REF}.supabase.co:5432/postgres`, false);
    }).toThrow(/Connection to retained remote database .* is STRICTLY FORBIDDEN/);
  });

  it('assertSafeDatabaseTarget enforces local database in non-production environments', () => {
    expect(() => {
      assertSafeDatabaseTarget('https://some-other-cloud-database.supabase.co', undefined, false);
    }).toThrow(/Development and tests must run against disposable local database/);
  });

  it('assertSafeDatabaseTarget allows local 127.0.0.1 and localhost connections', () => {
    expect(() => {
      assertSafeDatabaseTarget('http://127.0.0.1:54321', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', false);
    }).not.toThrow();

    expect(() => {
      assertSafeDatabaseTarget('http://localhost:54321', 'postgresql://postgres:postgres@localhost:54322/postgres', false);
    }).not.toThrow();
  });
});
