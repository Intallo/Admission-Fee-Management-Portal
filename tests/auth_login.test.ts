import { describe, it, expect, beforeEach } from 'vitest';
import { identityService, initializeDemoCredentials } from '../src/modules/identity-access/service';
import { clearAllLockouts } from '../src/lib/auth/lockout';
import { AuthenticationError, ValidationError } from '../src/lib/errors';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';

describe('Staff Authentication & Credentials Lifecycle (US-01, US-04)', () => {
  beforeEach(async () => {
    clearAllLockouts();
    await initializeDemoCredentials();
  });

  it('authenticates valid staff credentials and issues trusted session token', async () => {
    const result = await identityService.login(
      'principal@school-demo.example',
      'School@2026!'
    );

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('principal@school-demo.example');
    expect(result.user.role).toBe('principal');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.mustChangePassword).toBe(false);
  });

  it('rejects invalid password with generic error message to prevent enumeration', async () => {
    await expect(
      identityService.login('principal@school-demo.example', 'WrongPassword123!')
    ).rejects.toThrow('Invalid email or password.');
  });

  it('rejects non-existent user with generic error message to prevent enumeration', async () => {
    await expect(
      identityService.login('nonexistent.staff@school-demo.example', 'SomePassword123!')
    ).rejects.toThrow('Invalid email or password.');
  });

  it('identifies accounts requiring first-login password change (US-04 AC4, A-21)', async () => {
    // system.admin is seeded with mustChangePassword = true
    const result = await identityService.login(
      'system.admin@school-demo.example',
      'School@2026!'
    );

    expect(result.mustChangePassword).toBe(true);
  });

  it('allows staff to change their password when complexity requirements are satisfied', async () => {
    const email = 'principal@school-demo.example';
    const changeRes = await identityService.changePassword(
      'some-staff-id',
      'School@2026!',
      'NewSecurePassword2026!#',
      email
    );

    expect(changeRes.success).toBe(true);

    // Logging in with old password fails
    await expect(
      identityService.login(email, 'School@2026!')
    ).rejects.toThrow('Invalid email or password.');

    // Logging in with new password succeeds
    const newLogin = await identityService.login(email, 'NewSecurePassword2026!#');
    expect(newLogin.user.email).toBe(email);
  });

  it('rejects password change if new password fails complexity standards (US-04 AC3)', async () => {
    await expect(
      identityService.changePassword(
        'some-staff-id',
        'School@2026!',
        'simple', // Too short, no upper/number/special
        'principal@school-demo.example'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('allows System Administrator to reset a user password generating temporary credentials', async () => {
    const adminSession: AuthenticatedUserSession = {
      staffId: 'admin-uuid',
      authUserId: 'admin-auth-uuid',
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Admin',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: 'year-uuid',
      activeAcademicYearLabel: '2026-2027',
    };

    const targetEmail = 'clerk@school-demo.example';
    const { temporaryPassword } = await identityService.adminResetPassword(
      targetEmail,
      adminSession
    );

    expect(temporaryPassword).toBeDefined();
    expect(temporaryPassword.startsWith('Temp@')).toBe(true);

    // User can now log in with temporary password
    const loginRes = await identityService.login(targetEmail, temporaryPassword);
    expect(loginRes.mustChangePassword).toBe(true);
  });
});
