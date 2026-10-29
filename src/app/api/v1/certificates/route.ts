import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { certificatesService } from '@/modules/certificates-lctc/service';
import { requestCertificateSchema } from '@/validation/certificates';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireRole(['principal', 'admission_officer']);

    const filter = {
      academicYearId: searchParams.get('academicYearId') || undefined,
      gradeLevelId: searchParams.get('gradeLevelId') || undefined,
      sectionId: searchParams.get('sectionId') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      reviewStatus: (searchParams.get('reviewStatus') as any) || undefined,
      search: searchParams.get('search') || undefined,
      studentId: searchParams.get('studentId') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    };

    const result = await certificatesService.listCertificates(filter, session);

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/certificates',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer']);
    const rawBody = await request.json();
    const parsed = requestCertificateSchema.parse(rawBody);

    const result = await certificatesService.requestCertificate(
      {
        studentAcademicRecordId: parsed.studentAcademicRecordId,
        certificateType: parsed.certificateType,
        reasonForLeaving: parsed.reasonForLeaving,
        dateOfLeaving: parsed.dateOfLeaving,
        intendedSchool: parsed.intendedSchool || undefined,
        conduct: parsed.conduct || undefined,
        progress: parsed.progress || undefined,
        remarks: parsed.remarks || undefined,
      },
      session
    );

    return NextResponse.json(result, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/certificates',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
