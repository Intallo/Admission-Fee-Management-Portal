import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { returnToDraftSchema } from '@/validation/admissions';
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

    const parsed = returnToDraftSchema.parse(body);

    const returned = await admissionsService.returnToDraft(
      params.id,
      parsed.reason,
      session
    );

    return NextResponse.json({ application: returned }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admissions/applications/${params.id}/return-to-draft`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
