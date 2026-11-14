import { describe, it, expect, vi, beforeEach } from 'vitest';
import nextConfig from '../next.config.mjs';
import { GET as getStaffRoute } from '../src/app/api/v1/admin/staff/route';
import { POST as resetPasswordRoute } from '../src/app/api/v1/admin/staff/[id]/reset-password/route';
import { getRepositories } from '../src/infrastructure/repositories';
import { signSessionToken, SESSION_COOKIE_NAME, SessionPayload, MAX_SESSION_LIFETIME_MS } from '../src/lib/auth/token';

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

describe('Admin Staff API Error Handling & Security Headers', () => {
  beforeEach(() => {
    cookieMap.clear();
  });
  it('next.config.mjs contains Content-Security-Policy header', async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;
    const headersConfig = await nextConfig.headers();
    expect(headersConfig.length).toBeGreaterThan(0);

    const defaultRoute = headersConfig.find((h: any) => h.source === '/:path*');
    expect(defaultRoute).toBeDefined();
    if (!defaultRoute) return;

    const cspHeader = defaultRoute.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(cspHeader).toBeDefined();
    if (!cspHeader) return;
    expect(cspHeader.value).toContain("default-src 'self'");
    expect(cspHeader.value).toContain("frame-ancestors 'none'");
  });

  it('next.config.mjs removes unsafe-eval from Content-Security-Policy in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      // Re-evaluate headersConfig in production
      const headersConfig = await nextConfig.headers!();
      const defaultRoute = headersConfig.find((h: any) => h.source === '/:path*');
      const cspHeader = defaultRoute?.headers.find((h: any) => h.key === 'Content-Security-Policy');
      expect(cspHeader).toBeDefined();
      expect(cspHeader?.value).not.toContain("'unsafe-eval'");
      expect(cspHeader?.value).toContain("script-src 'self' 'unsafe-inline'");
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
    }
  });

  it('GET /api/v1/admin/staff passes authenticated session to repository and returns staff list', async () => {
    const nowMs = Date.now();
    const adminPayload: SessionPayload = {
      sessionId: 'admin-staff-list-session',
      staffId: 'admin-uuid-test',
      authUserId: null,
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: nowMs,
      lastActivityAt: nowMs,
      expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
    };

    const token = signSessionToken(adminPayload);
    cookieMap.set(SESSION_COOKIE_NAME, token);

    const repo = getRepositories().identity;
    let passedSession: any = null;
    const originalListStaff = repo.listStaff.bind(repo);
    repo.listStaff = async (session?: any) => {
      passedSession = session;
      return [
        {
          id: 'admin-uuid-test',
          email: 'system.admin@school-demo.example',
          role: 'system_admin',
          fullName: 'Demo System Administrator',
          phone: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    };

    try {
      const req = new Request('http://localhost:3000/api/v1/admin/staff', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getStaffRoute(req);
      expect(res.status).toBe(200);
      expect(passedSession).toBeDefined();
      expect(passedSession.role).toBe('system_admin');
      expect(passedSession.staffId).toBe('admin-uuid-test');

      const body = await res.json();
      expect(body.staff).toHaveLength(1);
      expect(body.staff[0].email).toBe('system.admin@school-demo.example');
    } finally {
      repo.listStaff = originalListStaff;
    }
  });

  it('GET /api/v1/admin/staff returns HTTP 500 when database query fails, without suppressing errors', async () => {
    const nowMs = Date.now();
    const adminPayload: SessionPayload = {
      sessionId: 'admin-staff-test-session',
      staffId: 'admin-uuid-test',
      authUserId: null,
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: nowMs,
      lastActivityAt: nowMs,
      expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
    };

    const token = signSessionToken(adminPayload);
    cookieMap.set(SESSION_COOKIE_NAME, token);

    const repo = getRepositories().identity;
    await repo.createStaff({
      id: 'admin-uuid-test',
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
    });

    // Mock identity repository listStaff to throw a database connection error
    const originalListStaff = repo.listStaff.bind(repo);
    repo.listStaff = async () => {
      throw new Error('Database connection pool exhausted');
    };

    try {
      const req = new Request('http://localhost:3000/api/v1/admin/staff', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getStaffRoute(req);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.status).toBe(500);
      expect(body.title).toContain('Internal Server Error');
    } finally {
      repo.listStaff = originalListStaff;
    }
  });

  it('POST /api/v1/admin/staff/[id]/reset-password returns HTTP 500 when database lookup fails without suppressing errors', async () => {
    const nowMs = Date.now();
    const adminPayload: SessionPayload = {
      sessionId: 'admin-staff-reset-session',
      staffId: 'admin-uuid-test',
      authUserId: null,
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: nowMs,
      lastActivityAt: nowMs,
      expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
    };

    const token = signSessionToken(adminPayload);
    cookieMap.set(SESSION_COOKIE_NAME, token);

    const repo = getRepositories().identity;
    await repo.createStaff({
      id: 'admin-uuid-test',
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
    });

    const originalGetStaffById = repo.getStaffById.bind(repo);
    repo.getStaffById = async () => {
      throw new Error('Database query failure during staff lookup');
    };

    try {
      const req = new Request('http://localhost:3000/api/v1/admin/staff/some-target-id/reset-password', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await resetPasswordRoute(req, { params: { id: 'some-target-id' } });
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.status).toBe(500);
      expect(body.title).toContain('Internal Server Error');
    } finally {
      repo.getStaffById = originalGetStaffById;
    }
  });

  it('POST /api/v1/admin/staff/[id]/reset-password returns HTTP 404 when staff is not found', async () => {
    const nowMs = Date.now();
    const adminPayload: SessionPayload = {
      sessionId: 'admin-staff-reset-session-404',
      staffId: 'admin-uuid-test',
      authUserId: null,
      email: 'system.admin@school-demo.example',
      fullName: 'Demo System Administrator',
      role: 'system_admin',
      isActive: true,
      activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
      activeAcademicYearLabel: '2026-2027',
      mustChangePassword: false,
      createdAt: nowMs,
      lastActivityAt: nowMs,
      expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
    };

    const token = signSessionToken(adminPayload);
    cookieMap.set(SESSION_COOKIE_NAME, token);

    const req = new Request('http://localhost:3000/api/v1/admin/staff/non-existent-uuid/reset-password', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await resetPasswordRoute(req, { params: { id: 'non-existent-uuid' } });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.status).toBe(404);
  });
});
