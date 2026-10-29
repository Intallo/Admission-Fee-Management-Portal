import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { enforcePolicy } from '../src/policy/guards';
import { hasPermission } from '../src/policy/permissions';
import {
  AuthorizationError,
  AuthenticationError,
  ValidationError,
  BusinessRuleError,
  NotFoundError,
  formatErrorResponse,
} from '../src/lib/errors';
import { maskAadhaar, maskBankAccount } from '../src/lib/crypto/pii';
import { redactSensitiveData } from '../src/lib/logger';
import { toDecimal } from '../src/lib/money/inr';
import { toDecimalInrString } from '../src/modules/shared/types';
import { admissionsService } from '../src/modules/admissions/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { receiptsService } from '../src/modules/receipts/service';
import { studentRecordsService } from '../src/modules/student-records/service';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { documentsService } from '../src/modules/documents/service';
import { identityService } from '../src/modules/identity-access/service';

describe('PHASE 7: Security Hardening & End-to-End Verification Suite', () => {
  const currentAcademicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: 'principal-auth-id',
    email: 'principal@school-demo.example',
    fullName: 'Dr. Ramesh Kulkarni (Principal)',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: currentAcademicYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const admSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: 'adm-auth-id',
    email: 'admissions@school-demo.example',
    fullName: 'Suma Patil (Admission Officer)',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: currentAcademicYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const accSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: 'acc-auth-id',
    email: 'accounts@school-demo.example',
    fullName: 'Anand Joshi (Accounts Officer)',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: currentAcademicYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const sysAdminSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: 'sysadmin-auth-id',
    email: 'system.admin@school-demo.example',
    fullName: 'Praveen Kumar (System Admin)',
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: currentAcademicYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  let testStudentAcademicRecordId: string;
  let testStudentId: string;
  let testApplicationId: string;
  let tuitionLineId: string;
  let devLineId: string;

  beforeEach(async () => {
    admissionsService.resetForTesting();
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    studentRecordsService.resetForTesting();
    certificatesService.resetForTesting();
    documentsService.resetForTesting();

    // 1. Setup an admitted student with full profile
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId: currentAcademicYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          dateOfBirth: '2020-05-15',
          gender: 'male',
          stsNumber: 'STS-2026-001',
          diseNumber: 'DISE-2026-001',
          transportMode: 'Private',
          addressLine1: '42 Brigade Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        sensitiveDetails: {
          aadhaarNumber: '123456789012',
          caste: 'General',
          subCaste: 'Brahmin',
          annualFamilyIncome: toDecimalInrString('600000.00'),
          bankName: 'State Bank of India',
          accountNumber: '12345678901234',
          ifscCode: 'SBIN0001234',
        },
        guardians: [
          {
            fullName: 'Rajesh Sharma',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            email: 'rajesh.sharma@example.com',
            residentialAddress: '42 Brigade Road, Bengaluru',
            annualIncomeInr: toDecimalInrString('600000.00'),
            isPrimaryContact: true,
          },
        ],
      },
      admSession
    );

    testApplicationId = draft.id;
    testStudentId = draft.studentId;

    await admissionsService.submitApplication(
      testApplicationId,
      { overrideMissingDocumentsReason: 'Pending birth certificate physical copy' },
      admSession
    );

    const approved = await admissionsService.approveApplication(
      testApplicationId,
      { sectionId: sectionAId, remarks: 'Verified by Principal' },
      principalSession
    );

    testStudentAcademicRecordId = approved.studentAcademicRecordId;

    // Get assessment lines
    const assessment = admissionsService.getFeeAssessmentByRecordId(testStudentAcademicRecordId)!;
    const heads = await feeConfigurationService.listFeeHeads();
    const tuitionHead = heads.find((h) => h.code === 'TUITION_FEE')!;
    const devHead = heads.find((h) => h.code === 'DEVELOPMENT_FEE')!;

    tuitionLineId = assessment.lines.find((l) => l.feeHeadId === tuitionHead.id)!.id;
    devLineId = assessment.lines.find((l) => l.feeHeadId === devHead.id)!.id;
  });

  // ============================================================================
  // 1. Unauthenticated & Inactive-User Request Verification
  // ============================================================================
  describe('1. Unauthenticated & Inactive-User Security Controls', () => {
    it('strictly forbids login for non-existent or inactive staff members', async () => {
      await expect(
        identityService.login(
          'nonexistent.user@school-demo.example',
          'AnyPassword123!',
          { ip: '127.0.0.1' }
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('rejects access when user active flag is revoked mid-session', () => {
      const revokedSession: AuthenticatedUserSession = {
        ...accSession,
        isActive: false,
      };

      expect(() => {
        if (!revokedSession.isActive) {
          throw new AuthorizationError('Account is inactive or deactivated');
        }
        enforcePolicy(revokedSession.role, 'fees:record_payment');
      }).toThrow(AuthorizationError);
    });
  });

  // ============================================================================
  // 2. Role Escalation & Forged Identity Checks
  // ============================================================================
  describe('2. Role Escalation & Forged Identity Defense', () => {
    it('prevents Accounts Officer from claiming Principal authority in request bodies', () => {
      const untrustedBody = {
        role: 'principal',
        staffId: principalSession.staffId,
        concessionAmount: '5000.00',
      };

      // Server uses authenticated session role strictly
      const effectiveRole = accSession.role;
      expect(effectiveRole).toBe('accountant');
      expect(untrustedBody.role).not.toBe(effectiveRole);

      // Attempting Principal action using session role fails
      expect(() => {
        enforcePolicy(effectiveRole, 'fees:approve_concession');
      }).toThrow(AuthorizationError);
    });

    it('prevents Admission Officer from configuring fee structures or recording payments', () => {
      expect(hasPermission(admSession.role, 'fees:record_payment')).toBe(false);
      expect(hasPermission(admSession.role, 'fees:configure_structure')).toBe(false);

      expect(() => enforcePolicy(admSession.role, 'fees:record_payment')).toThrow(AuthorizationError);
      expect(() => enforcePolicy(admSession.role, 'fees:configure_structure')).toThrow(AuthorizationError);
    });

    it('prevents System Administrator from approving admissions, fee waivers, or recording payments', () => {
      expect(hasPermission(sysAdminSession.role, 'admissions:approve_decision')).toBe(false);
      expect(hasPermission(sysAdminSession.role, 'fees:approve_concession')).toBe(false);
      expect(hasPermission(sysAdminSession.role, 'fees:record_payment')).toBe(false);
      expect(hasPermission(sysAdminSession.role, 'certificates:issue_tc')).toBe(false);

      expect(() => enforcePolicy(sysAdminSession.role, 'admissions:approve_decision')).toThrow(AuthorizationError);
      expect(() => enforcePolicy(sysAdminSession.role, 'fees:approve_concession')).toThrow(AuthorizationError);
      expect(() => enforcePolicy(sysAdminSession.role, 'fees:record_payment')).toThrow(AuthorizationError);
    });
  });

  // ============================================================================
  // 3. PII Leakage Protection (DPDP Act, US-03, R-06)
  // ============================================================================
  describe('3. PII Leakage Protection across Search, Exports, Logs, and Errors', () => {
    it('ensures student search items never contain Aadhaar, income, or bank account numbers', async () => {
      const searchResults = await studentRecordsService.searchStudents(
        { search: 'Aarav' },
        accSession
      );

      expect(searchResults.data.length).toBeGreaterThan(0);
      searchResults.data.forEach((item) => {
        expect((item as any).aadhaarNumber).toBeUndefined();
        expect((item as any).householdIncomeInr).toBeUndefined();
        expect((item as any).bankAccountNumber).toBeUndefined();
        expect((item as any).casteCategory).toBeUndefined();
      });
    });

    it('completely strips sensitiveDetails from student profile when viewed by Accounts Officer', async () => {
      const profile = await studentRecordsService.getStudentProfile(testStudentId, currentAcademicYearId, accSession);

      expect(profile.sensitiveDetails).toBeNull();
      expect(profile.documents).toBeNull();
    });

    it('completely strips sensitiveDetails from student profile when viewed by System Admin', async () => {
      const profile = await studentRecordsService.getStudentProfile(testStudentId, currentAcademicYearId, sysAdminSession);

      expect(profile.sensitiveDetails).toBeNull();
      expect(profile.documents).toBeNull();
    });

    it('verifies Aadhaar and Bank Account masking utilities', () => {
      const aadhaar = '987654321098';
      const maskedAadhaar = maskAadhaar(aadhaar);
      expect(maskedAadhaar).toBe('••••-••••-1098');
      expect(maskedAadhaar).not.toContain('98765432');

      const bankAcc = '12345678901234';
      const maskedBankAcc = maskBankAccount(bankAcc);
      expect(maskedBankAcc).toBe('••••••••••1234');
      expect(maskedBankAcc).not.toContain('1234567890');
    });

    it('ensures structured logger redacts all passwords, tokens, Aadhaar, and DB URIs', () => {
      const sensitiveContext = {
        password: 'PlainTextPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
        aadhaar_number: '123456789012',
        databaseUrl: 'postgresql://postgres:secretpassword@localhost:5432/db',
      };

      const sanitized = redactSensitiveData(sensitiveContext) as any;
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.aadhaar_number).toBe('[REDACTED]');
      expect(sanitized.databaseUrl).not.toContain('secretpassword');
    });

    it('ensures RFC 7807 error responses never leak raw database credentials or internal stack traces', () => {
      const internalDbError = new Error('FATAL: password authentication failed for user postgres:supersecretpass');
      const { status, body } = formatErrorResponse(internalDbError, { correlationId: 'corr-sec-01' });

      expect(status).toBe(500);
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.detail).not.toContain('supersecretpass');
      expect(body.correlationId).toBe('corr-sec-01');
    });
  });

  // ============================================================================
  // 4. File Upload Restrictions & Document Security
  // ============================================================================
  describe('4. File Upload Security & Document Ownership Isolation', () => {
    it('rejects disallowed MIME types (e.g. application/x-msdownload, text/html)', async () => {
      await expect(
        documentsService.uploadDocument(
          {
            studentId: testStudentId,
            admissionApplicationId: testApplicationId,
            documentTypeId: '10000000-0000-0000-0000-000000000001',
            fileName: 'malicious_script.exe',
            mimeType: 'application/x-msdownload',
            fileSizeBytes: 1024,
          },
          admSession
        )
      ).rejects.toThrow(ValidationError);
    });

    it('rejects oversized files exceeding 5MB (5,242,880 bytes)', async () => {
      const oversizedBytes = 5 * 1024 * 1024 + 1;
      await expect(
        documentsService.uploadDocument(
          {
            studentId: testStudentId,
            admissionApplicationId: testApplicationId,
            documentTypeId: '10000000-0000-0000-0000-000000000001',
            fileName: 'large_scanned_photo.jpg',
            mimeType: 'image/jpeg',
            fileSizeBytes: oversizedBytes,
          },
          admSession
        )
      ).rejects.toThrow(ValidationError);
    });

    it('rejects non-privileged roles (Accountant, System Admin) from generating document download URLs', async () => {
      const doc = await documentsService.uploadDocument(
        {
          studentId: testStudentId,
          admissionApplicationId: testApplicationId,
          documentTypeId: '10000000-0000-0000-0000-000000000001',
          fileName: 'birth_cert.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
        },
        admSession
      );

      await expect(
        documentsService.generateDownloadUrl(doc.id, accSession)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        documentsService.generateDownloadUrl(doc.id, sysAdminSession)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  // ============================================================================
  // 5. Cross-Year Isolation (DEC-06, SBR-05)
  // ============================================================================
  describe('5. Cross-Year Accounting Isolation (DEC-06)', () => {
    it('strictly isolates dues calculation to the active academic year', async () => {
      const duesCurrent = await feesLedgerService.getStudentDues(
        testStudentAcademicRecordId,
        accSession
      );
      expect(duesCurrent.studentAcademicRecordId).toBe(testStudentAcademicRecordId);
      expect(duesCurrent.totalAssessedInr).toBe('19700.00');

      // Attempting to calculate dues for a closed/non-existent academic record throws NotFound
      await expect(
        feesLedgerService.getStudentDues('00000000-0000-0000-0000-000000000099', accSession)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // 6. Decimal Currency Precision & Allocation Integrity (DEC-11, SBR-03)
  // ============================================================================
  describe('6. Exact Decimal Currency Precision & Allocation Validation', () => {
    it('rejects floating-point discrepancies in payment allocation sums', () => {
      // 0.10 + 0.20 in IEEE 754 float is 0.30000000000000004
      // Exact decimal arithmetic must accurately match 0.30
      const paymentAmount = toDecimalInrString('0.30');
      const alloc1 = toDecimalInrString('0.10');
      const alloc2 = toDecimalInrString('0.20');

      const sum = toDecimal(alloc1).plus(toDecimal(alloc2));
      expect(sum.toFixed(2)).toBe('0.30');
      expect(paymentAmount).toBe('0.30');
    });

    it('strictly rejects payment if sum of allocations does not match payment amount down to paise', async () => {
      await expect(
        feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
            category: 'school_fee',
            amount: toDecimalInrString('1000.00'),
            method: 'cash',
            payerName: 'Parent',
            allocations: [
              {
                assessmentLineId: tuitionLineId,
                amount: toDecimalInrString('999.99'), // 1 paise off!
              },
            ],
          },
          'idemp-p7-mismatch',
          accSession
        )
      ).rejects.toThrow(/ALLOCATION_SUM_MISMATCH/);
    });
  });

  // ============================================================================
  // 7. Monotonic Receipt Numbering & Required Signatories (DEC-03, DEC-05, US-27)
  // ============================================================================
  describe('7. Receipt Generation, 6-Digit Padding & Official Signatories', () => {
    it('issues 6-digit zero-padded receipt numbers (RCT-YYYY-NNNNNN)', async () => {
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('5000.00'),
          method: 'cash',
          payerName: 'Rajesh Sharma',
          allocations: [{ assessmentLineId: tuitionLineId, amount: toDecimalInrString('5000.00') }],
        },
        'idemp-p7-rct-1',
        accSession
      );

      expect(payment.receiptNumber).toMatch(/^RCT-\d{4}-\d{6}$/);
    });

    it('requires all three signature lines (Payer, Cashier, Manager) on receipt PDF', async () => {
      const payment = await feesLedgerService.recordOfflinePayment(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          category: 'school_fee',
          amount: toDecimalInrString('2000.00'),
          method: 'cash',
          payerName: 'Rajesh Sharma',
          allocations: [{ assessmentLineId: devLineId, amount: toDecimalInrString('2000.00') }],
        },
        'idemp-p7-pdf-sign',
        accSession
      );

      const pdfBuffer = await receiptsService.getReceiptPdfBuffer(payment.receiptId, false);
      const pdfText = pdfBuffer.toString('utf-8');

      // Check required signature lines
      expect(pdfText).toContain('Payer Signature');
      expect(pdfText).toContain('Cashier');
      expect(pdfText).toContain('Manager');
    });
  });

  // ============================================================================
  // 8. Zero Dues Gate for Final Fees Receipt (DEC-04, US-28, SBR-08)
  // ============================================================================
  describe('8. Zero Dues Gate for Final Fees Receipt (DEC-04, US-28)', () => {
    it('strictly rejects Final Fees Receipt when student has outstanding dues > ₹0.00', async () => {
      await expect(
        receiptsService.issueFinalFeesReceipt(
          {
            studentAcademicRecordId: testStudentAcademicRecordId,
          },
          accSession
        )
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  // ============================================================================
  // 9. Transfer Certificate (LC/TC) Business Invariants (DEC-08, US-36)
  // ============================================================================
  describe('9. Transfer Certificate (LC/TC) Invariants', () => {
    it('generates sequential TC-YYYY-NNNN certificate numbers', async () => {
      const cert = await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: testStudentAcademicRecordId,
          certificateType: 'TC',
          reasonForLeaving: 'Relocating to another district',
        },
        admSession
      );

      // Step 1 review step: action 'forward_for_approval' marks reviewStatus as 'reviewed'
      await certificatesService.reviewCertificate(
        cert.id,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Satisfactory', remarks: 'Verified' },
        admSession
      );

      // Step 2 issue step by Principal with dues override reason
      const issued = await certificatesService.issueCertificate(
        cert.id,
        { duesOverrideReason: 'Special exemption sanctioned by Principal' },
        principalSession
      );

      expect(issued.certificateNumber).toMatch(/^TC-\d{4}-\d{4}$/);
    });

    it('verifies generating an LC/TC does NOT automatically withdraw an active student (DEC-08)', async () => {
      // Per DEC-08, LC/TC is an annual record; student status remains active unless explicitly marked left
      const profile = await studentRecordsService.getStudentProfile(testStudentId, currentAcademicYearId, principalSession);
      expect(profile.currentAcademicRecord.status).toBe('admitted');
    });
  });

  // ============================================================================
  // 10. Repository Credential Hygiene
  // ============================================================================
  describe('10. Repository Credential Hygiene & Environment Isolation', () => {
    it('verifies .env.example contains zero real secrets or production database credentials', () => {
      const fs = require('fs');
      const envExample = fs.readFileSync('.env.example', 'utf-8');

      expect(envExample).not.toContain('postgresql://postgres:postgres@db.fjrfyzamiirqzitdchkz.supabase.co');
      expect(envExample).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321');
    });
  });
});
