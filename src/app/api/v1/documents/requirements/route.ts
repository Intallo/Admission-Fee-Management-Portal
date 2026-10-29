import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/auth/guards';
import { documentsService } from '@/modules/documents/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireAuthUser();
    const academicYearId = searchParams.get('academicYearId') || session.activeAcademicYearId;
    const gradeLevelId = searchParams.get('gradeLevelId') || undefined;

    const requirements = await documentsService.listRequirements(academicYearId, gradeLevelId);

    return NextResponse.json({ requirements }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/documents/requirements',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
