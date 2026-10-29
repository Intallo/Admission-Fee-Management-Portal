import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer']);
    const rawBody = await request.json();
    const academicYearId = rawBody.academicYearId || session.activeAcademicYearId;

    if (!academicYearId) {
      return NextResponse.json(
        { title: 'Validation Error', detail: 'academicYearId is required' },
        { status: 422, headers: { 'x-correlation-id': correlationId } }
      );
    }

    const result = await certificatesService.prepopulateYearCertificates(
      academicYearId,
      session
    );

    return NextResponse.json(result, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/certificates/prepopulate',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
