import { NextResponse } from 'next/server';
import { loginSchema } from '../../../../../validation/auth';
import { identityService } from '../../../../../modules/identity-access/service';
import { formatErrorResponse } from '../../../../../lib/errors';
import { getOrCreateCorrelationId } from '../../../../../lib/correlation';
import { SESSION_COOKIE_NAME, MAX_SESSION_LIFETIME_MS } from '../../../../../lib/auth/token';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const rawBody = await request.json();
    const parsed = loginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('Invalid email or password format.'),
          { correlationId, instance: '/api/v1/auth/login' }
        ).body,
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const result = await identityService.login(email, password, { correlationId });

    const response = NextResponse.json(
      {
        user: result.user,
        mustChangePassword: result.mustChangePassword,
        activeAcademicYearId: result.activeAcademicYearId,
        activeAcademicYearLabel: result.activeAcademicYearLabel,
      },
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
        },
      }
    );

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_SESSION_LIFETIME_MS / 1000,
    });

    return response;
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/auth/login',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
