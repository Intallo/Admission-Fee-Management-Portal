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
    // Allow school staff and system administrators to view dashboard metrics (ROLE_PERMISSION_MATRIX.md US-39)
    const session = await requireRole([
      'principal',
      'accountant',
      'admission_officer',
      'clerk',
      'read_only',
      'system_admin',
    ]);

    const academicYearId = searchParams.get('academicYearId') || undefined;
    const metrics = await auditReportingService.getDashboardMetrics(
      academicYearId,
      session
    );

    return NextResponse.json(metrics, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/dashboard/metrics',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
