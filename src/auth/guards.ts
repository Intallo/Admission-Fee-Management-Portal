import 'server-only';
import { getServerSession } from './session';
import { AuthenticatedUserSession, StaffRole } from '../modules/identity-access/types';
import { AuthenticationError, AuthorizationError } from '../lib/errors';

/**
 * Asserts an active authenticated session, returning the session envelope.
 * Throws AuthenticationError (401) if no active session exists.
 */
export async function requireAuthUser(): Promise<AuthenticatedUserSession> {
  const session = await getServerSession();
  if (!session) {
    throw new AuthenticationError('Valid staff authentication session is required.');
  }
  return session;
}

/**
 * Asserts that the authenticated staff member possesses one of the allowed roles.
 * Throws AuthorizationError (403) if unauthorized.
 */
export async function requireRole(allowedRoles: StaffRole[]): Promise<AuthenticatedUserSession> {
  const session = await requireAuthUser();
  if (!allowedRoles.includes(session.role)) {
    throw new AuthorizationError(
      `Access Denied: Role "${session.role}" is not permitted to perform this operation.`
    );
  }
  return session;
}
