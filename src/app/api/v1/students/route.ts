import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { studentRecordsService } from '@/modules/student-records/service';
import { searchStudentsSchema } from '@/validation/students';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const rawParams = {
      search: searchParams.get('search') || undefined,
      academicYearId: searchParams.get('academicYearId') || undefined,
      gradeLevelId: searchParams.get('gradeLevelId') || undefined,
      sectionId: searchParams.get('sectionId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    };

    const parsed = searchStudentsSchema.parse(rawParams);
    const results = await studentRecordsService.searchStudents(parsed, session);

    return NextResponse.json(results, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/students',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
