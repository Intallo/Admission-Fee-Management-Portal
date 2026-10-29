import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { recordPaymentSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { toDecimalInrString } from '@/modules/shared/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const idempotencyKey = request.headers.get('idempotency-key') || undefined;

  try {
    const session = await requireRole(['accountant', 'principal', 'clerk']);
    const rawBody = await request.json();

    const parsed = recordPaymentSchema.parse(rawBody);

    const category = parsed.category || parsed.feeCategory!;
    const amount = parsed.amount || parsed.totalAmount!;
    const method = (parsed.method || parsed.paymentMode || 'cash') as any;

    const allocations = parsed.allocations.map((a) => ({
      assessmentLineId: a.assessmentLineId,
      amount: toDecimalInrString(a.amount || a.allocatedAmount!),
    }));

    const result = await feesLedgerService.recordOfflinePayment(
      {
        studentAcademicRecordId: parsed.studentAcademicRecordId,
        category,
        amount: toDecimalInrString(amount),
        method,
        payerName: parsed.payerName,
        referenceNumber: parsed.referenceNumber || undefined,
        remarks: parsed.remarks || undefined,
        allocations,
      },
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
      instance: '/api/v1/fees/payments',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
