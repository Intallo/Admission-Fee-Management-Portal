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
    (process.env as any).NODE_ENV = 'production';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is missing/);
  });

  it('fails closed when SESSION_SECRET is too short (< 32 characters)', () => {
    process.env.SESSION_SECRET = 'short-secret-under-32-chars';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET is too short/);
  });

  it('does NOT fallback to SUPABASE_SERVICE_ROLE_KEY when SESSION_SECRET is missing in production', () => {
    delete process.env.SESSION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-that-is-long-enough-32-characters!';
    (process.env as any).NODE_ENV = 'production';
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is missing/);
  });

  it('successfully returns valid SESSION_SECRET of at least 32 characters', () => {
    const validSecret = 'a-very-strong-session-secret-key-of-at-least-32-characters!';
    process.env.SESSION_SECRET = validSecret;
    expect(getSessionSecret()).toBe(validSecret);
  });

  it('getServerEnv fails validation in production when SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;
    process.env.ACTOR_SIGNING_SECRET = 'valid-actor-secret-that-is-at-least-32-characters-long!';
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    expect(() => getServerEnv()).toThrow(/Missing required production environment variable: SESSION_SECRET/);
  });

  it('getServerEnv fails validation in production when ACTOR_SIGNING_SECRET is missing', () => {
    process.env.SESSION_SECRET = 'valid-session-secret-that-is-at-least-32-characters-long!';
    delete process.env.ACTOR_SIGNING_SECRET;
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    expect(() => getServerEnv()).toThrow(/Missing required production environment variable: ACTOR_SIGNING_SECRET/);
  });

  it('getServerEnv fails validation in production when SESSION_SECRET and ACTOR_SIGNING_SECRET are identical', () => {
    const identicalSecret = 'identical-secret-shared-between-session-and-actor-signing-32';
    process.env.SESSION_SECRET = identicalSecret;
    process.env.ACTOR_SIGNING_SECRET = identicalSecret;
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    expect(() => getServerEnv()).toThrow(/SESSION_SECRET and ACTOR_SIGNING_SECRET must be dedicated, distinct secrets/);
  });

  it('getServerEnv fails validation in production when known insecure example secrets are used', () => {
    process.env.SESSION_SECRET = 'dev-session-secret-must-be-at-least-32-chars-long!';
    process.env.ACTOR_SIGNING_SECRET = 'actor-signing-secret-distinct-value-at-least-32-chars!';
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    expect(() => getServerEnv()).toThrow(/Insecure or example SESSION_SECRET detected in production/);

    process.env.SESSION_SECRET = 'session-secret-distinct-value-at-least-32-chars-long!';
    process.env.ACTOR_SIGNING_SECRET = '3de4c2eb6696cd73c84b7ef5ded86ab8fbd0325f073d9d895d03947a2096aed4';
    expect(() => getServerEnv()).toThrow(/Insecure or example ACTOR_SIGNING_SECRET detected in production/);
  });

  it('getSessionSecret fails validation in production when known insecure example secrets are used', () => {
    process.env.SESSION_SECRET = 'dev-session-secret-must-be-at-least-32-chars-long!';
    (process.env as any).NODE_ENV = 'production';
    expect(() => getSessionSecret()).toThrow(/Insecure or example SESSION_SECRET detected in production/);
  });

  it('getServerEnv succeeds in production when both secrets are valid and distinct', () => {
    process.env.SESSION_SECRET = 'session-secret-distinct-value-at-least-32-chars-long!';
    process.env.ACTOR_SIGNING_SECRET = 'actor-signing-secret-distinct-value-at-least-32-chars!';
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test';
    const env = getServerEnv();
    expect(env.SESSION_SECRET).toBe('session-secret-distinct-value-at-least-32-chars-long!');
    expect(env.ACTOR_SIGNING_SECRET).toBe('actor-signing-secret-distinct-value-at-least-32-chars!');
  });
});
