import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { identityService } from '@/modules/identity-access/service';
import { formatErrorResponse, NotFoundError } from '@/lib/errors';
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

    const staff = await getRepositories().identity.getStaffById(params.id);
    if (!staff) {
      throw new NotFoundError(`Staff member with ID "${params.id}" not found.`);
    }

    const result = await identityService.adminResetPassword(staff.email, session);

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
