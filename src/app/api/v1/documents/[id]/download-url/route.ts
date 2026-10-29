import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { documentsService } from '@/modules/documents/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Only Principal and Admission Officer are authorized to access sensitive document download URLs (R-06)
    const session = await requireRole(['principal', 'admission_officer']);

    const presigned = await documentsService.generateDownloadUrl(params.id, session);

    return NextResponse.json(presigned, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/documents/${params.id}/download-url`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
