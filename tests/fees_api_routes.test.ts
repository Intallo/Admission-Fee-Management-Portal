import { describe, it, expect, beforeEach, vi } from 'vitest';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { receiptsService } from '../src/modules/receipts/service';
import { admissionsService } from '../src/modules/admissions/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { toDecimalInrString } from '../src/modules/shared/types';

let currentMockSession: AuthenticatedUserSession = {
  staffId: 'principal-uuid-test',
  authUserId: 'principal-auth-uuid',
  email: 'principal@school-demo.example',
  fullName: 'Dr. Ramesh Kulkarni (Principal)',
  role: 'principal',
  isActive: true,
  activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
  activeAcademicYearLabel: '2026-2027',
};

vi.mock('@/auth/guards', () => ({
  requireAuthUser: vi.fn(async () => currentMockSession),
  requireRole: vi.fn(async (allowedRoles: string[]) => {
    if (!allowedRoles.includes(currentMockSession.role)) {
      const { AuthorizationError } = await import('../src/lib/errors');
      throw new AuthorizationError(
        `Access Denied: Role "${currentMockSession.role}" is not permitted to perform this operation.`
      );
    }
    return currentMockSession;
  }),
}));

import { GET as listFeeStructuresRoute, POST as createFeeStructureRoute } from '../src/app/api/v1/fee-config/structures/route';
import { POST as approveFeeStructureRoute } from '../src/app/api/v1/fee-config/structures/[id]/approve/route';
import { GET as listFeeHeadsRoute, POST as createFeeHeadRoute } from '../src/app/api/v1/fee-config/heads/route';
import { GET as listTransportRatesRoute, POST as createTransportRateRoute } from '../src/app/api/v1/fee-config/transport-rates/route';
import { POST as recordPaymentRoute } from '../src/app/api/v1/fees/payments/route';
import { POST as reversePaymentRoute } from '../src/app/api/v1/fees/payments/[id]/reversal/route';
import { POST as requestAdjustmentRoute } from '../src/app/api/v1/fees/adjustments/route';
import { POST as approveAdjustmentRoute } from '../src/app/api/v1/fees/adjustments/[id]/approve/route';
import { GET as getStudentDuesRoute } from '../src/app/api/v1/students/[id]/dues/route';
import { GET as getDuesReportRoute } from '../src/app/api/v1/reports/dues/route';
import { GET as getReceiptRoute } from '../src/app/api/v1/receipts/[id]/route';
import { POST as reprintReceiptRoute } from '../src/app/api/v1/receipts/[id]/reprint/route';
import { GET as getReceiptPdfRoute } from '../src/app/api/v1/receipts/[id]/pdf/route';
import { GET as getStatementRoute } from '../src/app/api/v1/receipts/statement/[id]/route';
import { POST as issueFinalReceiptRoute } from '../src/app/api/v1/receipts/final/route';

describe('Fees, Payments and Receipts API Route Handlers (HTTP Integration)', () => {
  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  let testStudentAcademicRecordId: string;
  let tuitionLineId: string;
  let devLineId: string;

  beforeEach(async () => {
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    admissionsService.resetForTesting();

    currentMockSession = {
      staffId: 'principal-uuid-test',
      authUserId: 'principal-auth-uuid',
      email: 'principal@school-demo.example',
      fullName: 'Dr. Ramesh Kulkarni (Principal)',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: academicYearId,
      activeAcademicYearLabel: '2026-2027',
    };

    const admSession: AuthenticatedUserSession = {
      ...currentMockSession,
      staffId: 'adm-uuid-test',
      role: 'admission_officer',
    };

    // Create an admitted student
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Ananya',
          lastName: 'Bhat',
          dateOfBirth: '2020-03-20',
          gender: 'female',
          stsNumber: 'STS-2026-050',
          addressLine1: '45 Temple Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Ganesh Bhat',
            relationship: 'Father',
            mobileNumber: '+919887766554',
            residentialAddress: '45 Temple Road, Bengaluru',
            isPrimaryContact: true,
          },
        ],
      },
      admSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Pending physical document submission' },
      admSession
    );
    const approved = await admissionsService.approveApplication(
      draft.id,
      { sectionId: sectionAId },
      currentMockSession
    );

    testStudentAcademicRecordId = approved.studentAcademicRecordId;
    const assessment = admissionsService.getFeeAssessmentByRecordId(testStudentAcademicRecordId)!;

    const heads = await feeConfigurationService.listFeeHeads();
    const tuitionHead = heads.find((h) => h.code === 'TUITION_FEE')!;
    const devHead = heads.find((h) => h.code === 'DEVELOPMENT_FEE')!;

    tuitionLineId = assessment.lines.find((l) => l.feeHeadId === tuitionHead.id)!.id;
    devLineId = assessment.lines.find((l) => l.feeHeadId === devHead.id)!.id;
  });

  describe('Fee Configuration API Routes', () => {
    it('GET /api/v1/fee-config/structures returns fee structures', async () => {
      const req = new Request('http://localhost/api/v1/fee-config/structures');
      const res = await listFeeStructuresRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/v1/fee-config/structures creates draft fee structure', async () => {
      currentMockSession.role = 'accountant';

      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;

      const req = new Request('http://localhost/api/v1/fee-config/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYearId,
          gradeLevelId: std1GradeId,
          lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('15000.00') }],
        }),
      });

      const res = await createFeeStructureRoute(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.status).toBe('draft');
      expect(json.version).toBe(2);
    });

    it('POST /api/v1/fee-config/structures/[id]/approve approves structure as Principal', async () => {
      // Create draft first as Accountant
      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;
      const accSession: AuthenticatedUserSession = {
        ...currentMockSession,
        role: 'accountant',
      };
      const draft = await feeConfigurationService.createFeeStructure(
        {
          academicYearId,
          gradeLevelId: std1GradeId,
          lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('15000.00') }],
        },
        accSession
      );

      // Principal approves
      currentMockSession.role = 'principal';
      const req = new Request(`http://localhost/api/v1/fee-config/structures/${draft.id}/approve`, {
        method: 'POST',
      });
      const res = await approveFeeStructureRoute(req, { params: { id: draft.id } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('approved');
    });

    it('POST /api/v1/fee-config/structures/[id]/approve returns 403 for non-Principal', async () => {
      currentMockSession.role = 'accountant';
      const req = new Request('http://localhost/api/v1/fee-config/structures/test-id/approve', {
        method: 'POST',
      });
      const res = await approveFeeStructureRoute(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(403);
    });
  });

  describe('Fees & Ledger API Routes', () => {
    it('POST /api/v1/fees/payments records payment with Idempotency-Key', async () => {
      currentMockSession.role = 'accountant';

      const payload = {
        studentAcademicRecordId: testStudentAcademicRecordId,
        category: 'school_fee',
        amount: '15000.00',
        method: 'cash',
        payerName: 'Ganesh Bhat',
        remarks: 'Term 1 payment',
        allocations: [
          { assessmentLineId: tuitionLineId, amount: '13000.00' },
          { assessmentLineId: devLineId, amount: '2000.00' },
        ],
      };

      const req = new Request('http://localhost/api/v1/fees/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': 'idemp-http-test-01',
        },
        body: JSON.stringify(payload),
      });

      const res = await recordPaymentRoute(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.receiptNumber).toBe('RCT-2026-000001');
      expect(json.amountInr).toBe('15000.00');
      expect(json.amountInWords).toBe('Rupees Fifteen Thousand Only');

      // Re-send with same idempotency key returns cached result
      const repeatReq = new Request('http://localhost/api/v1/fees/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': 'idemp-http-test-01',
        },
        body: JSON.stringify(payload),
      });

      const repeatRes = await recordPaymentRoute(repeatReq);
      expect(repeatRes.status).toBe(201);
      const repeatJson = await repeatRes.json();
      expect(repeatJson.paymentId).toBe(json.paymentId);
      expect(repeatJson.receiptNumber).toBe(json.receiptNumber);
    });

    it('GET /api/v1/students/[id]/dues returns student dues', async () => {
      currentMockSession.role = 'accountant';
      const req = new Request(`http://localhost/api/v1/students/${testStudentAcademicRecordId}/dues`);
      const res = await getStudentDuesRoute(req, { params: { id: testStudentAcademicRecordId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.studentAcademicRecordId).toBe(testStudentAcademicRecordId);
      expect(json.totalAssessedInr).toBe('19700.00');
    });

    it('POST /api/v1/fees/payments/[id]/reversal reverses payment as Principal', async () => {
      currentMockSession.role = 'accountant';
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-rev-http-1',
        currentMockSession
      );

      // Reversal by Principal
      currentMockSession.role = 'principal';
      const req = new Request(
        `http://localhost/api/v1/fees/payments/${payment.paymentId}/reversal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Payment recorded to wrong account. Reversal authorized by Principal.',
          }),
        }
      );

      const res = await reversePaymentRoute(req, { params: { id: payment.paymentId } });
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.originalPaymentId).toBe(payment.paymentId);
      expect(json.reversalPaymentId).toBeDefined();
    });

    it('POST /api/v1/fees/payments/[id]/reversal returns 403 when called by non-Principal', async () => {
      currentMockSession.role = 'accountant';
      const req = new Request('http://localhost/api/v1/fees/payments/test-id/reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Reversal mistake reason' }),
      });
      const res = await reversePaymentRoute(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/reports/dues returns dues summary', async () => {
      currentMockSession.role = 'accountant';
      const req = new Request('http://localhost/api/v1/reports/dues');
      const res = await getDuesReportRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.totalStudentsCount).toBeGreaterThanOrEqual(1);
      expect(json.totalOutstandingDuesInr).toBeDefined();
    });
  });

  describe('Receipts API Routes', () => {
    let paymentReceiptId: string;

    beforeEach(async () => {
      currentMockSession.role = 'accountant';
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-receipt-test',
        currentMockSession
      );
      paymentReceiptId = payment.receiptId;
    });

    it('GET /api/v1/receipts/[id] returns receipt snapshot', async () => {
      const req = new Request(`http://localhost/api/v1/receipts/${paymentReceiptId}`);
      const res = await getReceiptRoute(req, { params: { id: paymentReceiptId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.receiptNumber).toBe('RCT-2026-000001');
      expect(json.renderedSnapshot).toBeDefined();
    });

    it('POST /api/v1/receipts/[id]/reprint increments duplicate count', async () => {
      const req = new Request(`http://localhost/api/v1/receipts/${paymentReceiptId}/reprint`, {
        method: 'POST',
      });
      const res = await reprintReceiptRoute(req, { params: { id: paymentReceiptId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.reprintCount).toBe(1);
      expect(json.isDuplicateWatermarkApplied).toBe(true);
    });

    it('GET /api/v1/receipts/[id]/pdf returns binary application/pdf stream', async () => {
      const req = new Request(`http://localhost/api/v1/receipts/${paymentReceiptId}/pdf`);
      const res = await getReceiptPdfRoute(req, { params: { id: paymentReceiptId } });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');

      const arrayBuf = await res.arrayBuffer();
      const text = Buffer.from(arrayBuf).toString('utf-8');
      expect(text.startsWith('%PDF-1.4')).toBe(true);
      expect(text).toContain('RCT-2026-000001');
    });

    it('GET /api/v1/receipts/statement/[id] returns unnumbered statement', async () => {
      const req = new Request(
        `http://localhost/api/v1/receipts/statement/${testStudentAcademicRecordId}`
      );
      const res = await getStatementRoute(req, { params: { id: testStudentAcademicRecordId } });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.studentName).toContain('Ananya Bhat');
      expect((json as any).receiptNumber).toBeUndefined(); // Strictly unnumbered
    });

    it('POST /api/v1/receipts/final returns 422 if balance dues > 0', async () => {
      const req = new Request('http://localhost/api/v1/receipts/final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentAcademicRecordId: testStudentAcademicRecordId }),
      });
      const res = await issueFinalReceiptRoute(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.code).toBe('OUTSTANDING_DUES_EXIST');
    });
  });
});
