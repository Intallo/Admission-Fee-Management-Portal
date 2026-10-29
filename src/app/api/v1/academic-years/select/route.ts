import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/auth/guards';
import { academicYearsService } from '@/modules/academic-years/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { ACADEMIC_YEAR_COOKIE_NAME, MAX_SESSION_LIFETIME_MS } from '@/lib/auth/token';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    await requireAuthUser();
    const body = await request.json();

    const { academicYearId } = body;
    if (!academicYearId) {
      return NextResponse.json(
        formatErrorResponse(
          new Error('academicYearId is required.'),
          { correlationId, instance: '/api/v1/academic-years/select' }
        ).body,
        { status: 400 }
      );
    }

    const year = await academicYearsService.getAcademicYearById(academicYearId);

    const response = NextResponse.json(
      {
        success: true,
        activeAcademicYear: year,
      },
      {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
      }
    );

    response.cookies.set({
      name: ACADEMIC_YEAR_COOKIE_NAME,
      value: JSON.stringify({ id: year.id, label: year.label }),
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_SESSION_LIFETIME_MS / 1000,
    });

    return response;
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/academic-years/select',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
