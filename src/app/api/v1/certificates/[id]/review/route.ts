import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { reviewCertificateSchema } from '@/validation/certificates';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Step 1 review belongs exclusively to Admission Officer per AUTHORIZATION_MATRIX.md
    const session = await requireRole(['admission_officer']);
    const rawBody = await request.json();
    const parsed = reviewCertificateSchema.parse(rawBody);

    const result = await certificatesService.reviewCertificate(
      params.id,
      {
        action: parsed.action,
        conduct: parsed.conduct,
        progress: parsed.progress,
        remarks: parsed.remarks || undefined,
      },
      session
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/certificates/${params.id}/review`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
