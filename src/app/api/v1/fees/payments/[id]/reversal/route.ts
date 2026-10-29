import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { paymentReversalSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const idempotencyKey = request.headers.get('idempotency-key') || undefined;

  try {
    // Principal strictly (US-26A, BR-22, AUTHORIZATION_MATRIX.md)
    const session = await requireRole(['principal']);
    const rawBody = await request.json();

    const parsed = paymentReversalSchema.parse(rawBody);

    const result = await feesLedgerService.reversePayment(
      params.id,
      { reason: parsed.reason },
      idempotencyKey,
      session
    );

    return NextResponse.json(result, {
      status: 201,
      headers: {
        'x-correlation-id': correlationId,
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/fees/payments/${params.id}/reversal`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
