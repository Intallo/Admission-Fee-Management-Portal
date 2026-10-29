import { NextResponse } from 'next/server';
import { requireAuthUser } from '../../../../../auth/guards';
import { formatErrorResponse } from '../../../../../lib/errors';
import { getOrCreateCorrelationId } from '../../../../../lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireAuthUser();

    return NextResponse.json(
      {
        user: {
          staffId: session.staffId,
          authUserId: session.authUserId,
          email: session.email,
          fullName: session.fullName,
          role: session.role,
          isActive: session.isActive,
          activeAcademicYearId: session.activeAcademicYearId,
          activeAcademicYearLabel: session.activeAcademicYearLabel,
        },
      },
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
        },
      }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/auth/me',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
