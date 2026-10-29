import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { rejectApplicationSchema } from '@/validation/admissions';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal']);
    const body = await request.json();

    const parsed = rejectApplicationSchema.parse(body);

    const rejected = await admissionsService.rejectApplication(
      params.id,
      parsed.reason,
      session
    );

    return NextResponse.json({ application: rejected }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admissions/applications/${params.id}/reject`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
