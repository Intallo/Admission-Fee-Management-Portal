import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SessionPayload, MAX_SESSION_LIFETIME_MS } from '../src/lib/auth/token';

describe('Rolling Idle-Timeout Session Refresh', () => {
  it('middleware refreshes session token and sets updated cookie when user is active after 1 minute', () => {
    const nowMs = Date.now();
    const fiveMinutesAgo = nowMs - 5 * 60 * 1000;

    const payload: SessionPayload = {
      sessionId: 'test-session-rolling-id',
      staffId: 'principal-uuid-test',
      authUserId: null,
      email: 'principal@school-demo.example',
      fullName: 'Principal Sharma',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: fiveMinutesAgo,
      lastActivityAt: fiveMinutesAgo,
      expiresAt: fiveMinutesAgo + MAX_SESSION_LIFETIME_MS,
    };

    const initialToken = signSessionToken(payload);

    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${initialToken}`,
      },
    });

    const res = middleware(req);
    expect(res).toBeDefined();

    // Verify Set-Cookie header is issued
    const setCookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).not.toBe(initialToken);

    // Verify the new token has updated lastActivityAt
    const verified = verifySessionToken(setCookie!.value);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.session.lastActivityAt).toBeGreaterThan(fiveMinutesAgo);
      expect(verified.session.lastActivityAt).toBeCloseTo(nowMs, -3);
      expect(verified.session.sessionId).toBe(payload.sessionId);
    }
  });

  it('middleware does not rewrite cookie if activity was within the last 60 seconds', () => {
    const nowMs = Date.now();
    const twentySecondsAgo = nowMs - 20 * 1000;

    const payload: SessionPayload = {
      sessionId: 'test-session-recent-id',
      staffId: 'principal-uuid-test',
      authUserId: null,
      email: 'principal@school-demo.example',
      fullName: 'Principal Sharma',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: twentySecondsAgo,
      lastActivityAt: twentySecondsAgo,
      expiresAt: twentySecondsAgo + MAX_SESSION_LIFETIME_MS,
    };

    const initialToken = signSessionToken(payload);

    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${initialToken}`,
      },
    });

    const res = middleware(req);
    // When activity is recent, cookies are not rewritten
    const setCookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(setCookie).toBeUndefined();
  });
});
