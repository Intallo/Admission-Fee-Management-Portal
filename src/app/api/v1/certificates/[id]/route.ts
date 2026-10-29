import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer']);
    const cert = await certificatesService.getCertificateById(params.id, session);

    return NextResponse.json(cert, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/certificates/${params.id}`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
