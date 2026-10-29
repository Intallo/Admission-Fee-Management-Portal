import { NextResponse } from 'next/server';
import { requireAuthUser } from '../../../../../auth/guards';
import { identityService } from '../../../../../modules/identity-access/service';
import { formatErrorResponse } from '../../../../../lib/errors';
import { getOrCreateCorrelationId } from '../../../../../lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireAuthUser();
    const body = await request.json();

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('Both currentPassword and newPassword are required.'),
          { correlationId, instance: '/api/v1/auth/change-password' }
        ).body,
        { status: 400 }
      );
    }

    const result = await identityService.changePassword(
      session.staffId,
      currentPassword,
      newPassword,
      session.email
    );

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
      },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/auth/change-password',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
