import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSessionSecret } from '../src/lib/auth/token';
import { getServerEnv } from '../src/lib/env';

describe('Session Secret Security & Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails closed when SESSION_SECRET is missing in production', () => {
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is missing/);
  });

  it('fails closed when SESSION_SECRET is too short (< 32 characters)', () => {
    process.env.SESSION_SECRET = 'short-secret-under-32-chars';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET is too short/);
  });

  it('does NOT fallback to SUPABASE_SERVICE_ROLE_KEY when SESSION_SECRET is missing in production', () => {
    delete process.env.SESSION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-that-is-long-enough-32-characters!';
    process.env.NODE_ENV = 'production';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is missing/);
  });

  it('successfully returns valid SESSION_SECRET of at least 32 characters', () => {
    const validSecret = 'a-very-strong-session-secret-key-of-at-least-32-characters!';
    process.env.SESSION_SECRET = validSecret;
    expect(getSessionSecret()).toBe(validSecret);
  });

  it('getServerEnv fails validation in production when SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    expect(() => getServerEnv()).toThrow(/Missing required production environment variable: SESSION_SECRET/);
  });
});
