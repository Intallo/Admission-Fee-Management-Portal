import { NextResponse } from 'next/server';
import { requireAuthUser, requireRole } from '@/auth/guards';
import { academicYearsService } from '@/modules/academic-years/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    await requireAuthUser();
    const academicYears = await academicYearsService.listAcademicYears();

    return NextResponse.json({ academicYears }, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/academic-years',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'system_admin']);
    const body = await request.json();

    const { label, startDate, endDate, notes } = body;
    if (!label || !startDate || !endDate) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('Label, startDate, and endDate are required fields.'),
          { correlationId, instance: '/api/v1/academic-years' }
        ).body,
        { status: 400 }
      );
    }

    const created = await academicYearsService.createAcademicYear(
      { label, startDate, endDate, notes },
      session
    );

    return NextResponse.json({ academicYear: created }, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/academic-years',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
