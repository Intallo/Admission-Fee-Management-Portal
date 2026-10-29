import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { issueCertificateSchema } from '@/validation/certificates';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Step 2 TC approval and issuance is strictly Principal authority (API_SPEC Operation 7)
    const session = await requireRole(['principal']);
    const rawBody = await request.json();
    const parsed = issueCertificateSchema.parse(rawBody);

    const result = await certificatesService.issueCertificate(
      params.id,
      {
        reasonForLeaving: parsed.reasonForLeaving || undefined,
        dateOfLeaving: parsed.dateOfLeaving || undefined,
        conduct: parsed.conduct || undefined,
        progress: parsed.progress || undefined,
        remarks: parsed.remarks || undefined,
        duesOverrideReason: parsed.duesOverrideReason || undefined,
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
      instance: `/api/v1/certificates/${params.id}/issue`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
