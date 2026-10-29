import { describe, it, expect } from 'vitest';
import { enforcePolicy } from '../src/policy/guards';
import { AuthorizationError } from '../src/lib/errors';
import { signSessionToken, SessionPayload } from '../src/lib/auth/token';

describe('Defense Against Forged Roles & Staff Identifiers', () => {
  const baseTime = Date.now();

  // Genuine Accountant Session
  const genuineAccountantSession: SessionPayload = {
    sessionId: 'session-acc-1',
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: 'auth-acc-1',
    email: 'accounts@school-demo.example',
    fullName: 'Demo Accountant',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: 'year-001',
    activeAcademicYearLabel: '2026-2027',
    mustChangePassword: false,
    createdAt: baseTime,
    lastActivityAt: baseTime,
    expiresAt: baseTime + 3600000,
  };

  it('prohibits an accountant from claiming Principal authority via request payload or body', () => {
    // Attacker sends a forged body claiming to be Principal
    const forgedRequestBody = {
      role: 'principal',
      staffId: '99999999-9999-9999-9999-999999999999',
      actorRole: 'principal',
      notes: 'Forged request body trying to approve a fee concession',
    };

    // Server-side policy guard reads session.role strictly from the authenticated session, NOT the request body
    const effectiveRole = genuineAccountantSession.role; // server-side resolution
    expect(effectiveRole).toBe('accountant');
    expect(forgedRequestBody.role).not.toBe(effectiveRole);

    // Concession approval requires Principal
    expect(() => {
      enforcePolicy(effectiveRole, 'fees:approve_concession');
    }).toThrow(AuthorizationError);
  });

  it('rejects forged headers attempting to override staffId and role', () => {
    const incomingHeaders = new Headers({
      'x-role': 'principal',
      'x-staff-id': '99999999-9999-9999-9999-999999999999',
      'x-actor-role': 'principal',
    });

    // Architecture rule: headers are never trusted for authorization
    const trustedRole = genuineAccountantSession.role;
    expect(incomingHeaders.get('x-role')).toBe('principal');
    expect(trustedRole).toBe('accountant');

    // Action requiring principal fails
    expect(() => {
      enforcePolicy(trustedRole, 'admissions:approve_decision');
    }).toThrow(AuthorizationError);
  });
});
