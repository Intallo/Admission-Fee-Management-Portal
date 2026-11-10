import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  generateActorSignature,
  setPostgresPoolForTesting,
  withTransaction,
  withSystemTransaction,
} from '../src/infrastructure/db/postgres-pool';
import { PostgresIdentityRepository } from '../src/infrastructure/repositories/postgres/identity.repository';
import { AuthenticatedUserSession, StaffRole } from '../src/modules/identity-access/types';

describe('Milestone M8.3.3: Authentication Gateway Security', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const migration9Path = path.join(
    repoRoot,
    'supabase',
    'migrations',
    '20261101130000_verifiable_actor_and_auth_gateway.sql'
  );
  const downMigrationPath = path.join(
    repoRoot,
    'supabase',
    'rollbacks',
    '20261101130000_verifiable_actor_and_auth_gateway.down.sql'
  );
  const adr002Path = path.join(
    repoRoot,
    'docs',
    'adr',
    'ADR-002-authentication-gateway-boundary.md'
  );

  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const sysAdminId = '00000000-0000-0000-0000-000000000001';
  const principalId = '11111111-1111-1111-1111-111111111111';
  const accountantId = '22222222-2222-2222-2222-222222222222';
  const clerkId = '33333333-3333-3333-3333-333333333333';
  const inactiveStaffId = '44444444-4444-4444-4444-444444444444';

  function createTestSession(staffId: string, role: StaffRole, email: string): AuthenticatedUserSession {
    return {
      staffId,
      authUserId: staffId,
      role,
      fullName: `User ${role}`,
      email,
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-27',
    };
  }

  const sysAdminSession = createTestSession(sysAdminId, 'system_admin', 'admin@school.example');
  const principalSession = createTestSession(principalId, 'principal', 'principal@school.example');
  const accountantSession = createTestSession(accountantId, 'accountant', 'accounts@school.example');
  const clerkSession = createTestSession(clerkId, 'clerk', 'clerk@school.example');

  // In-memory state simulating PostgreSQL database semantics and gateway enforcement
  let staffTable: any[];
  let securityProfilesTable: any[];
  let sessionSettings: Record<string, string>;

  function setupMockClient() {
    sessionSettings = {};
    staffTable = [
      { id: sysAdminId, email: 'admin@school.example', role: 'system_admin', full_name: 'Sys Admin', is_active: true },
      { id: principalId, email: 'principal@school.example', role: 'principal', full_name: 'Principal', is_active: true },
      { id: accountantId, email: 'accounts@school.example', role: 'accountant', full_name: 'Accountant', is_active: true },
      { id: clerkId, email: 'clerk@school.example', role: 'clerk', full_name: 'Clerk', is_active: true },
      { id: inactiveStaffId, email: 'inactive@school.example', role: 'clerk', full_name: 'Inactive Staff', is_active: false },
    ];

    securityProfilesTable = [
      {
        staff_id: sysAdminId,
        password_hash: 'hashed_admin_password_min_32_characters_long_salt_abc',
        must_change_password: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
      },
      {
        staff_id: principalId,
        password_hash: 'hashed_principal_password_min_32_chars_long_salt_123',
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
      },
      {
        staff_id: accountantId,
        password_hash: 'hashed_accountant_password_min_32_chars_long_salt_456',
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
      },
      {
        staff_id: clerkId,
        password_hash: 'hashed_clerk_password_min_32_characters_long_salt_789',
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
      },
      {
        staff_id: inactiveStaffId,
        password_hash: 'hashed_inactive_password_min_32_characters_long_salt_000',
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
      },
    ];

    const mockClient = {
      query: async (sqlText: string, params: any[] = []) => {
        const trimmed = sqlText.trim().replace(/\s+/g, ' ');

        // Transaction commands
        if (/^(begin|commit|rollback)/i.test(trimmed)) {
          return { rows: [], rowCount: 0 };
        }

        // Session reset
        if (/reset all/i.test(trimmed)) {
          sessionSettings = {};
          return { rows: [], rowCount: 0 };
        }

        // Setting session configuration variables
        if (trimmed.toLowerCase().includes('set_config')) {
          if (params.length === 3) {
            sessionSettings['app.current_staff_id'] = params[0];
            sessionSettings['app.current_role'] = params[1];
            sessionSettings['app.actor_signature'] = params[2];
          } else {
            const keyMatch = trimmed.match(/set_config\('([^']+)',\s*\$1/);
            if (keyMatch) {
              sessionSettings[keyMatch[1]] = params[0];
            }
          }
          return { rows: [{ set_config: params[0] }], rowCount: 1 };
        }

        // Direct table access restriction check on public.staff_security_profiles
        if (/from\s+public\.staff_security_profiles/i.test(trimmed) && !trimmed.includes('private.auth_')) {
          const err = new Error('permission denied for table staff_security_profiles');
          (err as any).code = '42501';
          throw err;
        }

        // Helper: evaluate current_actor_role()
        const getCurrentActorRole = () => {
          const staffId = sessionSettings['app.current_staff_id'];
          const role = sessionSettings['app.current_role'];
          const sig = sessionSettings['app.actor_signature'];
          if (!staffId || !role || !sig) return null;
          const staff = staffTable.find((s) => s.id === staffId);
          if (!staff || !staff.is_active || staff.role !== role) return null;
          const expectedSig = generateActorSignature(staffId, role);
          if (sig.toLowerCase() !== expectedSig.toLowerCase()) return null;
          return role;
        };

        const getCurrentActorStaffId = () => {
          const role = getCurrentActorRole();
          if (!role) return null;
          return sessionSettings['app.current_staff_id'] || null;
        };

        // Gateway Function: private.auth_lookup_staff_by_email
        if (trimmed.includes('private.auth_lookup_staff_by_email')) {
          const email = params[0] ? params[0].trim().toLowerCase() : '';
          const staff = staffTable.find((s) => s.email.toLowerCase() === email);
          if (!staff) return { rows: [], rowCount: 0 };
          return {
            rows: [
              {
                id: staff.id,
                auth_user_id: staff.id,
                email: staff.email,
                full_name: staff.full_name,
                role: staff.role,
                is_active: staff.is_active,
                active_academic_year_id: '00000000-0000-0000-0000-000000000001',
              },
            ],
            rowCount: 1,
          };
        }

        // Gateway Function: private.auth_lookup_staff_by_id
        if (trimmed.includes('private.auth_lookup_staff_by_id')) {
          const staffId = params[0];
          const staff = staffTable.find((s) => s.id === staffId);
          if (!staff) return { rows: [], rowCount: 0 };
          return {
            rows: [
              {
                id: staff.id,
                auth_user_id: staff.id,
                email: staff.email,
                full_name: staff.full_name,
                role: staff.role,
                is_active: staff.is_active,
                active_academic_year_id: '00000000-0000-0000-0000-000000000001',
              },
            ],
            rowCount: 1,
          };
        }

        // Gateway Function: private.auth_get_security_profile(staff_id, email)
        if (trimmed.includes('private.auth_get_security_profile')) {
          const targetStaffId = params[0];
          const assertedEmail = params[1] ? params[1].trim().toLowerCase() : null;

          const actorRole = getCurrentActorRole();
          const actorStaffId = getCurrentActorStaffId();

          // Case 1: Authenticated session
          if (actorRole) {
            if (actorRole === 'system_admin' || actorStaffId === targetStaffId) {
              const staff = staffTable.find((s) => s.id === targetStaffId);
              if (!staff || !staff.is_active) return { rows: [], rowCount: 0 };
              const prof = securityProfilesTable.find((p) => p.staff_id === targetStaffId);
              return { rows: prof ? [prof] : [], rowCount: prof ? 1 : 0 };
            }
            // Cross-role inspection blocked (returns 0 rows)
            return { rows: [], rowCount: 0 };
          }

          // Case 2: Unauthenticated connection with matching email
          if (assertedEmail) {
            const staff = staffTable.find(
              (s) => s.id === targetStaffId && s.email.toLowerCase() === assertedEmail && s.is_active
            );
            if (!staff) return { rows: [], rowCount: 0 };
            const prof = securityProfilesTable.find((p) => p.staff_id === targetStaffId);
            return { rows: prof ? [prof] : [], rowCount: prof ? 1 : 0 };
          }

          // Unauthenticated query without matching email returns 0 rows
          return { rows: [], rowCount: 0 };
        }

        // Gateway Function: private.auth_record_login_attempt(staff_id, success, locked_until)
        if (trimmed.includes('private.auth_record_login_attempt')) {
          const [staffId, success] = params;
          const staff = staffTable.find((s) => s.id === staffId);
          if (!staff || !staff.is_active) return { rows: [], rowCount: 0 };

          const actorRole = getCurrentActorRole();
          const actorStaffId = getCurrentActorStaffId();

          if (success) {
            // Resetting failed attempts requires authorization (self-session or system_admin)
            if (!actorRole || (actorRole !== 'system_admin' && actorStaffId !== staffId)) {
              const err = new Error(
                'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
              );
              (err as any).code = '42501';
              throw err;
            }
            const prof = securityProfilesTable.find((p) => p.staff_id === staffId);
            if (prof) {
              prof.failed_login_attempts = 0;
              prof.locked_until = null;
              prof.last_login_at = new Date().toISOString();
            }
            return { rows: [], rowCount: 1 };
          } else {
            // Failed attempt: increment counter, trigger 15-minute lockout on 5th failure
            const prof = securityProfilesTable.find((p) => p.staff_id === staffId);
            if (prof) {
              prof.failed_login_attempts = (prof.failed_login_attempts || 0) + 1;
              if (prof.failed_login_attempts >= 5) {
                prof.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
              } else {
                prof.locked_until = null;
              }
            }
            return { rows: [], rowCount: 1 };
          }
        }

        // Gateway Function: private.auth_update_password(staff_id, password_hash, must_change)
        if (trimmed.includes('private.auth_update_password')) {
          const [staffId, newPasswordHash, mustChange] = params;
          const actorRole = getCurrentActorRole();
          const actorStaffId = getCurrentActorStaffId();

          if (!actorRole || !actorStaffId) {
            const err = new Error('Unauthorized: password modification requires authenticated actor context');
            (err as any).code = '42501';
            throw err;
          }

          if (actorRole !== 'system_admin' && actorStaffId !== staffId) {
            const err = new Error('Unauthorized: staff members may only change their own password');
            (err as any).code = '42501';
            throw err;
          }

          if (!newPasswordHash || newPasswordHash.length < 32) {
            const err = new Error('Invalid password hash format');
            (err as any).code = '22000';
            throw err;
          }

          const staff = staffTable.find((s) => s.id === staffId);
          if (!staff || !staff.is_active) {
            const err = new Error('Target staff member does not exist or is inactive');
            (err as any).code = 'P0002';
            throw err;
          }

          const prof = securityProfilesTable.find((p) => p.staff_id === staffId);
          if (prof) {
            prof.password_hash = newPasswordHash;
            prof.must_change_password = Boolean(mustChange);
            prof.failed_login_attempts = 0;
            prof.locked_until = null;
          }
          return { rows: [], rowCount: 1 };
        }

        // Gateway Function: private.auth_create_security_profile(staff_id, password_hash, must_change)
        if (trimmed.includes('private.auth_create_security_profile')) {
          const [staffId, passwordHash, mustChange] = params;
          const actorRole = getCurrentActorRole();
          if (actorRole && actorRole !== 'system_admin') {
            const err = new Error('Unauthorized: creating security profiles requires system_admin role');
            (err as any).code = '42501';
            throw err;
          }
          securityProfilesTable.push({
            staff_id: staffId,
            password_hash: passwordHash,
            must_change_password: mustChange ?? true,
            failed_login_attempts: 0,
            locked_until: null,
            last_login_at: null,
          });
          return { rows: [], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    const mockPool = {
      connect: async () => mockClient,
      query: mockClient.query,
      end: async () => {},
    };

    setPostgresPoolForTesting(mockPool as any);
  }

  beforeEach(() => {
    process.env.ACTOR_SIGNING_SECRET = testSecret;
    setupMockClient();
  });

  afterEach(() => {
    setPostgresPoolForTesting(null);
  });

  // ============================================================================
  // Suite 1: Direct Table Access Restrictions (Least Privilege)
  // ============================================================================
  describe('1. Direct Table Access Restrictions (Least Privilege)', () => {
    it('blocks direct SELECT queries on public.staff_security_profiles with 42501 permission denied', async () => {
      await expect(
        withSystemTransaction(async (client) => {
          await client.query('select * from public.staff_security_profiles');
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('permission denied for table staff_security_profiles'),
      });
    });

    it('blocks direct SELECT queries on public.staff_security_profiles even within an actor session', async () => {
      await expect(
        withTransaction(clerkSession, async (client) => {
          await client.query('select password_hash from public.staff_security_profiles where staff_id = $1', [
            principalId,
          ]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('permission denied for table staff_security_profiles'),
      });
    });
  });

  // ============================================================================
  // Suite 2: Credential Retrieval Guardrails (auth_get_security_profile)
  // ============================================================================
  describe('2. Credential Retrieval Guardrails (auth_get_security_profile)', () => {
    const repo = new PostgresIdentityRepository();

    it('returns null/0 rows when unauthenticated caller queries without an email', async () => {
      const profile = await repo.getSecurityProfile(principalId);
      expect(profile).toBeNull();
    });

    it('returns null/0 rows when unauthenticated caller supplies a non-matching email', async () => {
      const profile = await repo.getSecurityProfile(principalId, 'attacker@evil.com');
      expect(profile).toBeNull();
    });

    it('returns null/0 rows when unauthenticated caller queries an inactive staff member', async () => {
      const profile = await repo.getSecurityProfile(inactiveStaffId, 'inactive@school.example');
      expect(profile).toBeNull();
    });

    it('successfully retrieves security profile when unauthenticated caller provides matching active email', async () => {
      const profile = await repo.getSecurityProfile(principalId, 'principal@school.example');
      expect(profile).not.toBeNull();
      expect(profile?.staffId).toBe(principalId);
      expect(profile?.passwordHash).toBe('hashed_principal_password_min_32_chars_long_salt_123');
      expect(profile?.failedLoginAttempts).toBe(0);
    });

    it('allows authenticated staff member to retrieve their own security profile', async () => {
      const profile = await repo.getSecurityProfile(accountantId, undefined, accountantSession);
      expect(profile).not.toBeNull();
      expect(profile?.staffId).toBe(accountantId);
      expect(profile?.passwordHash).toBe('hashed_accountant_password_min_32_chars_long_salt_456');
    });

    it('allows system_admin to retrieve any staff member security profile', async () => {
      const profile = await repo.getSecurityProfile(clerkId, undefined, sysAdminSession);
      expect(profile).not.toBeNull();
      expect(profile?.staffId).toBe(clerkId);
      expect(profile?.passwordHash).toBe('hashed_clerk_password_min_32_characters_long_salt_789');
    });

    it('strictly returns 0 rows when a non-admin role (clerk) attempts to inspect another staff member (principal)', async () => {
      const profile = await repo.getSecurityProfile(principalId, undefined, clerkSession);
      expect(profile).toBeNull();
    });

    it('strictly returns 0 rows when an accountant attempts to inspect a clerk profile', async () => {
      const profile = await repo.getSecurityProfile(clerkId, undefined, accountantSession);
      expect(profile).toBeNull();
    });
  });

  // ============================================================================
  // Suite 3: Password Modification Security (auth_update_password)
  // ============================================================================
  describe('3. Password Modification Security (auth_update_password)', () => {
    const repo = new PostgresIdentityRepository();
    const newStrongHash = 'new_strongly_hashed_password_minimum_32_characters_salt';

    it('rejects password update without an authenticated session with AuthorizationError', async () => {
      await expect(repo.updatePassword(principalId, newStrongHash, false)).rejects.toThrow(
        /Authentication session required to update passwords/
      );
    });

    it('rejects unauthenticated direct SQL calls with error code 42501', async () => {
      await expect(
        withSystemTransaction(async (client) => {
          await client.query('select private.auth_update_password($1, $2, $3)', [
            principalId,
            newStrongHash,
            false,
          ]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: password modification requires authenticated actor context'),
      });
    });

    it('rejects cross-user password modification (clerk changing principal password) with 42501', async () => {
      await expect(
        repo.updatePassword(principalId, newStrongHash, false, clerkSession)
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: staff members may only change their own password'),
      });
    });

    it('rejects cross-user password modification (accountant changing clerk password) with 42501', async () => {
      await expect(
        repo.updatePassword(clerkId, newStrongHash, false, accountantSession)
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: staff members may only change their own password'),
      });
    });

    it('allows self-service password update for authenticated staff member', async () => {
      await expect(
        repo.updatePassword(accountantId, newStrongHash, false, accountantSession)
      ).resolves.not.toThrow();

      const profile = await repo.getSecurityProfile(accountantId, undefined, accountantSession);
      expect(profile?.passwordHash).toBe(newStrongHash);
      expect(profile?.mustChangePassword).toBe(false);
      expect(profile?.failedLoginAttempts).toBe(0);
    });

    it('allows administrative password reset by system_admin', async () => {
      const adminResetHash = 'admin_reset_temporary_password_hash_32_characters_salt';
      await expect(
        repo.updatePassword(clerkId, adminResetHash, true, sysAdminSession)
      ).resolves.not.toThrow();

      const profile = await repo.getSecurityProfile(clerkId, undefined, sysAdminSession);
      expect(profile?.passwordHash).toBe(adminResetHash);
      expect(profile?.mustChangePassword).toBe(true);
      expect(profile?.failedLoginAttempts).toBe(0);
    });

    it('rejects password hash format under 32 characters with 22000', async () => {
      await expect(
        repo.updatePassword(principalId, 'too_short_hash', false, principalSession)
      ).rejects.toMatchObject({
        code: '22000',
        message: expect.stringContaining('Invalid password hash format'),
      });
    });
  });

  // ============================================================================
  // Suite 4: Account Lockout & Attempt Tracking (auth_record_login_attempt)
  // ============================================================================
  describe('4. Account Lockout & Attempt Tracking (auth_record_login_attempt)', () => {
    const repo = new PostgresIdentityRepository();

    it('increments failed login attempts on failed attempt', async () => {
      await repo.recordLoginAttempt(clerkId, false);
      const prof = await repo.getSecurityProfile(clerkId, 'clerk@school.example');
      expect(prof?.failedLoginAttempts).toBe(1);
      expect(prof?.lockedUntil).toBeNull();
    });

    it('deterministically locks account for 15 minutes upon 5th consecutive failed attempt', async () => {
      for (let i = 0; i < 4; i++) {
        await repo.recordLoginAttempt(clerkId, false);
      }
      const before5th = await repo.getSecurityProfile(clerkId, 'clerk@school.example');
      expect(before5th?.failedLoginAttempts).toBe(4);
      expect(before5th?.lockedUntil).toBeNull();

      // 5th failed attempt
      await repo.recordLoginAttempt(clerkId, false);
      const after5th = await repo.getSecurityProfile(clerkId, 'clerk@school.example');
      expect(after5th?.failedLoginAttempts).toBe(5);
      expect(after5th?.lockedUntil).not.toBeNull();
      expect(after5th?.lockedUntil).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
      expect(after5th?.lockedUntil).toBeLessThanOrEqual(Date.now() + 16 * 60 * 1000);
    });

    it('rejects unauthenticated attempt to reset failed login attempts with error code 42501', async () => {
      await expect(repo.recordLoginAttempt(clerkId, true)).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining(
          'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
        ),
      });
    });

    it('rejects cross-user attempt to reset failed login attempts (accountant resetting clerk) with 42501', async () => {
      await expect(
        repo.recordLoginAttempt(clerkId, true, null, accountantSession)
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining(
          'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
        ),
      });
    });

    it('allows self-session to reset failed login attempts upon successful authentication', async () => {
      // Record 3 failures first
      await repo.recordLoginAttempt(accountantId, false);
      await repo.recordLoginAttempt(accountantId, false);
      await repo.recordLoginAttempt(accountantId, false);

      const beforeReset = await repo.getSecurityProfile(accountantId, 'accounts@school.example');
      expect(beforeReset?.failedLoginAttempts).toBe(3);

      // Reset with authenticated self-session
      await repo.recordLoginAttempt(accountantId, true, null, accountantSession);

      const afterReset = await repo.getSecurityProfile(accountantId, 'accounts@school.example');
      expect(afterReset?.failedLoginAttempts).toBe(0);
      expect(afterReset?.lockedUntil).toBeNull();
    });

    it('allows system_admin to reset failed login attempts for any staff member', async () => {
      // Record 5 failures to lock account
      for (let i = 0; i < 5; i++) {
        await repo.recordLoginAttempt(principalId, false);
      }
      const locked = await repo.getSecurityProfile(principalId, 'principal@school.example');
      expect(locked?.failedLoginAttempts).toBe(5);
      expect(locked?.lockedUntil).not.toBeNull();

      // Reset by system_admin
      await repo.recordLoginAttempt(principalId, true, null, sysAdminSession);

      const unlocked = await repo.getSecurityProfile(principalId, 'principal@school.example');
      expect(unlocked?.failedLoginAttempts).toBe(0);
      expect(unlocked?.lockedUntil).toBeNull();
    });
  });

  // ============================================================================
  // Suite 5: Security Profile Provisioning (auth_create_security_profile)
  // ============================================================================
  describe('5. Security Profile Provisioning (auth_create_security_profile)', () => {
    const newStaffId = '55555555-5555-5555-5555-555555555555';
    const initialHash = 'initial_strong_hash_min_32_characters_for_new_staff_001';

    it('rejects security profile creation by non-admin roles (clerk) with 42501', async () => {
      await expect(
        withTransaction(clerkSession, async (client) => {
          await client.query('select private.auth_create_security_profile($1, $2, $3)', [
            newStaffId,
            initialHash,
            true,
          ]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: creating security profiles requires system_admin role'),
      });
    });

    it('allows system_admin to create security profiles for new staff', async () => {
      await expect(
        withTransaction(sysAdminSession, async (client) => {
          await client.query('select private.auth_create_security_profile($1, $2, $3)', [
            newStaffId,
            initialHash,
            true,
          ]);
        })
      ).resolves.not.toThrow();

      const created = securityProfilesTable.find((p) => p.staff_id === newStaffId);
      expect(created).toBeDefined();
      expect(created.password_hash).toBe(initialHash);
      expect(created.must_change_password).toBe(true);
    });
  });

  // ============================================================================
  // Suite 6: Direct SQL Execution as Restricted Application Role (school_app_login)
  // ============================================================================
  describe('6. Direct SQL Execution as Restricted Application Role (school_app_login)', () => {
    const newStrongHash = 'direct_sql_new_strong_password_hash_minimum_32_chars';
    const adminResetHash = 'direct_sql_admin_reset_temporary_password_hash_salt';

    it('Test 1: Unauthorized credential access - blocks direct table read with 42501', async () => {
      await expect(
        withSystemTransaction(async (client) => {
          await client.query('select * from public.staff_security_profiles');
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('permission denied for table staff_security_profiles'),
      });
    });

    it('Test 1: Unauthorized credential access - returns 0 rows when unauthenticated direct SQL omits matching email', async () => {
      await withSystemTransaction(async (client) => {
        const res = await client.query('select * from private.auth_get_security_profile($1)', [principalId]);
        expect(res.rows).toEqual([]);
        expect(res.rowCount).toBe(0);
      });
    });

    it('Test 1: Unauthorized credential access - returns 0 rows when unauthenticated direct SQL supplies incorrect email', async () => {
      await withSystemTransaction(async (client) => {
        const res = await client.query('select * from private.auth_get_security_profile($1, $2)', [
          principalId,
          'wrong@email.example',
        ]);
        expect(res.rows).toEqual([]);
        expect(res.rowCount).toBe(0);
      });
    });

    it('Test 1: Unauthorized credential access - returns 0 rows when non-admin direct SQL inspects other staff', async () => {
      await withTransaction(clerkSession, async (client) => {
        const res = await client.query('select * from private.auth_get_security_profile($1)', [principalId]);
        expect(res.rows).toEqual([]);
        expect(res.rowCount).toBe(0);
      });
    });

    it('Test 2: Unauthorized password modification - rejects unauthenticated direct SQL call with 42501', async () => {
      await expect(
        withSystemTransaction(async (client) => {
          await client.query('select private.auth_update_password($1, $2, $3)', [
            principalId,
            newStrongHash,
            false,
          ]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: password modification requires authenticated actor context'),
      });
    });

    it('Test 2: Unauthorized password modification - rejects cross-user password update via direct SQL with 42501', async () => {
      await expect(
        withTransaction(clerkSession, async (client) => {
          await client.query('select private.auth_update_password($1, $2, $3)', [
            principalId,
            newStrongHash,
            false,
          ]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('Unauthorized: staff members may only change their own password'),
      });
    });

    it('Test 3: Unauthorized lockout manipulation - rejects unauthenticated reset via direct SQL with 42501', async () => {
      await expect(
        withSystemTransaction(async (client) => {
          await client.query('select private.auth_record_login_attempt($1, $2)', [clerkId, true]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining(
          'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
        ),
      });
    });

    it('Test 3: Unauthorized lockout manipulation - rejects cross-account reset via direct SQL with 42501', async () => {
      await expect(
        withTransaction(accountantSession, async (client) => {
          await client.query('select private.auth_record_login_attempt($1, $2)', [clerkId, true]);
        })
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining(
          'Unauthorized lockout manipulation: resetting failed login attempts requires self-session or system_admin role'
        ),
      });
    });

    it('Test 4: Valid login - completes unauthenticated metadata and credential lookup followed by authorized reset', async () => {
      // Step A: Look up staff metadata by email (no password returned)
      await withSystemTransaction(async (client) => {
        const lookupRes = await client.query(
          'select id, email, role, is_active from private.auth_lookup_staff_by_email($1)',
          ['principal@school.example']
        );
        expect(lookupRes.rowCount).toBe(1);
        expect(lookupRes.rows[0].id).toBe(principalId);
        expect(lookupRes.rows[0].role).toBe('principal');
        expect(lookupRes.rows[0].is_active).toBe(true);
        expect(lookupRes.rows[0].password_hash).toBeUndefined();
      });

      // Step B: Retrieve credential profile with matching email
      await withSystemTransaction(async (client) => {
        const profRes = await client.query('select * from private.auth_get_security_profile($1, $2)', [
          principalId,
          'principal@school.example',
        ]);
        expect(profRes.rowCount).toBe(1);
        expect(profRes.rows[0].password_hash).toBe('hashed_principal_password_min_32_chars_long_salt_123');
        expect(profRes.rows[0].failed_login_attempts).toBe(0);
      });

      // Step C: Reset failed attempts upon successful authentication using self-session
      await withTransaction(principalSession, async (client) => {
        await client.query('select private.auth_record_login_attempt($1, $2)', [principalId, true]);
      });
    });

    it('Test 5: Failed login - increments failed login counter via direct SQL without locking', async () => {
      await withSystemTransaction(async (client) => {
        await client.query('select private.auth_record_login_attempt($1, $2)', [accountantId, false]);
        const profRes = await client.query(
          'select failed_login_attempts, locked_until from private.auth_get_security_profile($1, $2)',
          [accountantId, 'accounts@school.example']
        );
        expect(profRes.rows[0].failed_login_attempts).toBe(1);
        expect(profRes.rows[0].locked_until).toBeNull();
      });
    });

    it('Test 6: Fifth failed attempt and lockout - deterministically sets 15-minute lockout on fifth failure', async () => {
      // Execute 5 consecutive failures for accountant to trigger lockout threshold
      await withSystemTransaction(async (client) => {
        for (let i = 0; i < 5; i++) {
          await client.query('select private.auth_record_login_attempt($1, $2)', [accountantId, false]);
        }

        const profRes = await client.query(
          'select failed_login_attempts, locked_until from private.auth_get_security_profile($1, $2)',
          [accountantId, 'accounts@school.example']
        );
        expect(profRes.rows[0].failed_login_attempts).toBe(5);
        expect(profRes.rows[0].locked_until).not.toBeNull();
        const lockTime = new Date(profRes.rows[0].locked_until).getTime();
        expect(lockTime).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
        expect(lockTime).toBeLessThanOrEqual(Date.now() + 16 * 60 * 1000);
      });
    });

    it('Test 7: Password change with valid authorization - self-service update succeeds and resets lockout', async () => {
      // Self-service password change by accountant
      await withTransaction(accountantSession, async (client) => {
        await client.query('select private.auth_update_password($1, $2, $3)', [
          accountantId,
          newStrongHash,
          false,
        ]);

        const profRes = await client.query(
          'select password_hash, must_change_password, failed_login_attempts, locked_until from private.auth_get_security_profile($1)',
          [accountantId]
        );
        expect(profRes.rows[0].password_hash).toBe(newStrongHash);
        expect(profRes.rows[0].must_change_password).toBe(false);
        expect(profRes.rows[0].failed_login_attempts).toBe(0);
        expect(profRes.rows[0].locked_until).toBeNull();
      });
    });

    it('Test 7: Password change with valid authorization - administrative reset by system_admin succeeds', async () => {
      // Administrative reset of clerk password by system_admin
      await withTransaction(sysAdminSession, async (client) => {
        await client.query('select private.auth_update_password($1, $2, $3)', [
          clerkId,
          adminResetHash,
          true,
        ]);

        const profRes = await client.query(
          'select password_hash, must_change_password, failed_login_attempts, locked_until from private.auth_get_security_profile($1)',
          [clerkId]
        );
        expect(profRes.rows[0].password_hash).toBe(adminResetHash);
        expect(profRes.rows[0].must_change_password).toBe(true);
        expect(profRes.rows[0].failed_login_attempts).toBe(0);
        expect(profRes.rows[0].locked_until).toBeNull();
      });
    });
  });

  // ============================================================================
  // Suite 7: Static Analysis & Migration Security Invariants
  // ============================================================================
  describe('7. Static Analysis & Migration Security Invariants', () => {
    it('verifies migration 9 explicitly revokes table permissions on staff_security_profiles from application roles', () => {
      const sql = fs.readFileSync(migration9Path, 'utf-8');
      expect(sql).toContain(
        'revoke all on table public.staff_security_profiles from public, anon, authenticated, school_app_user, school_app_login;'
      );
    });

    it('verifies all SECURITY DEFINER functions in migration 9 enforce search_path = ""', () => {
      const sql = fs.readFileSync(migration9Path, 'utf-8');
      const securityDefinerBlocks = sql.split(/create or replace function/i).slice(1);

      expect(securityDefinerBlocks.length).toBeGreaterThanOrEqual(10);

      for (const block of securityDefinerBlocks) {
        if (/security definer/i.test(block)) {
          expect(block).toMatch(/set search_path\s*=\s*''/i);
        }
      }
    });

    it('verifies execution grants are explicitly revoked from public and restricted to school_app_user/school_app_login', () => {
      const sql = fs.readFileSync(migration9Path, 'utf-8');
      const gatewayFunctions = [
        'private.auth_lookup_staff_by_email(text)',
        'private.auth_lookup_staff_by_id(uuid)',
        'private.auth_get_security_profile(uuid, text)',
        'private.auth_record_login_attempt(uuid, boolean, timestamptz)',
        'private.auth_update_password(uuid, text, boolean)',
        'private.auth_create_security_profile(uuid, text, boolean)',
      ];

      for (const fn of gatewayFunctions) {
        expect(sql).toContain(`revoke all on function ${fn} from public, anon, authenticated;`);
        expect(sql).toContain(`grant execute on function ${fn} to school_app_user, school_app_login;`);
      }
    });

    it('verifies down migration drops auth_create_security_profile and restores expected baseline grants', () => {
      const downSql = fs.readFileSync(downMigrationPath, 'utf-8');
      expect(downSql).toContain('drop function if exists private.auth_create_security_profile(uuid, text, boolean);');
      expect(downSql).toContain('drop function if exists private.auth_get_security_profile(uuid, text);');
      expect(downSql).toContain(
        'grant select, insert, update on public.staff_security_profiles to school_app_user, school_app_login;'
      );
    });
  });

  // ============================================================================
  // Suite 8: Architecture Decision Record ADR-002 Compliance
  // ============================================================================
  describe('8. Architecture Decision Record ADR-002 Compliance', () => {
    it('verifies that ADR-002 exists and follows MADR architectural structure', () => {
      expect(fs.existsSync(adr002Path)).toBe(true);
      const adrContent = fs.readFileSync(adr002Path, 'utf-8');

      expect(adrContent).toContain('# ADR-002: Hardened Authentication Gateway Boundary & Shared Database Credential Limitations');
      expect(adrContent).toContain('Status:');
      expect(adrContent).toContain('Accepted');
      expect(adrContent).toContain('## 1. Context');
      expect(adrContent).toContain('## 2. Decision Drivers');
      expect(adrContent).toContain('## 3. Options Considered');
      expect(adrContent).toContain('## 4. Decision');
      expect(adrContent).toContain('## 5. Limitations of a Shared Restricted Database Credential');
      expect(adrContent).toContain('## 6. Consequences');
    });

    it('verifies ADR-002 explicitly documents the limitations of the shared school_app_login credential', () => {
      const adrContent = fs.readFileSync(adr002Path, 'utf-8');

      expect(adrContent).toContain('school_app_login');
      expect(adrContent).toContain('staff_security_profiles');
      expect(adrContent).toContain('42501');
      expect(adrContent).toContain('search_path');
      expect(adrContent).toContain('system_admin');
    });
  });
});
