import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { identityService, initializeDemoCredentials } from '../src/modules/identity-access/service';
import { clearAllLockouts } from '../src/lib/auth/lockout';
import { verifyPassword } from '../src/lib/auth/password';
import { getRepositories } from '../src/infrastructure/repositories';
import { StaffRole } from '../src/modules/identity-access/types';

describe('Seed Data Authentication & Credential Verification', () => {
  beforeEach(async () => {
    clearAllLockouts();
    identityService.resetForTesting();
    await initializeDemoCredentials();
  });

  const DEMO_ACCOUNTS: Array<{
    email: string;
    expectedRole: StaffRole;
    mustChangePassword: boolean;
  }> = [
    { email: 'system.admin@school-demo.example', expectedRole: 'system_admin', mustChangePassword: true },
    { email: 'principal@school-demo.example', expectedRole: 'principal', mustChangePassword: false },
    { email: 'admissions@school-demo.example', expectedRole: 'admission_officer', mustChangePassword: false },
    { email: 'clerk@school-demo.example', expectedRole: 'clerk', mustChangePassword: false },
    { email: 'accounts@school-demo.example', expectedRole: 'accountant', mustChangePassword: false },
  ];

  it('authenticates all 5 seed demo staff accounts with standard password School@2026!', async () => {
    for (const acc of DEMO_ACCOUNTS) {
      const result = await identityService.login(acc.email, 'School@2026!');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(acc.email);
      expect(result.user.role).toBe(acc.expectedRole);
      expect(result.user.isActive).toBe(true);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.mustChangePassword).toBe(acc.mustChangePassword);
    }
  });

  it('rejects incorrect password for each demo staff account with generic error', async () => {
    for (const acc of DEMO_ACCOUNTS) {
      await expect(
        identityService.login(acc.email, 'IncorrectPassword999!')
      ).rejects.toThrow('Invalid email or password.');
    }
  });

  it('rejects deactivated demo staff account regardless of password correctness', async () => {
    const repo = getRepositories().identity;
    const clerk = await repo.getStaffByEmail('clerk@school-demo.example');
    expect(clerk).not.toBeNull();

    // Deactivate clerk
    await repo.updateStaff(clerk.id, { isActive: false }, {
      staffId: 'some-admin',
      authUserId: 'some-admin',
      email: 'system.admin@school-demo.example',
      fullName: 'Admin',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
    });

    await expect(
      identityService.login('clerk@school-demo.example', 'School@2026!')
    ).rejects.toThrow(/Account has been deactivated/);
  });

  it('verifies supabase/seed.sql contains correct demo staff definitions and password hash', () => {
    const seedPath = path.resolve(__dirname, '../supabase/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf-8');

    for (const acc of DEMO_ACCOUNTS) {
      expect(seedSql).toContain(acc.email);
      expect(seedSql).toContain(acc.expectedRole);
    }

    // Verify scrypt hash in seed.sql matches School@2026!
    const hashMatch = seedSql.match(/scrypt\$16384\$8\$1\$[a-f0-9]+\$[a-f0-9]+/);
    expect(hashMatch).not.toBeNull();
    const hash = hashMatch![0];

    return expect(verifyPassword('School@2026!', hash)).resolves.toBe(true);
  });
});

