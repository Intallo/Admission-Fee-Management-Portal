import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { feeAdjustmentRequestSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { toDecimalInrString } from '@/modules/shared/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['accountant', 'principal']);
    const rawBody = await request.json();

    const parsed = feeAdjustmentRequestSchema.parse(rawBody);

    const lineId = parsed.studentFeeAssessmentLineId || parsed.assessmentLineId!;
    const adjType = parsed.adjustmentType === 'waiver' || parsed.adjustmentType === 'scholarship'
      ? 'concession'
      : (parsed.adjustmentType as any);

    const result = await feesLedgerService.requestFeeAdjustment(
      {
        studentFeeAssessmentLineId: lineId,
        adjustmentType: adjType,
        amount: toDecimalInrString(parsed.amount),
        reason: parsed.reason,
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
      instance: '/api/v1/fees/adjustments',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
