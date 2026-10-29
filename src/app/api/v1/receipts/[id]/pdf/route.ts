import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/auth/guards';
import { receiptsService } from '@/modules/receipts/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);
  const isDuplicate = searchParams.get('duplicate') === 'true';

  try {
    await requireAuthUser();

    const pdfBuffer = await receiptsService.getReceiptPdfBuffer(params.id, isDuplicate);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="receipt-${params.id}.pdf"`,
        'x-correlation-id': correlationId,
      },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/receipts/${params.id}/pdf`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
