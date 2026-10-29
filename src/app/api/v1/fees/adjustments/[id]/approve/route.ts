import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { approveFeeAdjustmentSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Principal strictly (Operation 3 / US-26, BR-21, BR-40)
    const session = await requireRole(['principal']);
    let payload = {};
    try {
      const rawBody = await request.json();
      payload = approveFeeAdjustmentSchema.parse(rawBody);
    } catch {
      // Optional body
    }

    const result = await feesLedgerService.approveFeeAdjustment(params.id, payload, session);

    return NextResponse.json(
      {
        adjustmentId: result.id,
        assessmentLineId: result.studentFeeAssessmentLineId,
        adjustmentType: result.adjustmentType,
        amountInr: result.amount,
        status: result.status,
        approvedBy: result.approvedBy,
        approvedAt: result.approvedAt,
      },
      {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
      }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/fees/adjustments/${params.id}/approve`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
