import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['accountant', 'principal', 'clerk', 'read_only']);

    const duesSummary = await feesLedgerService.getStudentDues(params.id, session);

    return NextResponse.json(duesSummary, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/students/${params.id}/dues`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
