import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feeConfigurationService } from '@/modules/fee-configuration/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    // Principal ONLY (Operation 3 / signed AUTHORIZATION_MATRIX.md)
    const session = await requireRole(['principal']);

    const approved = await feeConfigurationService.approveFeeStructure(params.id, session);

    return NextResponse.json(approved, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/fee-config/structures/${params.id}/approve`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
