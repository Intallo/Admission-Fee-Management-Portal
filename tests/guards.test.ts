import { describe, it, expect } from 'vitest';
import { assertDisposableDatabase, assertServerOnly } from '../src/infrastructure/db/guards';
import { PROTECTED_REMOTE_REF } from '../src/lib/env';

describe('Server-Only & Database Safety Guards', () => {
  it('assertDisposableDatabase rejects remote references containing the retained project ref', () => {
    const dangerousUrl = `https://${PROTECTED_REMOTE_REF}.supabase.co`;
    expect(() => {
      assertDisposableDatabase(dangerousUrl);
    }).toThrow(/references protected remote database/);
  });

  it('assertDisposableDatabase accepts safe local disposable endpoints', () => {
    expect(() => {
      assertDisposableDatabase('http://127.0.0.1:54321');
    }).not.toThrow();

    expect(() => {
      assertDisposableDatabase('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    }).not.toThrow();
  });

  it('assertServerOnly succeeds in Node test runtime', () => {
    expect(() => {
      assertServerOnly();
    }).not.toThrow();
  });
});
