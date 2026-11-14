import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { identityService } from '../src/modules/identity-access/service';
import { setPersistenceMode } from '../src/infrastructure/repositories/registry';
import { clearAllLockouts } from '../src/lib/auth/lockout';
import { getRepositories } from '../src/infrastructure/repositories';
import { generateActorSignature, withTransaction, withSystemTransaction } from '../src/infrastructure/db/postgres-pool';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';

describe('PostgreSQL-Backed Authentication Integration', () => {
  let isPgAvailable = false;
  let pgPool: Pool | null = null;
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  beforeAll(async () => {
    pgPool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 1500,
    });

    try {
      await pgPool.query('SELECT 1');
      isPgAvailable = true;
    } catch {
      isPgAvailable = false;
    }

    if (isPgAvailable) {
      process.env.DATABASE_URL = dbUrl;
      process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      process.env.ALLOW_REMOTE_DATABASE = 'false';
      process.env.ACTOR_SIGNING_SECRET = process.env.ACTOR_SIGNING_SECRET || 'actor-secret-for-postgres-integration-tests-32';
      process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'session-secret-for-postgres-integration-tests-32';
      clearAllLockouts();
      identityService.resetForTesting();
      setPersistenceMode('postgres');
    }
  });

  afterAll(async () => {
    if (pgPool) {
      await pgPool.end().catch(() => {});
    }
  });

  it('probes and documents PostgreSQL test database accessibility', () => {
    if (!isPgAvailable) {
      console.log(`[NOTICE] PostgreSQL test container not running at ${dbUrl}; integration execution deferred to CI.`);
    }
    expect(true).toBe(true);
  });

  it('authenticates demo staff via PostgreSQL identity repository and issues token', async () => {
    if (!isPgAvailable) return;

    const email = 'principal@school-demo.example';
    const result = await identityService.login(email, 'School@2026!');

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(email);
    expect(result.user.role).toBe('principal');
    expect(result.token).toBeDefined();
    expect(result.mustChangePassword).toBe(false);
  });

  it('increments failed login counter with row-level locking on invalid password', async () => {
    if (!isPgAvailable || !pgPool) return;

    const repo = getRepositories().identity;
    const staff = await repo.getStaffByEmail('clerk@school-demo.example');
    expect(staff).not.toBeNull();

    // Query initial security profile state
    const initialProfile = await repo.getSecurityProfile(staff.id, staff.email);
    const initialAttempts = initialProfile?.failedLoginAttempts || 0;

    // Trigger one failed attempt
    await repo.recordLoginAttempt(staff.id, false);

    const updatedProfile = await repo.getSecurityProfile(staff.id, staff.email);
    expect(updatedProfile.failedLoginAttempts).toBe(initialAttempts + 1);
  });

  it('resets failed login attempts to 0 in PostgreSQL on successful login', async () => {
    if (!isPgAvailable) return;

    const repo = getRepositories().identity;
    const staff = await repo.getStaffByEmail('accounts@school-demo.example');
    expect(staff).not.toBeNull();

    // Record a failed attempt
    await repo.recordLoginAttempt(staff.id, false);
    const midProfile = await repo.getSecurityProfile(staff.id, staff.email);
    expect(midProfile.failedLoginAttempts).toBeGreaterThan(0);

    // Now log in successfully
    await identityService.login('accounts@school-demo.example', 'School@2026!');

    const finalProfile = await repo.getSecurityProfile(staff.id, staff.email);
    expect(finalProfile.failedLoginAttempts).toBe(0);
    expect(finalProfile.lockedUntil).toBeNull();
  });

  it('persists session revocation in private.revoked_sessions and rejects revoked session', async () => {
    if (!isPgAvailable) return;

    const repo = getRepositories().identity;
    const sessionId = `pg-revoked-session-${Date.now()}`;
    const expiresAt = Date.now() + 3600000;

    expect(await repo.isSessionRevoked(sessionId)).toBe(false);

    await repo.revokeSession(sessionId, expiresAt);

    expect(await repo.isSessionRevoked(sessionId)).toBe(true);
  });

  it('verifies actor signing context matches private.current_actor_role() in PostgreSQL', async () => {
    if (!isPgAvailable || !pgPool) return;

    // Retrieve the actual seeded principal staff ID from the database
    const staffRes = await pgPool.query(
      "SELECT id, role, email, full_name FROM public.staff_members WHERE email = 'principal@school-demo.example' LIMIT 1"
    );
    expect(staffRes.rows.length).toBeGreaterThan(0);
    const staff = staffRes.rows[0];
    const staffId = staff.id;
    const role = staff.role;

    // Verify actor signature generation produces valid hex string
    const signature = generateActorSignature(staffId, role);
    expect(signature).toHaveLength(64);

    // Test verifiable actor execution inside transaction
    const testSession: AuthenticatedUserSession = {
      staffId,
      authUserId: staffId,
      email: staff.email,
      fullName: staff.full_name,
      role: staff.role,
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
    };

    const evaluatedRole = await withTransaction(testSession, async (client) => {
      const res = await client.query('SELECT private.current_actor_role() as role');
      return res.rows[0]?.role;
    });

    expect(evaluatedRole).toBe(role);
  });
});

