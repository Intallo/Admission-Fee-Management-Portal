import 'server-only';
import { cookies } from 'next/headers';
import { AuthenticatedUserSession, StaffRole } from '../modules/identity-access/types';
import { verifySessionToken, SESSION_COOKIE_NAME, ACADEMIC_YEAR_COOKIE_NAME } from '../lib/auth/token';
import { getRepositories } from '../infrastructure/repositories';
import { logger } from '../lib/logger';

/**
 * Resolves the authenticated user session from HTTP-only cookies and queries the staff directory.
 * Enforces 30-minute idle timeout and deactivation checks.
 * Guarantees that browser-supplied roles, staff IDs, or user IDs CANNOT override trusted session identity.
 */
export async function getServerSession(): Promise<AuthenticatedUserSession | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const verification = verifySessionToken(token);
    if (!verification.valid) {
      logger.warn('Session verification failed', { reason: verification.reason });
      return null;
    }

    const sessionPayload = verification.session;

    // Server-side session revocation verification (prevents re-use of copied tokens post-logout)
    try {
      const isRevoked = await getRepositories().identity.isSessionRevoked(sessionPayload.sessionId);
      if (isRevoked) {
        logger.warn('Session rejected: session has been revoked', {
          sessionId: sessionPayload.sessionId,
          staffId: sessionPayload.staffId,
        });
        return null;
      }
    } catch (revocationError) {
      if (process.env.NODE_ENV === 'production' || process.env.PERSISTENCE_MODE === 'postgres') {
        logger.error('Session revocation check failed closed in production environment', {
          error: String(revocationError),
          staffId: sessionPayload.staffId,
        });
        return null;
      }
    }

    // Active staff lookup & verification: verify staff account is not deactivated
    let isActive = sessionPayload.isActive;
    let actualRole = sessionPayload.role;
    let actualFullName = sessionPayload.fullName;

    try {
      const staff = await getRepositories().identity.getStaffById(sessionPayload.staffId);
      if (staff) {
        const staffIsActive = staff.isActive ?? staff.is_active;
        if (!staffIsActive) {
          logger.warn('Session rejected: staff member has been deactivated', { staffId: staff.id });
          return null;
        }
        isActive = staffIsActive;
        actualRole = staff.role as StaffRole;
        actualFullName = staff.fullName ?? staff.full_name;
      } else if (process.env.NODE_ENV === 'production' || process.env.PERSISTENCE_MODE === 'postgres') {
        logger.warn('Session rejected in production: staff member record not found', { staffId: sessionPayload.staffId });
        return null;
      }
    } catch (dbError) {
      if (process.env.NODE_ENV === 'production' || process.env.PERSISTENCE_MODE === 'postgres') {
        logger.error('Session lookup failed closed in production environment', { error: String(dbError), staffId: sessionPayload.staffId });
        return null;
      }
      // In isolated tests without DB, use sessionPayload directly
    }

    if (!isActive) {
      return null;
    }

    // Check if staff has selected a different active academic year
    const activeYearOverride = cookieStore.get(ACADEMIC_YEAR_COOKIE_NAME)?.value;
    let academicYearId = sessionPayload.activeAcademicYearId;
    let academicYearLabel = sessionPayload.activeAcademicYearLabel;

    if (activeYearOverride) {
      try {
        const parsed = JSON.parse(activeYearOverride);
        if (parsed.id && parsed.label) {
          academicYearId = parsed.id;
          academicYearLabel = parsed.label;
        }
      } catch {
        // Fall back to session default
      }
    }

    return {
      staffId: sessionPayload.staffId,
      authUserId: sessionPayload.authUserId || sessionPayload.staffId,
      email: sessionPayload.email,
      fullName: actualFullName,
      role: actualRole,
      isActive,
      activeAcademicYearId: academicYearId,
      activeAcademicYearLabel: academicYearLabel,
    };
  } catch (error) {
    logger.error('Failed to resolve server session', { error: String(error) });
    return null;
  }
}
