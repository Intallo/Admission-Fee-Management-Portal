import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { feesLedgerService } from '@/modules/fees-ledger/service';
import { admissionsService } from '@/modules/admissions/service';
import { formatErrorResponse } from '@/lib/errors';
import { getOrCreateCorrelationId } from '@/lib/correlation';
import { addInr } from '@/lib/money/inr';
import { toDecimalInrString } from '@/modules/shared/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = getOrCreateCorrelationId(request.headers);
  const { searchParams } = new URL(request.url);

  try {
    const session = await requireRole(['accountant', 'principal', 'read_only']);
    const academicYearId = searchParams.get('academicYearId') || session.activeAcademicYearId;

    const allRecords = admissionsService.getAllAcademicRecords().filter(
      (r) => !academicYearId || r.academicYearId === academicYearId
    );

    let totalAssessed = '0.00';
    let totalCollected = '0.00';
    let totalOutstanding = '0.00';

    const studentSummaries = [];

    for (const record of allRecords) {
      try {
        const dues = await feesLedgerService.getStudentDues(record.id, session);
        totalAssessed = addInr(totalAssessed, dues.totalAssessedInr);
        totalCollected = addInr(totalCollected, dues.totalPaidInr);
        totalOutstanding = addInr(totalOutstanding, dues.netBalanceDueInr);

        studentSummaries.push({
          academicRecordId: record.id,
          admissionNumber: dues.admissionNumber,
          studentName: dues.studentName,
          standard: dues.standard,
          totalAssessedInr: dues.totalAssessedInr,
          totalPaidInr: dues.totalPaidInr,
          netBalanceDueInr: dues.netBalanceDueInr,
        });
      } catch {
        // Skip uninitialized
      }
    }

    return NextResponse.json(
      {
        academicYearId,
        totalStudentsCount: studentSummaries.length,
        totalAssessedInr: toDecimalInrString(totalAssessed),
        totalCollectedInr: toDecimalInrString(totalCollected),
        totalOutstandingDuesInr: toDecimalInrString(totalOutstanding),
        students: studentSummaries,
      },
      {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
      }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error, {
      correlationId,
      instance: '/api/v1/reports/dues',
    });
    return NextResponse.json(body, { status, headers: { 'x-correlation-id': correlationId } });
  }
}
