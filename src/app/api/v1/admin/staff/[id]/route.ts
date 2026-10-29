import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { identityService } from '@/modules/identity-access/service';
import { updateStaffRoleSchema } from '@/validation/auth';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['system_admin']);
    const rawBody = await request.json();
    const parsed = updateStaffRoleSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('Invalid update parameters.'),
          { correlationId, instance: `/api/v1/admin/staff/${params.id}` }
        ).body,
        { status: 400 }
      );
    }

    await identityService.updateStaffMember(params.id, parsed.data, session);

    return NextResponse.json(
      { success: true, message: 'Staff member updated successfully.' },
      { status: 200, headers: { 'x-correlation-id': correlationId } }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: `/api/v1/admin/staff/${params.id}`,
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
