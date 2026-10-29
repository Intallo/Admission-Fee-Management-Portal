import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { studentRecordsService } from '@/modules/student-records/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireRole([
      'principal',
      'admission_officer',
      'accountant',
      'clerk',
      'read_only',
      'system_admin',
    ]);

    const academicYearId = searchParams.get('academicYearId') || undefined;
    const profile = await studentRecordsService.getStudentProfile(
      params.id,
      academicYearId,
      session
    );

    return NextResponse.json(profile, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/students/${params.id}`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
