import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '../../../../../lib/auth/token';
import { getOrCreateCorrelationId } from '../../../../../lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully.' },
    {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
      },
    }
  );

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
