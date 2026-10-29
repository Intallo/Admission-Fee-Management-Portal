import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { reprintCertificateSchema } from '@/validation/certificates';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer']);
    const rawBody = await request.json();
    const parsed = reprintCertificateSchema.parse(rawBody);

    const result = await certificatesService.reprintCertificate(
      params.id,
      { reason: parsed.reason },
      session
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/certificates/${params.id}/reprint`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
