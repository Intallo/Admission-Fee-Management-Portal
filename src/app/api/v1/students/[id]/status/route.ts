import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { studentRecordsService } from '@/modules/student-records/service';
import { markStudentStatusSchema } from '@/validation/students';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Principal retains exclusive institutional authority for student Left/Transferred status
    const session = await requireRole(['principal']);
    const rawBody = await request.json();
    const parsed = markStudentStatusSchema.parse(rawBody);

    const result = await studentRecordsService.markStudentStatus(
      params.id,
      parsed,
      session
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/students/${params.id}/status`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
