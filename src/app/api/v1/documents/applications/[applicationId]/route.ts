import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/auth/guards';
import { documentsService } from '@/modules/documents/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireAuthUser();
    const includeReplaced = searchParams.get('includeReplaced') === 'true';

    const documents = await documentsService.listApplicationDocuments(
      params.applicationId,
      session,
      includeReplaced
    );

    return NextResponse.json({ documents }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/documents/applications/${params.applicationId}`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
