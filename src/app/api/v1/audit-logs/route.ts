import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { auditReportingService } from '@/modules/audit-reporting/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireRole(['principal', 'system_admin', 'accountant', 'read_only']);

    const filter = {
      actorStaffId: searchParams.get('actorStaffId') || undefined,
      actorRole: searchParams.get('actorRole') || undefined,
      action: searchParams.get('action') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      outcome: (searchParams.get('outcome') as any) || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    };

    const results = await auditReportingService.listAuditLogs(filter, session);

    return NextResponse.json(results, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/audit-logs',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
