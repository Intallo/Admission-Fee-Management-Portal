import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryIdentityRepository } from '../src/infrastructure/repositories/in-memory/identity.repository';
import { identityService } from '../src/modules/identity-access/service';
import { POST as logoutRoute } from '../src/app/api/v1/auth/logout/route';
import { SESSION_COOKIE_NAME, signSessionToken, SessionPayload, MAX_SESSION_LIFETIME_MS } from '../src/lib/auth/token';
import { getRepositories } from '../src/infrastructure/repositories';
import { getServerSession } from '../src/auth/session';

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

describe('Server-side session revocation & logout invalidation', () => {
  beforeEach(() => {
    getRepositories().identity.resetForTesting?.();
    cookieMap.clear();
  });

  describe('1. Repository Revocation Semantics', () => {
    it('returns false for an unrevoked session', async () => {
      const repo = new InMemoryIdentityRepository();
      const sessionId = 'session-active-123';
      expect(await repo.isSessionRevoked(sessionId)).toBe(false);
    });

    it('rejects a session after it has been revoked', async () => {
      const repo = new InMemoryIdentityRepository();
      const sessionId = 'session-revoked-123';
      const expiresAt = Date.now() + 60_000;

      expect(await repo.isSessionRevoked(sessionId)).toBe(false);
      await repo.revokeSession(sessionId, expiresAt);
      expect(await repo.isSessionRevoked(sessionId)).toBe(true);
    });

    it('does not treat an expired revocation entry as live', async () => {
      const repo = new InMemoryIdentityRepository();
      const sessionId = 'session-expired-revocation';

      await repo.revokeSession(sessionId, Date.now() - 1);
      expect(await repo.isSessionRevoked(sessionId)).toBe(false);
    });

    it('fails closed for missing or empty session identifier', async () => {
      const repo = new InMemoryIdentityRepository();
      expect(await repo.isSessionRevoked('')).toBe(true);
    });

    it('clears revocation registry on test reset', async () => {
      const repo = new InMemoryIdentityRepository();
      const sessionId = 'session-to-reset';

      await repo.revokeSession(sessionId, Date.now() + 60_000);
      expect(await repo.isSessionRevoked(sessionId)).toBe(true);

      repo.resetForTesting();
      expect(await repo.isSessionRevoked(sessionId)).toBe(false);
    });
  });

  describe('2. Logout Route Invalidation & Copied Token Rejection', () => {
    it('revokes the session on POST /api/v1/auth/logout so copied tokens cannot be reused', async () => {
      const repo = getRepositories().identity;
      const nowMs = Date.now();
      const sessionId = 'session-token-copy-test';

      const payload: SessionPayload = {
        sessionId,
        staffId: 'principal-uuid-test',
        authUserId: null,
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
        activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
        activeAcademicYearLabel: '2026-2027',
        mustChangePassword: false,
        createdAt: nowMs,
        lastActivityAt: nowMs,
        expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
      };

      const token = signSessionToken(payload);

      // Verify the session is initially recognized as valid
      cookieMap.set(SESSION_COOKIE_NAME, token);

      expect(await repo.isSessionRevoked(sessionId)).toBe(false);

      // Seed staff member into repository so staff lookup succeeds
      await repo.createStaff({
        id: 'principal-uuid-test',
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
      });

      const initialSession = await getServerSession();
      expect(initialSession).not.toBeNull();
      expect(initialSession?.staffId).toBe('principal-uuid-test');

      // Client performs logout
      const logoutReq = new Request('http://localhost:3000/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const logoutRes = await logoutRoute(logoutReq);
      expect(logoutRes.status).toBe(200);

      // Ensure repository recorded the revocation
      expect(await repo.isSessionRevoked(sessionId)).toBe(true);

      // Now simulate attacker presenting the copied token in cookies
      cookieMap.set(SESSION_COOKIE_NAME, token);

      const postLogoutSession = await getServerSession();
      expect(postLogoutSession).toBeNull();
    });

    it('returns HTTP 500 when server-side revocation fails, but still clears browser cookie', async () => {
      const repo = getRepositories().identity;
      const nowMs = Date.now();
      const sessionId = 'session-failure-test-id';

      const payload: SessionPayload = {
        sessionId,
        staffId: 'principal-uuid-test',
        authUserId: null,
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
        activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
        activeAcademicYearLabel: '2026-2027',
        mustChangePassword: false,
        createdAt: nowMs,
        lastActivityAt: nowMs,
        expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
      };

      const token = signSessionToken(payload);

      // Force repository revocation failure
      const originalRevoke = repo.revokeSession.bind(repo);
      repo.revokeSession = async () => {
        throw new Error('Database connection lost during revocation persistence');
      };

      try {
        const logoutReq = new Request('http://localhost:3000/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${token}`,
          },
        });

        const logoutRes = await logoutRoute(logoutReq);
        expect(logoutRes.status).toBe(500);

        const body = await logoutRes.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Failed to record server-side session revocation');
        expect(body.correlationId).toBeDefined();

        // Verify session cookie was still instructed to be cleared
        const setCookieHeader = logoutRes.headers.get('set-cookie');
        expect(setCookieHeader).toBeDefined();
        expect(setCookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`);
        expect(setCookieHeader).toContain('Max-Age=0');
      } finally {
        repo.revokeSession = originalRevoke;
      }
    });

    it('rejects copied token and fails closed when session revocation database query fails in production', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const repo = getRepositories().identity;
      const nowMs = Date.now();
      const sessionId = 'session-db-failure-production';

      const payload: SessionPayload = {
        sessionId,
        staffId: 'principal-uuid-test',
        authUserId: null,
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
        activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
        activeAcademicYearLabel: '2026-2027',
        mustChangePassword: false,
        createdAt: nowMs,
        lastActivityAt: nowMs,
        expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
      };

      const token = signSessionToken(payload);
      cookieMap.set(SESSION_COOKIE_NAME, token);

      await repo.createStaff({
        id: 'principal-uuid-test',
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
      });

      const originalIsRevoked = repo.isSessionRevoked.bind(repo);
      repo.isSessionRevoked = async () => {
        throw new Error('Database connection failed during revocation lookup');
      };

      try {
        (process.env as any).NODE_ENV = 'production';
        const session = await getServerSession();
        // In production, database query failure during revocation check must fail closed
        expect(session).toBeNull();
      } finally {
        (process.env as any).NODE_ENV = origNodeEnv;
        repo.isSessionRevoked = originalIsRevoked;
      }
    });

    it('rejects copied token after explicit revocation even when cryptographic signature is valid', async () => {
      const repo = getRepositories().identity;
      const nowMs = Date.now();
      const sessionId = 'session-explicit-revocation-test';

      const payload: SessionPayload = {
        sessionId,
        staffId: 'principal-uuid-test',
        authUserId: null,
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
        activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
        activeAcademicYearLabel: '2026-2027',
        mustChangePassword: false,
        createdAt: nowMs,
        lastActivityAt: nowMs,
        expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
      };

      const token = signSessionToken(payload);
      cookieMap.set(SESSION_COOKIE_NAME, token);

      await repo.createStaff({
        id: 'principal-uuid-test',
        email: 'principal@school-demo.example',
        fullName: 'Principal Sharma',
        role: 'principal',
        isActive: true,
      });

      // Verify token is valid before revocation
      const sessionBefore = await getServerSession();
      expect(sessionBefore).not.toBeNull();
      expect(sessionBefore?.staffId).toBe('principal-uuid-test');

      // Server-side revocation is recorded
      await repo.revokeSession(sessionId, nowMs + MAX_SESSION_LIFETIME_MS);

      // Copied token presented again is rejected despite valid HMAC signature
      const sessionAfter = await getServerSession();
      expect(sessionAfter).toBeNull();
    });
  });
});
