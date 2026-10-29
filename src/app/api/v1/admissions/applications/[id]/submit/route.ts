import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer', 'clerk']);
    let body: { overrideMissingDocumentsReason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body allowed if no override reason
    }

    const submitted = await admissionsService.submitApplication(
      params.id,
      body,
      session
    );

    return NextResponse.json({ application: submitted }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admissions/applications/${params.id}/submit`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
