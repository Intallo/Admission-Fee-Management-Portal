import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { approveApplicationSchema } from '@/validation/admissions';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

/**
 * Operation 1: Admission Approval (`admit_student_atomic`)
 * Role Authority: Principal strictly. All other roles receive 403 Forbidden.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal']);
    const body = await request.json();

    const parsed = approveApplicationSchema.parse(body);

    const result = await admissionsService.approveApplication(
      params.id,
      {
        sectionId: parsed.assignedSectionId,
        remarks: parsed.remarks,
      },
      session
    );

    return NextResponse.json(result, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admissions/applications/${params.id}/approve`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
