import { NextResponse } from 'next/server';
import { requireAuthUser, requireRole } from '@/auth/guards';
import { admissionsService } from '@/modules/admissions/service';
import { createDraftApplicationSchema } from '@/validation/admissions';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { AdmissionApplicationStatus } from '@/modules/admissions/types';
import { toDecimalInrString } from '@/modules/shared/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireAuthUser();

    const academicYearId = searchParams.get('academicYearId') || session.activeAcademicYearId;
    const status = searchParams.get('status') as AdmissionApplicationStatus | null;
    const gradeLevelId = searchParams.get('gradeLevelId') || undefined;
    const sectionId = searchParams.get('sectionId') || undefined;
    const search = searchParams.get('search') || undefined;
    const feeNotGenerated = searchParams.get('feeNotGenerated') === 'true';

    const result = await admissionsService.listApplications(
      {
        academicYearId,
        status: status || undefined,
        gradeLevelId,
        sectionId,
        search,
        feeNotGenerated,
      },
      session
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/admissions/applications',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}

export async function POST(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);

  try {
    const session = await requireRole(['principal', 'admission_officer', 'clerk']);
    const rawBody = await request.json();

    const parsed = createDraftApplicationSchema.parse(rawBody);

    const created = await admissionsService.createDraftApplication(
      {
        academicYearId: parsed.academicYearId,
        gradeLevelId: parsed.requestedGradeLevelId,
        requestedSectionId: parsed.requestedSectionId,
        student: {
          firstName: parsed.studentFirstName,
          middleName: parsed.studentMiddleName || undefined,
          lastName: parsed.studentLastName,
          dateOfBirth: parsed.dateOfBirth || '2020-01-01',
          gender: parsed.gender || 'male',
          bloodGroup: parsed.bloodGroup || undefined,
          religion: parsed.religion || undefined,
          stsNumber: parsed.stsNumber || undefined,
          diseNumber: parsed.diseNumber || undefined,
          transportMode: parsed.transportMode || undefined,
          transportOptedIn: parsed.transportOptedIn ?? undefined,
          addressLine1: parsed.residentialAddress || '12 Demo Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        sensitiveDetails: {
          aadhaarNumber: parsed.aadhaarNumber || undefined,
          caste: parsed.caste || undefined,
          subCaste: parsed.subCaste || undefined,
          annualFamilyIncome: parsed.annualFamilyIncome ? toDecimalInrString(parsed.annualFamilyIncome) : undefined,
          bankName: parsed.bankName || undefined,
          accountNumber: parsed.accountNumber || undefined,
          ifscCode: parsed.ifscCode || undefined,
        },
        guardians: [
          {
            relationship: parsed.primaryGuardianRelationship || 'Parent',
            fullName: parsed.primaryGuardianName || 'Parent Name',
            mobileNumber: parsed.primaryGuardianPhone || '+919876543210',
            residentialAddress: parsed.residentialAddress || '12 Demo Street',
            isPrimaryContact: true,
          },
        ],
      },
      session
    );

    return NextResponse.json({ application: created }, {
      status: 201,
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/admissions/applications',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
