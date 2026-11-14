import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession } from '../src/auth/session';
import { getRepositories } from '../src/infrastructure/repositories';
import { signSessionToken, verifySessionToken, touchSession, SESSION_COOKIE_NAME, SessionPayload, MAX_SESSION_LIFETIME_MS } from '../src/lib/auth/token';

const cookieMap = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      const val = cookieMap.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    set: (nameOrOptions: any, val?: string) => {
      if (typeof nameOrOptions === 'string') {
        cookieMap.set(nameOrOptions, val || '');
      } else if (nameOrOptions && nameOrOptions.name) {
        cookieMap.set(nameOrOptions.name, nameOrOptions.value || '');
      }
    },
    delete: (name: string) => {
      cookieMap.delete(name);
    },
  }),
}));

describe('Rolling Idle-Timeout Session Refresh in Server Session Resolver', () => {
  beforeEach(() => {
    cookieMap.clear();
  });

  it('touchSession updates lastActivityAt timestamp without altering core session identity', () => {
    const nowMs = Date.now();
    const tenMinutesAgo = nowMs - 10 * 60 * 1000;

    const payload: SessionPayload = {
      sessionId: 'test-touch-session',
      staffId: 'principal-uuid-test',
      authUserId: null,
      email: 'principal@school-demo.example',
      fullName: 'Principal Sharma',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: tenMinutesAgo,
      lastActivityAt: tenMinutesAgo,
      expiresAt: tenMinutesAgo + MAX_SESSION_LIFETIME_MS,
    };

    const touched = touchSession(payload, nowMs);
    expect(touched.lastActivityAt).toBe(nowMs);
    expect(touched.sessionId).toBe(payload.sessionId);
    expect(touched.staffId).toBe(payload.staffId);
    expect(touched.email).toBe(payload.email);
    expect(touched.role).toBe(payload.role);
  });

  it('getServerSession updates lastActivityAt and issues refreshed cookie when session is active after 1 minute', async () => {
    const repo = getRepositories().identity;
    await repo.createStaff({
      id: 'principal-uuid-test',
      email: 'principal@school-demo.example',
      fullName: 'Principal Sharma',
      role: 'principal',
      isActive: true,
    });

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
    cookieMap.set(SESSION_COOKIE_NAME, initialToken);

    const session = await getServerSession();
    expect(session).not.toBeNull();
    expect(session?.staffId).toBe('principal-uuid-test');

    // Verify refreshed cookie was written to cookie store
    const refreshedToken = cookieMap.get(SESSION_COOKIE_NAME);
    expect(refreshedToken).toBeDefined();
    expect(refreshedToken).not.toBe(initialToken);

    // Verify refreshed token contains updated lastActivityAt
    const verified = verifySessionToken(refreshedToken!);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.session.lastActivityAt).toBeGreaterThan(fiveMinutesAgo);
      expect(verified.session.lastActivityAt).toBeCloseTo(nowMs, -3);
      expect(verified.session.sessionId).toBe(payload.sessionId);
    }
  });

  it('getServerSession does not re-issue cookie if activity was within the last 60 seconds', async () => {
    const repo = getRepositories().identity;
    await repo.createStaff({
      id: 'principal-uuid-test',
      email: 'principal@school-demo.example',
      fullName: 'Principal Sharma',
      role: 'principal',
      isActive: true,
    });

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
    cookieMap.set(SESSION_COOKIE_NAME, initialToken);

    const session = await getServerSession();
    expect(session).not.toBeNull();

    // Cookie value remains unchanged when within 60-second window
    const storedToken = cookieMap.get(SESSION_COOKIE_NAME);
    expect(storedToken).toBe(initialToken);
  });
});
