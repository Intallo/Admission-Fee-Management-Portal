import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { receiptsService } from '@/modules/receipts/service';
import { issueFinalReceiptSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['accountant', 'principal']);
    const rawBody = await request.json();

    const parsed = issueFinalReceiptSchema.parse(rawBody);

    const result = await receiptsService.issueFinalFeesReceipt(
      { studentAcademicRecordId: parsed.studentAcademicRecordId },
      session
    );

    return NextResponse.json(
      {
        consolidatedReceiptId: result.id,
        receiptNumber: result.receiptNumber,
        studentAcademicRecordId: result.studentAcademicRecordId,
        totalAmountInr: result.totalAmountInr,
        totalAmountInWords: result.totalAmountInWords,
        itemizedReceiptsCount: result.itemizedPriorReceipts.length,
        signatories: [
          result.renderedSnapshot.signatories.payerSignatureLine,
          result.renderedSnapshot.signatories.cashierSignatureLine,
          result.renderedSnapshot.signatories.managerSignatureLine,
        ],
        generatedAt: result.createdAt,
      },
      {
        status: 201,
        headers: { 'x-correlation-id': correlationId },
      }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/receipts/final',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
