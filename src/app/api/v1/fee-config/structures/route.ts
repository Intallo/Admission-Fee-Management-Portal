import { NextResponse } from 'next/server';
import { requireAuthUser, requireRole } from '@/auth/guards';
import { feeConfigurationService } from '@/modules/fee-configuration/service';
import { createFeeStructureSchema } from '@/validation/fees';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { FeeStructureState } from '@/modules/fee-configuration/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireAuthUser();

    const academicYearId = searchParams.get('academicYearId') || session.activeAcademicYearId;
    const gradeLevelId = searchParams.get('gradeLevelId') || undefined;
    const status = (searchParams.get('status') as FeeStructureState) || undefined;

    const list = await feeConfigurationService.listFeeStructures({
      academicYearId,
      gradeLevelId,
      status,
    });

    return NextResponse.json(list, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/fee-config/structures',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['accountant', 'principal']);
    const rawBody = await request.json();

    const parsed = createFeeStructureSchema.parse(rawBody);

    const created = await feeConfigurationService.createFeeStructure(parsed as any, session);

    return NextResponse.json(created, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/fee-config/structures',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
