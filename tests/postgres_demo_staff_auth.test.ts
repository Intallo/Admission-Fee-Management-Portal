import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';
import { identityService } from '../src/modules/identity-access/service';
import { setPersistenceMode } from '../src/infrastructure/repositories/registry';
import { clearAllLockouts } from '../src/lib/auth/lockout';

describe('PostgreSQL Demo Staff Login Reproduction', () => {
  let isPgAvailable = false;

  beforeAll(async () => {
    const probePool = new Pool({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      connectionTimeoutMillis: 1000,
    });
    try {
      await probePool.query('SELECT 1');
      isPgAvailable = true;
    } catch {
      isPgAvailable = false;
    } finally {
      await probePool.end().catch(() => {});
    }

    if (isPgAvailable) {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
      process.env.ALLOW_REMOTE_DATABASE = 'false';
      process.env.ACTOR_SIGNING_SECRET = 'actor-signing-secret-for-demo-staff-tests-32';
      process.env.SESSION_SECRET = 'session-signing-secret-for-demo-staff-tests-32';
      clearAllLockouts();
      identityService.resetForTesting();
      setPersistenceMode('postgres');
    }
  });

  const accounts = [
    'principal@school-demo.example',
    'system.admin@school-demo.example',
    'admissions@school-demo.example',
    'clerk@school-demo.example',
    'accounts@school-demo.example',
  ];

  for (const email of accounts) {
    it(`authenticates ${email} with default demo password School@2026!`, async () => {
      if (!isPgAvailable) {
        // Skip execution when local PostgreSQL container is not running
        return;
      }
      const result = await identityService.login(email, 'School@2026!');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.token).toBeDefined();
      if (email === 'system.admin@school-demo.example') {
        expect(result.mustChangePassword).toBe(true);
      } else {
        expect(result.mustChangePassword).toBe(false);
      }
    });
  }
});
