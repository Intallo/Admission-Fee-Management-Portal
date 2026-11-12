import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../../../../../lib/auth/token';
import { getOrCreateCorrelationId } from '../../../../../lib/correlation';
import { getRepositories } from '../../../../../infrastructure/repositories';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  // Extract session token from cookie store, request cookie header, or bearer token
  let token: string | undefined;
  try {
    const cookieStore = cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // cookies() may throw in environments without RequestContext
  }

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + SESSION_COOKIE_NAME + '=([^;]*)'));
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  let revocationError: Error | null = null;

  if (token) {
    try {
      const verification = verifySessionToken(token);
      if (verification.valid) {
        await getRepositories().identity.revokeSession(
          verification.session.sessionId,
          verification.session.expiresAt
        );
        logger.info('Session successfully revoked on logout', {
          sessionId: verification.session.sessionId,
          staffId: verification.session.staffId,
          correlationId,
        });
      }
    } catch (error: any) {
      revocationError = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to record server-side session revocation during logout', {
        error: String(error),
        correlationId,
      });
    }
  }

  const status = revocationError ? 500 : 200;
  const body = revocationError
    ? {
        success: false,
        error: 'Failed to record server-side session revocation during logout. Token revocation could not be persisted.',
      }
    : { success: true, message: 'Logged out successfully.' };

  const response = NextResponse.json(body, {
    status,
    headers: {
      'x-correlation-id': correlationId,
    },
  });

  // Always clear the browser session cookie, even if server-side revocation persistence failed
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
