import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireAuthUser();
    const sectionId = searchParams.get('sectionId');
    const academicYearId = searchParams.get('academicYearId') || session.activeAcademicYearId;

    if (!sectionId) {
      return NextResponse.json(
        formatErrorResponse(new Error('sectionId query parameter is required.'), {
          correlationId,
          instance: '/api/v1/admissions/capacity',
        }).body,
        { status: 400 }
      );
    }

    const capacity = await admissionsService.checkCapacity(sectionId, academicYearId);

    return NextResponse.json({ capacity }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/admissions/capacity',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
