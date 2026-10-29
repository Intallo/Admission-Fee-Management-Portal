import { NextResponse } from 'next/server';
import { requireAuthUser, requireRole } from '@/auth/guards';
import { feeConfigurationService } from '@/modules/fee-configuration/service';
import { createFeeHeadSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { FeeCategory } from '@/modules/fee-configuration/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    await requireAuthUser();

    const category = (searchParams.get('category') as FeeCategory) || undefined;
    const list = await feeConfigurationService.listFeeHeads(category);

    return NextResponse.json(list, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/fee-config/heads',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['accountant', 'principal']);
    const rawBody = await request.json();

    const parsed = createFeeHeadSchema.parse(rawBody);

    const created = await feeConfigurationService.createFeeHead(parsed, session);

    return NextResponse.json(created, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/fee-config/heads',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
