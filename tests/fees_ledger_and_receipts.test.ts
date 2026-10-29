import { describe, it, expect, beforeEach } from 'vitest';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { receiptsService } from '../src/modules/receipts/service';
import { admissionsService } from '../src/modules/admissions/service';
import { academicYearsService } from '../src/modules/academic-years/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../src/lib/errors';
import { toDecimalInrString } from '../src/modules/shared/types';
import { amountInWordsInr } from '../src/lib/money/inr';

describe('Phase 5: Fees Ledger, Offline Payments, Adjustments and Receipts (US-21 - US-28)', () => {
  const currentYearId = '00000000-0000-0000-0000-000000000001'; // 2026-2027
  const closedYearId = '00000000-0000-0000-0000-000000000000';  // 2025-2026
  const std1GradeId = '30000000-0000-0000-0000-000000000004';   // STD 1
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: 'auth-principal',
    email: 'principal@school-demo.example',
    fullName: 'Dr. Ramesh Kulkarni (Principal)',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: 'auth-accountant',
    email: 'accounts@school-demo.example',
    fullName: 'Sunil Rao (Accounts Officer)',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: 'auth-adm',
    email: 'admissions@school-demo.example',
    fullName: 'Suma Patil (Admission Officer)',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const sysAdminSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: 'auth-sysadmin',
    email: 'admin@school-demo.example',
    fullName: 'System Operator',
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  let testStudentAcademicRecordId: string;
  let tuitionLineId: string;
  let devLineId: string;
  let examLineId: string;
  let booksLineId: string;
  let admissionFeeHeadId: string;

  beforeEach(async () => {
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    admissionsService.resetForTesting();

    // Setup an admitted student via Admissions workflow
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Rohan',
          lastName: 'Kamat',
          dateOfBirth: '2020-04-10',
          gender: 'male',
          stsNumber: 'STS-2026-099',
          transportMode: 'Private',
          addressLine1: '12 Temple Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Manjunath Kamat',
            relationship: 'Father',
            mobileNumber: '+919988776655',
            email: 'manjunath@example.com',
            residentialAddress: '12 Temple Street, Bengaluru',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Pending birth certificate hardcopy' },
      admissionOfficerSession
    );

    const approval = await admissionsService.approveApplication(
      draft.id,
      { sectionId: sectionAId, remarks: 'Approved for testing' },
      principalSession
    );

    testStudentAcademicRecordId = approval.studentAcademicRecordId;

    // Retrieve assessment lines generated from approved STD1 structure
    const assessment = admissionsService.getFeeAssessmentByRecordId(testStudentAcademicRecordId)!;
    expect(assessment).toBeDefined();

    const heads = await feeConfigurationService.listFeeHeads();
    const tuitionHead = heads.find((h) => h.code === 'TUITION_FEE')!;
    const devHead = heads.find((h) => h.code === 'DEVELOPMENT_FEE')!;
    const examHead = heads.find((h) => h.code === 'EXAM_FEE')!;
    const booksHead = heads.find((h) => h.code === 'BOOKS')!;
    const admHead = heads.find((h) => h.code === 'ADMISSION_FEE')!;

    admissionFeeHeadId = admHead.id;
    tuitionLineId = assessment.lines.find((l) => l.feeHeadId === tuitionHead.id)!.id;
    devLineId = assessment.lines.find((l) => l.feeHeadId === devHead.id)!.id;
    examLineId = assessment.lines.find((l) => l.feeHeadId === examHead.id)!.id;
    booksLineId = assessment.lines.find((l) => l.feeHeadId === booksHead.id)!.id;
  });

  describe('Dues Assessment & Initial Balance (US-23, US-24)', () => {
    it('initializes student fee assessment with zero payment prerequisite (DEC-01 / BR-37)', async () => {
      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );

      expect(dues.totalPaidInr).toBe('0.00');
      // Fixed items: Tuition (14k) + Dev (2k) + Exam (1.2k) + Books (2.5k) = 19,700.00
      expect(dues.totalAssessedInr).toBe('19700.00');
      expect(dues.netBalanceDueInr).toBe('19700.00');
      expect(dues.totalConcessionsInr).toBe('0.00');

      const tuitionLine = dues.lines.find((l) => l.id === tuitionLineId);
      expect(tuitionLine?.assessedAmount).toBe('14000.00');
      expect(tuitionLine?.collectedAmount).toBe('0.00');
      expect(tuitionLine?.netRemainingDues).toBe('14000.00');
    });

    it('denies sensitive demographic access during dues inspection to Accounts Officer (US-03)', async () => {
      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      // Dues summary contains only billing data and student name/admission number, zero Aadhaar or income
      expect((dues as any).aadhaarNumber).toBeUndefined();
      expect((dues as any).caste).toBeUndefined();
      expect((dues as any).annualFamilyIncome).toBeUndefined();
    });
  });

  describe('Offline Payment Recording & Receipt Generation (US-21, US-22, US-27)', () => {
    it('records valid offline payment and assigns monotonic receipt number RCT-YYYY-NNNNNN (6 digits)', async () => {
      const paymentResult = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('15000.00'),
          method: 'cash',
          payerName: 'Manjunath Kamat',
          referenceNumber: undefined,
          remarks: 'Term 1 tuition and development installment',
          allocations: [
            { assessmentLineId: tuitionLineId, amount: toDecimalInrString('13000.00') },
            { assessmentLineId: devLineId, amount: toDecimalInrString('2000.00') },
          ],
        },
        'idemp-test-001',
        accountantSession
      );

      expect(paymentResult.paymentId).toBeDefined();
      expect(paymentResult.receiptId).toBeDefined();
      expect(paymentResult.receiptNumber).toBe('RCT-2026-000001');
      expect(paymentResult.amountInr).toBe('15000.00');
      expect(paymentResult.amountInWords).toBe('Rupees Fifteen Thousand Only');
      expect(paymentResult.category).toBe('school_fee');
      expect(paymentResult.payerName).toBe('Manjunath Kamat');

      // Check rendered snapshot includes mandatory signatories
      const snap = paymentResult.renderedSnapshot as any;
      expect(snap.schoolName).toBe('ABC English Medium School');
      expect(snap.signatories.payerSignatureLine).toBe('Payer Signature');
      expect(snap.signatories.cashierSignatureLine).toBe(accountantSession.fullName);
      expect(snap.signatories.managerSignatureLine).toBe('Manager / Principal');

      // Check updated dues balance
      const updatedDues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(updatedDues.totalPaidInr).toBe('15000.00');
      expect(updatedDues.netBalanceDueInr).toBe('4700.00'); // 19700 - 15000 = 4700

      const tuition = updatedDues.lines.find((l) => l.id === tuitionLineId);
      expect(tuition?.netRemainingDues).toBe('1000.00'); // 14000 - 13000 = 1000

      const dev = updatedDues.lines.find((l) => l.id === devLineId);
      expect(dev?.netRemainingDues).toBe('0.00'); // 2000 - 2000 = 0
    });

    it('enforces committed-number uniqueness and monotonic progression across payments (SBR-07)', async () => {
      const p1 = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent 1',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-seq-1',
        accountantSession
      );

      const p2 = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('2000.00'),
          method: 'cheque',
          payerName: 'Parent 1',
          referenceNumber: 'CHQ-123456',
          allocations: [{ assessmentLineId: devLineId, amount: toDecimalInrString('2000.00') }],
        },
        'idemp-seq-2',
        accountantSession
      );

      expect(p1.receiptNumber).toBe('RCT-2026-000001');
      expect(p2.receiptNumber).toBe('RCT-2026-000002');
      expect(p1.receiptNumber).not.toEqual(p2.receiptNumber);
    });

    it('strictly forbids cross-category allocation lines in a single payment (DEC-10, BR-17)', async () => {
      // Mixing school_fee (tuition) and books in one payment
      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('6000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [
              { assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') },
              { assessmentLineId: booksLineId, amount: toDecimalInrString('1000.00') },
            ],
          },
          'idemp-cross-cat',
          accountantSession
        )
      ).rejects.toThrow(BusinessRuleError);
    });

    it('rejects payment when allocation sum does not equal total amount (ALLOCATION_SUM_MISMATCH)', async () => {
      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('10000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [
              { assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') },
              { assessmentLineId: devLineId, amount: toDecimalInrString('4000.00') }, // sum = 9000 != 10000
            ],
          },
          'idemp-mismatch',
          accountantSession
        )
      ).rejects.toThrow(/ALLOCATION_SUM_MISMATCH/);
    });

    it('strictly prohibits overpayment of fixed fee heads (FIXED_HEAD_OVERPAYMENT_PROHIBITED)', async () => {
      // Tuition remaining balance is 14,000.00. Attempting to allocate 15,000.00
      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('15000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('15000.00') }],
          },
          'idemp-overpay',
          accountantSession
        )
      ).rejects.toThrow(/FIXED_HEAD_OVERPAYMENT_PROHIBITED/);
    });

    it('bills variable fee head dynamically upon payment (amount paid is amount billed, DEC-01)', async () => {
      // Admission Fee is variable: amount paid is amount billed
      const result = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent',
          remarks: 'Variable admission fee installment',
          allocations: [{ assessmentLineId: admissionFeeHeadId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-var-adm',
        accountantSession
      );

      expect(result.amountInr).toBe('5000.00');

      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      // Assessed increased by 5000, paid increased by 5000, net balance remains consistent
      expect(dues.totalPaidInr).toBe('5000.00');
    });

    it('enforces retry idempotency: repeated request with same key returns identical receipt without double payment', async () => {
      const req = {
        studentAcademicRecordId: testStudentAcademicRecordId,
        category: 'school_fee' as const,
        amount: toDecimalInrString('3000.00'),
        method: 'cash' as const,
        payerName: 'Parent Kamat',
        allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('3000.00') }],
      };

      const firstAttempt = await feesLedgerService.recordOfflinePayment(
        req,
        'idemp-key-stable-123',
        accountantSession
      );

      const secondAttempt = await feesLedgerService.recordOfflinePayment(
        req,
        'idemp-key-stable-123',
        accountantSession
      );

      expect(firstAttempt.paymentId).toBe(secondAttempt.paymentId);
      expect(firstAttempt.receiptNumber).toBe(secondAttempt.receiptNumber);

      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.totalPaidInr).toBe('3000.00'); // NOT 6000.00
    });

    it('safely serializes concurrent payments on the same student record without race collisions', async () => {
      const p1Promise = feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('2000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('2000.00') }],
        },
        'idemp-conc-1',
        accountantSession
      );

      const p2Promise = feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('1000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: devLineId, amount: toDecimalInrString('1000.00') }],
        },
        'idemp-conc-2',
        accountantSession
      );

      const [res1, res2] = await Promise.all([p1Promise, p2Promise]);

      expect(res1.receiptNumber).not.toEqual(res2.receiptNumber);

      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.totalPaidInr).toBe('3000.00');
    });

    it('blocks payment recording in a closed academic year (SBR-05 / BR-39)', async () => {
      // Modify student academic record to closed year temporarily
      const record = admissionsService.getAcademicRecord(testStudentAcademicRecordId)!;
      const originalYear = record.academicYearId;
      (record as any).academicYearId = closedYearId;

      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('1000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('1000.00') }],
          },
          'idemp-closed-yr',
          accountantSession
        )
      ).rejects.toThrow(BusinessRuleError);

      (record as any).academicYearId = originalYear;
    });

    it('denies Admission Officer and SysAdmin from recording payments (AUTHORIZATION_MATRIX.md)', async () => {
      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('1000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('1000.00') }],
          },
          'idemp-adm-block',
          admissionOfficerSession
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('1000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('1000.00') }],
          },
          'idemp-sys-block',
          sysAdminSession
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Financial Adjustments & Concessions (US-26, BR-21, BR-40)', () => {
    it('allows Accounts Officer to request concession and requires Principal approval', async () => {
      const adjRequest = await feesLedgerService.requestFeeAdjustment(
        {
          studentFeeAssessmentLineId: tuitionLineId,
          adjustmentType: 'concession',
          amount: toDecimalInrString('2000.00'),
          reason: 'Sibling concession for younger brother enrolled in Nursery',
        },
        accountantSession
      );

      expect(adjRequest.status).toBe('pending');
      expect(adjRequest.approvedBy).toBeNull();

      // Accounts Officer cannot approve concession
      await expect(
        feesLedgerService.approveFeeAdjustment(
          adjRequest.id,
          { approvalNotes: 'Attempting self-approval' },
          accountantSession
        )
      ).rejects.toThrow(AuthorizationError);

      // Principal approves concession
      const approved = await feesLedgerService.approveFeeAdjustment(
        adjRequest.id,
        { approvalNotes: 'Verified sibling admission record' },
        principalSession
      );

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(principalSession.staffId);

      // Remaining dues reflect concession
      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.totalConcessionsInr).toBe('2000.00');
      const tuition = dues.lines.find((l) => l.id === tuitionLineId);
      expect(tuition?.approvedConcessionsAmount).toBe('2000.00');
      expect(tuition?.netRemainingDues).toBe('12000.00'); // 14k - 2k
    });

    it('rejects concession request with reason shorter than 5 characters', async () => {
      await expect(
        feesLedgerService.requestFeeAdjustment(
          {
            studentFeeAssessmentLineId: tuitionLineId,
            adjustmentType: 'concession',
            amount: toDecimalInrString('1000.00'),
            reason: 'Poor', // < 5 chars
          },
          accountantSession
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Payment Reversals & Ledger Immutability (US-26A, BR-22, SBR-04)', () => {
    it('allows Principal to reverse a payment, preserves original immutable ledger row, and restores dues', async () => {
      // 1. Post original payment of 5000.00
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-rev-1',
        accountantSession
      );

      // Tuition remaining was 9,000.00
      let dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.totalPaidInr).toBe('5000.00');
      expect(dues.lines.find((l) => l.id === tuitionLineId)?.netRemainingDues).toBe('9000.00');

      // 2. Non-Principal cannot reverse payment
      await expect(
        feesLedgerService.reversePayment(
          payment.paymentId,
          { reason: 'Cashier entry mistake authorized by school' },
          'idemp-rev-fail',
          accountantSession
        )
      ).rejects.toThrow(AuthorizationError);

      // 3. Principal reverses payment
      const reversalResult = await feesLedgerService.reversePayment(
        payment.paymentId,
        { reason: 'Cashier entry error under wrong student account. Authorized by Principal.' },
        'idemp-rev-success',
        principalSession
      );

      expect(reversalResult.originalPaymentId).toBe(payment.paymentId);
      expect(reversalResult.reversalPaymentId).toBeDefined();
      expect(reversalResult.reversalAmountInr).toBe('5000.00');
      expect(reversalResult.reversedBy).toBe(principalSession.staffId);

      // 4. Verify original payment is completely intact (immutable)
      const orig = feesLedgerService.getPaymentById(payment.paymentId);
      expect(orig).toBeDefined();
      expect(orig?.transactionType).toBe('collection');
      expect(orig?.amount).toBe('5000.00');

      // 5. Verify dues are restored
      dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.totalPaidInr).toBe('0.00'); // 5000 collected - 5000 reversed = 0
      expect(dues.lines.find((l) => l.id === tuitionLineId)?.netRemainingDues).toBe('14000.00');

      // 6. Attempting to reverse the same payment a second time is strictly rejected
      await expect(
        feesLedgerService.reversePayment(
          payment.paymentId,
          { reason: 'Attempting duplicate reversal' },
          'idemp-rev-dup',
          principalSession
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Receipt Formats, Reprints, Statements & Final Receipt (US-27, US-28, SBR-08)', () => {
    it('generates unnumbered Statement of Account available at any time', async () => {
      const statement = await receiptsService.getStatementOfAccount(
        testStudentAcademicRecordId,
        accountantSession
      );

      expect(statement.studentName).toContain('Rohan Kamat');
      expect(statement.totalAssessedInr).toBe('19700.00');
      expect(statement.netOutstandingDuesInr).toBe('19700.00');
      expect(statement.assessments.length).toBeGreaterThan(0);
      // Strictly unnumbered
      expect((statement as any).receiptNumber).toBeUndefined();
    });

    it('rejects issuance of Final Fees Receipt while outstanding balance exists (SBR-08)', async () => {
      // Balance is 19,700.00 > 0
      await expect(
        receiptsService.issueFinalFeesReceipt(
          { studentAcademicRecordId: testStudentAcademicRecordId },
          accountantSession
        )
      ).rejects.toThrow(/OUTSTANDING_DUES_EXIST/);
    });

    it('issues numbered Final Fees Receipt strictly when net dues equal ₹0.00, itemizing prior receipts', async () => {
      // Pay all dues in full
      // 1. School fee payment
      await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('17200.00'),
          method: 'bank_transfer',
          payerName: 'Manjunath Kamat',
          referenceNumber: 'NEFT-889900',
          allocations: [
            { assessmentLineId: tuitionLineId, amount: toDecimalInrString('14000.00') },
            { assessmentLineId: devLineId, amount: toDecimalInrString('2000.00') },
            { assessmentLineId: examLineId, amount: toDecimalInrString('1200.00') },
          ],
        },
        'idemp-final-p1',
        accountantSession
      );

      // 2. Books fee payment
      await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'books',
          amount: toDecimalInrString('2500.00'),
          method: 'cash',
          payerName: 'Manjunath Kamat',
          allocations: [{ assessmentLineId: booksLineId, amount: toDecimalInrString('2500.00') }],
        },
        'idemp-final-p2',
        accountantSession
      );

      // Net balance is now 0.00
      const dues = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accountantSession
      );
      expect(dues.netBalanceDueInr).toBe('0.00');

      // Issue Final Fees Receipt
      const finalReceipt = await receiptsService.issueFinalFeesReceipt(
        { studentAcademicRecordId: testStudentAcademicRecordId },
        accountantSession
      );

      expect(finalReceipt.receiptNumber).toBe('RCT-2026-000003');
      expect(finalReceipt.totalAmountInr).toBe('19700.00');
      expect(finalReceipt.totalAmountInWords).toBe('Rupees Nineteen Thousand Seven Hundred Only');
      expect(finalReceipt.itemizedPriorReceipts.length).toBe(2);
      expect(finalReceipt.itemizedPriorReceipts[0].receiptNumber).toBe('RCT-2026-000001');
      expect(finalReceipt.itemizedPriorReceipts[1].receiptNumber).toBe('RCT-2026-000002');
    });

    it('handles duplicate receipt reprint workflow and logs duplicate count', async () => {
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Parent',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-reprint-1',
        accountantSession
      );

      const reprint1 = await receiptsService.reprintReceipt(payment.receiptId, accountantSession);
      expect(reprint1.reprintCount).toBe(1);
      expect(reprint1.isDuplicateWatermarkApplied).toBe(true);
      expect(reprint1.pdfDownloadUrl).toContain(`/api/v1/receipts/${payment.receiptId}/pdf`);

      const reprint2 = await receiptsService.reprintReceipt(payment.receiptId, accountantSession);
      expect(reprint2.reprintCount).toBe(2);
    });

    it('renders valid PDF-1.4 binary buffer with header, allocations, Indian words, and 3 signature blocks', async () => {
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('15000.00'),
          method: 'cash',
          payerName: 'Manjunath Kamat',
          allocations: [
            { assessmentLineId: tuitionLineId, amount: toDecimalInrString('13000.00') },
            { assessmentLineId: devLineId, amount: toDecimalInrString('2000.00') },
          ],
        },
        'idemp-pdf-1',
        accountantSession
      );

      const pdfBuffer = await receiptsService.getReceiptPdfBuffer(payment.receiptId, false);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);

      const pdfText = pdfBuffer.toString('utf-8');
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText.includes('%%EOF')).toBe(true);

      // Verify essential receipt contents inside PDF stream
      expect(pdfText).toContain('ABC ENGLISH MEDIUM SCHOOL');
      expect(pdfText).toContain('RCT-2026-000001');
      expect(pdfText).toContain('Rohan Kamat');
      expect(pdfText).toContain('Tuition Fee');
      expect(pdfText).toContain('Development Fee');
      expect(pdfText).toContain('15000.00');
      expect(pdfText).toContain('Rupees Fifteen Thousand Only');

      // Verify three official signature blocks
      expect(pdfText).toContain('Payer Signature');
      expect(pdfText).toContain('Cashier / Accounts Officer');
      expect(pdfText).toContain('Manager / Principal');

      // Test reprint duplicate watermark
      const duplicatePdfBuffer = await receiptsService.getReceiptPdfBuffer(payment.receiptId, true);
      const duplicateText = duplicatePdfBuffer.toString('utf-8');
      expect(duplicateText).toContain('DUPLICATE COPY');
    });
  });

  describe('Indian Currency to Words Formatting (DEC-11, lakh/crore)', () => {
    it('formats amounts correctly into Indian numbering words', () => {
      expect(amountInWordsInr('15000.00')).toBe('Rupees Fifteen Thousand Only');
      expect(amountInWordsInr('125000.00')).toBe('Rupees One Lakh Twenty Five Thousand Only');
      expect(amountInWordsInr('10000000.00')).toBe('Rupees One Crore Only');
      expect(amountInWordsInr('42500.50')).toBe(
        'Rupees Forty Two Thousand Five Hundred and Fifty Paise Only'
      );
      expect(amountInWordsInr('0.00')).toBe('Rupees Zero Only');
    });
  });
});
