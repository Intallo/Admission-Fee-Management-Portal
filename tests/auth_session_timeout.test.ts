import { describe, it, expect } from 'vitest';
import {
  signSessionToken,
  verifySessionToken,
  touchSession,
  SessionPayload,
  IDLE_TIMEOUT_MS,
  MAX_SESSION_LIFETIME_MS,
} from '../src/lib/auth/token';

describe('Session Idle Timeout & Expiry (US-01 AC4)', () => {
  const baseTime = 1700000000000;

  const validPayload: SessionPayload = {
    sessionId: 'session-123',
    staffId: 'staff-456',
    authUserId: 'auth-789',
    email: 'principal@school-demo.example',
    fullName: 'Demo Principal',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: 'year-001',
    activeAcademicYearLabel: '2026-2027',
    mustChangePassword: false,
    createdAt: baseTime,
    lastActivityAt: baseTime,
    expiresAt: baseTime + MAX_SESSION_LIFETIME_MS,
  };

  it('validates genuine signed session token within normal active window', () => {
    const token = signSessionToken(validPayload);
    // Request arriving 5 minutes later
    const verification = verifySessionToken(token, baseTime + 5 * 60 * 1000);

    expect(verification.valid).toBe(true);
    if (verification.valid) {
      expect(verification.session.staffId).toBe('staff-456');
      expect(verification.session.role).toBe('principal');
    }
  });

  it('rejects tampered token payloads with INVALID_SIGNATURE', () => {
    const token = signSessionToken(validPayload);
    const [payloadB64, sig] = token.split('.');

    // Tamper with payload by changing role to system_admin
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...validPayload, role: 'system_admin' })
    ).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${sig}`;
    const verification = verifySessionToken(tamperedToken, baseTime);

    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toBe('INVALID_SIGNATURE');
    }
  });

  it('enforces 30-minute idle inactivity timeout (US-01 AC4)', () => {
    const token = signSessionToken(validPayload);

    // Request after 31 minutes of inactivity (exceeding 30-minute threshold)
    const verification = verifySessionToken(token, baseTime + IDLE_TIMEOUT_MS + 1000);

    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toBe('SESSION_IDLE_TIMEOUT');
    }
  });

  it('extends session validity when active requests touch the session within 30 minutes', () => {
    // 1st request at 20 minutes: touch session
    const touchedSession = touchSession(validPayload, baseTime + 20 * 60 * 1000);
    const renewedToken = signSessionToken(touchedSession);

    // 2nd request at 40 minutes (20 minutes after last touch, but 40 minutes from start)
    const verification = verifySessionToken(renewedToken, baseTime + 40 * 60 * 1000);

    expect(verification.valid).toBe(true);
  });

  it('enforces absolute session lifetime (SESSION_EXPIRED) regardless of activity', () => {
    // Simulated token that was touched repeatedly until beyond MAX_SESSION_LIFETIME_MS (8 hours)
    const activeBeyondMax: SessionPayload = {
      ...validPayload,
      lastActivityAt: baseTime + MAX_SESSION_LIFETIME_MS - 1000,
      expiresAt: baseTime + MAX_SESSION_LIFETIME_MS,
    };
    const token = signSessionToken(activeBeyondMax);

    // Request at 8 hours and 1 minute
    const verification = verifySessionToken(token, baseTime + MAX_SESSION_LIFETIME_MS + 60000);

    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toBe('SESSION_EXPIRED');
    }
  });
});
