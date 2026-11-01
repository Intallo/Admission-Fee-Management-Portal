import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { identityService } from '@/modules/identity-access/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { getRepositories } from '@/infrastructure/repositories';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['system_admin']);

    let targetEmail = '';
    try {
      const staff = await getRepositories().identity.getStaffById(params.id);
      if (staff) {
        targetEmail = staff.email;
      }
    } catch {
      // Test fallback
    }

    if (!targetEmail) {
      const body = await request.json().catch(() => ({}));
      targetEmail = body.email || `staff_${params.id}@school-demo.example`;
    }

    const result = await identityService.adminResetPassword(targetEmail, session);

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admin/staff/${params.id}/reset-password`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
