import { describe, it, expect, beforeEach } from 'vitest';
import { identityService, initializeDemoCredentials } from '../src/modules/identity-access/service';
import { checkLockout, clearAllLockouts, recordFailedAttempt } from '../src/lib/auth/lockout';

describe('User Account Lockout Controls (US-01 AC3)', () => {
  const targetEmail = 'accounts@school-demo.example';

  beforeEach(async () => {
    clearAllLockouts();
    await initializeDemoCredentials();
  });

  it('keeps account unlocked during failed attempts 1 through 4', async () => {
    for (let i = 1; i <= 4; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {
        // Expected invalid password error
      }
      const status = checkLockout(targetEmail);
      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(i);
    }
  });

  it('locks the account for 15 minutes upon the 5th consecutive failed attempt', async () => {
    for (let i = 1; i <= 4; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {}
    }

    // 5th attempt triggers lockout
    await expect(
      identityService.login(targetEmail, 'WrongPassword!')
    ).rejects.toThrow(/Account is temporarily locked due to 5 consecutive failed login attempts/);

    const status = checkLockout(targetEmail);
    expect(status.isLocked).toBe(true);
    expect(status.remainingMinutes).toBeGreaterThan(0);
    expect(status.remainingMinutes).toBeLessThanOrEqual(15);
  });

  it('immediately blocks subsequent login attempts even if the correct password is provided while locked', async () => {
    // Cause lockout with 5 failed attempts
    for (let i = 1; i <= 5; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {}
    }

    // Attempting login with the real password while locked must be blocked
    await expect(
      identityService.login(targetEmail, 'School@2026!')
    ).rejects.toThrow(/Account is temporarily locked/);
  });

  it('enforces lockout strictly per-user without cross-account impact', async () => {
    // Lock out accounts officer
    for (let i = 1; i <= 5; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {}
    }
    expect(checkLockout(targetEmail).isLocked).toBe(true);

    // Another user (Principal) is completely unaffected
    const principalStatus = checkLockout('principal@school-demo.example');
    expect(principalStatus.isLocked).toBe(false);

    const loginRes = await identityService.login('principal@school-demo.example', 'School@2026!');
    expect(loginRes.user.email).toBe('principal@school-demo.example');
  });

  it('automatically unlocks the account once the 15-minute window has elapsed', async () => {
    const startTime = Date.now();

    // Lock out user
    for (let i = 1; i <= 5; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {}
    }
    expect(checkLockout(targetEmail, startTime).isLocked).toBe(true);

    // Simulate 15 minutes and 1 second later
    const futureTime = startTime + (15 * 60 * 1000) + 1000;
    const statusLater = checkLockout(targetEmail, futureTime);
    expect(statusLater.isLocked).toBe(false);
  });

  it('resets failed attempt counter to 0 upon successful login before reaching threshold', async () => {
    // 3 failed attempts
    for (let i = 1; i <= 3; i++) {
      try {
        await identityService.login(targetEmail, 'WrongPassword!');
      } catch {}
    }
    expect(checkLockout(targetEmail).failedAttempts).toBe(3);

    // 4th attempt is successful
    await identityService.login(targetEmail, 'School@2026!');

    // Counter is now reset to 0
    expect(checkLockout(targetEmail).failedAttempts).toBe(0);
  });
});
