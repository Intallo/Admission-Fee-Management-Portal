import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, touchSession, signSessionToken, SESSION_COOKIE_NAME } from './lib/auth/token';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      const verification = verifySessionToken(token);
      if (verification.valid) {
        const session = verification.session;
        const nowMs = Date.now();
        // If at least 1 minute has elapsed since last activity, refresh the rolling session
        if (nowMs - session.lastActivityAt > 60 * 1000) {
          const touched = touchSession(session, nowMs);
          const refreshedToken = signSessionToken(touched);
          response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: refreshedToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: Math.floor((touched.expiresAt - nowMs) / 1000),
          });
        }
      }
    } catch {
      // Fail open to route handlers/guards
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
