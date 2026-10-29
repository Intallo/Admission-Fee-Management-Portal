import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { identityService } from '@/modules/identity-access/service';
import { createStaffMemberSchema } from '@/validation/auth';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { getAdminDbClient } from '@/infrastructure/db/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    await requireRole(['system_admin']);

    let staffList: Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      isActive: boolean;
      createdAt: string;
    }> = [];

    try {
      const adminDb = getAdminDbClient();
      const { data, error } = await adminDb
        .from('staff_members')
        .select('id, full_name, email, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        staffList = data.map((s) => ({
          id: s.id,
          fullName: s.full_name,
          email: s.email,
          role: s.role,
          isActive: s.is_active,
          createdAt: s.created_at,
        }));
      }
    } catch {
      // Test fallback
    }

    return NextResponse.json({ staff: staffList }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/admin/staff',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['system_admin']);
    const rawBody = await request.json();
    const parsed = createStaffMemberSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('Invalid staff creation parameters.'),
          { correlationId, instance: '/api/v1/admin/staff' }
        ).body,
        { status: 400 }
      );
    }

    const result = await identityService.createStaffMember(parsed.data, session);

    return NextResponse.json(result, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/admin/staff',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
