import { describe, it, expect, beforeEach } from 'vitest';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { studentRecordsService } from '../src/modules/student-records/service';
import { admissionsService } from '../src/modules/admissions/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { receiptsService } from '../src/modules/receipts/service';
import { auditReportingService } from '../src/modules/audit-reporting/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../src/lib/errors';
import { toDecimalInrString } from '../src/modules/shared/types';
import { addInr, compareInr } from '../src/lib/money/inr';

describe('Phase 6: Leaving & Transfer Certificates (LC/TC) (US-34 - US-37)', () => {
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

  let studentRecord1Id: string;
  let studentRecord2Id: string;

  beforeEach(async () => {
    admissionsService.resetForTesting();
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    certificatesService.resetForTesting();
    studentRecordsService.resetForTesting();
    auditReportingService.resetForTesting();

    // Configure fee heads & approved structure for dues verification
    const tuitionHead = await feeConfigurationService.createFeeHead(
      { code: 'TUITION', name: 'Tuition Fee', category: 'school_fee', isVariable: false },
      accountantSession
    );
    const struct = await feeConfigurationService.createFeeStructure(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('30000.00') }],
      },
      accountantSession
    );
    await feeConfigurationService.approveFeeStructure(struct.id, principalSession);

    // Admitted Student 1 (Aarav Sharma - has pending dues of ₹30,000)
    const draft1 = await admissionsService.createDraftApplication(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          dateOfBirth: '2020-05-15',
          gender: 'male',
          stsNumber: 'STS-2026-001',
          transportMode: 'Private',
        },
        guardians: [
          {
            fullName: 'Vikram Sharma',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(
      draft1.id,
      { overrideMissingDocumentsReason: 'Pending verification' },
      admissionOfficerSession
    );
    const adm1 = await admissionsService.approveApplication(draft1.id, { sectionId: sectionAId }, principalSession);
    studentRecord1Id = adm1.studentAcademicRecordId;

    // Admitted Student 2 (Priya Patel - pays full dues of ₹30,000)
    const draft2 = await admissionsService.createDraftApplication(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Priya',
          lastName: 'Patel',
          dateOfBirth: '2020-08-20',
          gender: 'female',
          stsNumber: 'STS-2026-002',
          transportMode: 'Private',
        },
        guardians: [
          {
            fullName: 'Bhavin Patel',
            relationship: 'Father',
            mobileNumber: '+919776655443',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );
    await admissionsService.submitApplication(
      draft2.id,
      { overrideMissingDocumentsReason: 'Pending verification' },
      admissionOfficerSession
    );
    const adm2 = await admissionsService.approveApplication(draft2.id, { sectionId: sectionAId }, principalSession);
    studentRecord2Id = adm2.studentAcademicRecordId;

    // Clear dues for Student 2
    const dues2 = await feesLedgerService.getStudentDues(studentRecord2Id, accountantSession);
    const linesByCategory = new Map<string, typeof dues2.lines>();
    for (const line of dues2.lines) {
      const cat = line.category;
      if (!linesByCategory.has(cat)) linesByCategory.set(cat, []);
      linesByCategory.get(cat)!.push(line);
    }

    for (const [cat, lines] of linesByCategory.entries()) {
      const categoryTotal = lines.reduce(
        (sum, l) => addInr(sum, l.netRemainingDues),
        toDecimalInrString('0.00')
      );
      if (compareInr(categoryTotal, '0.00') > 0) {
        await feesLedgerService.recordOfflinePayment(
          {
            studentAcademicRecordId: studentRecord2Id,
            category: cat as any,
            amount: categoryTotal,
            method: 'bank_transfer',
            payerName: 'Bhavin Patel',
            allocations: lines.map((l) => ({
              assessmentLineId: l.id,
              amount: l.netRemainingDues,
            })),
          },
          undefined,
          accountantSession
        );
      }
    }
  });

  describe('Certificate Record Creation & Year Scoping (US-34)', () => {
    it('creates certificate record for single student with reason and date (US-34 AC2)', async () => {
      const cert = await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord1Id,
          certificateType: 'TC',
          reasonForLeaving: 'Parent transferred to Belagavi office',
          dateOfLeaving: '2026-10-29',
        },
        admissionOfficerSession
      );

      expect(cert.id).toBeDefined();
      expect(cert.status).toBe('draft');
      expect(cert.reviewStatus).toBe('pending');
      expect(cert.certificateNumber).toBeNull();
      expect(cert.studentName).toBe('Aarav Sharma');
      expect(cert.academicYearLabel).toBe('2026-2027');
    });

    it('enforces one certificate per academic year per student constraint (US-34 AC4)', async () => {
      await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord1Id,
          reasonForLeaving: 'Initial request',
        },
        admissionOfficerSession
      );

      // Duplicate request for same student and year must be rejected
      await expect(
        certificatesService.requestCertificate(
          {
            studentAcademicRecordId: studentRecord1Id,
            reasonForLeaving: 'Duplicate request',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow(ConflictError);
    });

    it('pre-populates certificate draft records for all admitted students of the year including Left students (US-34 AC1)', async () => {
      // Mark Student 2 as Transferred
      await studentRecordsService.markStudentStatus(
        studentRecord2Id,
        {
          academicRecordId: studentRecord2Id,
          newStatus: 'transferred',
          exitDate: '2026-10-15',
          exitReason: 'Moved out of state',
        },
        principalSession
      );

      // Pre-populate for year
      const prepopRes = await certificatesService.prepopulateYearCertificates(
        currentYearId,
        admissionOfficerSession
      );

      expect(prepopRes.createdCount).toBe(2);

      const list = await certificatesService.listCertificates(
        { academicYearId: currentYearId },
        admissionOfficerSession
      );
      expect(list.total).toBe(2);

      // Student 2 (transferred) is included
      const cert2 = list.data.find((c) => c.studentAcademicRecordId === studentRecord2Id);
      expect(cert2).toBeDefined();
      expect(cert2?.studentName).toBe('Priya Patel');
    });

    it('displays the student current unpaid balance on the certificate record (US-34 AC5)', async () => {
      await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord1Id,
          reasonForLeaving: 'Transfer',
        },
        admissionOfficerSession
      );

      const list = await certificatesService.listCertificates(
        { academicYearId: currentYearId },
        admissionOfficerSession
      );

      const cert1 = list.data.find((c) => c.studentAcademicRecordId === studentRecord1Id);
      expect(cert1).toBeDefined();
      const dues1 = await feesLedgerService.getStudentDuesInternal(studentRecord1Id);
      expect(cert1?.unpaidBalanceInr).toBe(dues1.netBalanceDueInr);
    });
  });

  describe('Two-Step Review and Approval Workflow (US-35, US-36)', () => {
    let draftCertId: string;

    beforeEach(async () => {
      const cert = await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord1Id,
          certificateType: 'TC',
          reasonForLeaving: 'Transferring to another school',
          dateOfLeaving: '2026-10-29',
        },
        admissionOfficerSession
      );
      draftCertId = cert.id;
    });

    it('enforces review order: Principal cannot issue before Step 1 Admission Officer review (US-35 AC1, AC2)', async () => {
      // Principal attempts to issue draft certificate that has not been reviewed yet
      await expect(
        certificatesService.issueCertificate(
          draftCertId,
          { duesOverrideReason: 'Override' },
          principalSession
        )
      ).rejects.toThrow(/must complete Step 1/);
    });

    it('Step 1 Review: allows Admission Officer to review and forward (US-35 AC1)', async () => {
      const reviewed = await certificatesService.reviewCertificate(
        draftCertId,
        {
          action: 'forward_for_approval',
          conduct: 'Exemplary',
          progress: 'Excellent',
          remarks: 'All documents verified and conduct is exemplary',
        },
        admissionOfficerSession
      );

      expect(reviewed.status).toBe('draft');
      expect(reviewed.reviewStatus).toBe('reviewed');
      expect(reviewed.reviewedBy).toBe(admissionOfficerSession.staffId);
      expect(reviewed.reviewedByName).toBe(admissionOfficerSession.fullName);
      expect(reviewed.conduct).toBe('Exemplary');
      expect(reviewed.reviewRemarks).toContain('verified');
    });

    it('denies non-Admission-Officer from performing Step 1 review', async () => {
      await expect(
        certificatesService.reviewCertificate(
          draftCertId,
          { action: 'forward_for_approval', conduct: 'Good', progress: 'Fair' },
          principalSession // Principal is not Step 1 reviewer
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        certificatesService.reviewCertificate(
          draftCertId,
          { action: 'forward_for_approval', conduct: 'Good', progress: 'Fair' },
          accountantSession
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('denies non-Principal from performing Step 2 issuance (US-35 AC2)', async () => {
      // Step 1 review
      await certificatesService.reviewCertificate(
        draftCertId,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Fair' },
        admissionOfficerSession
      );

      // Admission officer attempts to approve/issue (Step 2)
      await expect(
        certificatesService.issueCertificate(
          draftCertId,
          { duesOverrideReason: 'Override' },
          admissionOfficerSession
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('enforces Dues Warning & Mandatory Override: blocks issuance when dues pending without override (US-35 AC3, REG-03)', async () => {
      // Step 1 review
      await certificatesService.reviewCertificate(
        draftCertId,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Satisfactory' },
        admissionOfficerSession
      );

      // Student 1 has ₹30,000 pending dues! Principal attempts to issue without duesOverrideReason
      await expect(
        certificatesService.issueCertificate(
          draftCertId,
          { duesOverrideReason: '' },
          principalSession
        )
      ).rejects.toThrow(/Student has pending fee dues of ₹\d+(\.\d{2})?.*Principal dues override justification is required/i);
    });

    it('permits Principal issuance when dues override justification is provided (US-35 AC3, REG-03)', async () => {
      // Step 1 review
      await certificatesService.reviewCertificate(
        draftCertId,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Satisfactory' },
        admissionOfficerSession
      );

      // Principal supplies override justification
      const issueRes = await certificatesService.issueCertificate(
        draftCertId,
        {
          duesOverrideReason: 'Fee waiver sanctioned under Board Resolution #42',
          remarks: 'Approved for transfer',
        },
        principalSession
      );

      expect(issueRes.status).toBe('issued');
      expect(issueRes.certificateNumber).toMatch(/^TC-2026-\d{4}$/);

      // Verify certificate version snapshot records the dues override reason
      const cert = await certificatesService.getCertificateById(draftCertId, principalSession);
      expect(cert.versions.length).toBe(1);
      expect(cert.versions[0].contentSnapshot.feeDuesStatus).toBe('dues_pending_with_override');
      expect(cert.versions[0].contentSnapshot.duesOverrideReason).toContain('Board Resolution #42');
    });

    it('allows certificate issuance without override when dues are ₹0.00', async () => {
      // Create and review certificate for Student 2 (dues are ₹0.00)
      const cert2 = await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord2Id,
          reasonForLeaving: 'Normal promotion',
        },
        admissionOfficerSession
      );

      await certificatesService.reviewCertificate(
        cert2.id,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Good' },
        admissionOfficerSession
      );

      const issueRes = await certificatesService.issueCertificate(
        cert2.id,
        {}, // No override reason needed!
        principalSession
      );

      expect(issueRes.status).toBe('issued');
      const cert = await certificatesService.getCertificateById(cert2.id, principalSession);
      expect(cert.versions[0].contentSnapshot.feeDuesStatus).toBe('cleared');
    });
  });

  describe('Non-Negotiable Invariant: No Status Side-Effect from Certificate Issuance (DEC-08, BR-34, US-36 AC4)', () => {
    it('issuing a certificate does NOT alter student status to Left or Transferred', async () => {
      // Student 2 is in 'admitted' status
      const initialRecord = admissionsService.getAcademicRecord(studentRecord2Id)!;
      expect(initialRecord.status).toBe('admitted');

      // Request, review, and issue certificate for Student 2
      const cert = await certificatesService.requestCertificate(
        {
          studentAcademicRecordId: studentRecord2Id,
          reasonForLeaving: 'Annual completion',
        },
        admissionOfficerSession
      );

      await certificatesService.reviewCertificate(
        cert.id,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Good' },
        admissionOfficerSession
      );

      await certificatesService.issueCertificate(cert.id, {}, principalSession);

      // Check student academic record status after certificate issuance
      const afterRecord = admissionsService.getAcademicRecord(studentRecord2Id)!;

      // Status must STILL BE 'admitted' (NOT 'left' or 'transferred')!
      expect(afterRecord.status).toBe('admitted');
      expect(afterRecord.status).not.toBe('left');
      expect(afterRecord.status).not.toBe('transferred');
    });
  });

  describe('Monotonic Numbering Concurrency & Immutability (US-36, US-37)', () => {
    it('allocates format TC-YYYY-NNNN monotonically with concurrency safety', async () => {
      // Create 3 students
      const certs = [];
      for (let i = 0; i < 3; i++) {
        const draft = await admissionsService.createDraftApplication(
          {
            academicYearId: currentYearId,
            gradeLevelId: std1GradeId,
            requestedSectionId: sectionAId,
            student: {
              firstName: `TestChild${i}`,
              lastName: 'Concurrent',
              dateOfBirth: '2020-01-01',
              gender: 'male',
              transportMode: 'Private',
            },
            guardians: [{ fullName: 'Parent', relationship: 'Father', mobileNumber: '+919876543210', isPrimaryContact: true }],
          },
          admissionOfficerSession
        );
        await admissionsService.submitApplication(
          draft.id,
          { overrideMissingDocumentsReason: 'Pending verification' },
          admissionOfficerSession
        );
        const adm = await admissionsService.approveApplication(draft.id, { sectionId: sectionAId }, principalSession);

        const cert = await certificatesService.requestCertificate(
          { studentAcademicRecordId: adm.studentAcademicRecordId, reasonForLeaving: 'Transfer' },
          admissionOfficerSession
        );
        await certificatesService.reviewCertificate(
          cert.id,
          { action: 'forward_for_approval', conduct: 'Good', progress: 'Good' },
          admissionOfficerSession
        );
        certs.push(cert);
      }

      // Concurrently issue all 3 certificates
      const issuePromises = certs.map((c) =>
        certificatesService.issueCertificate(
          c.id,
          { duesOverrideReason: 'Special exemption' },
          principalSession
        )
      );

      const results = await Promise.all(issuePromises);

      const tcNumbers = results.map((r) => r.certificateNumber);
      const uniqueNumbers = new Set(tcNumbers);

      // Concurrency safety check: All numbers must be distinct
      expect(uniqueNumbers.size).toBe(3);
      tcNumbers.forEach((num) => {
        expect(num).toMatch(/^TC-2026-\d{4}$/);
      });
    });

    it('reprints certificate as DUPLICATE COPY while preserving original version snapshot (US-37)', async () => {
      // Issue certificate for Student 2
      const cert = await certificatesService.requestCertificate(
        { studentAcademicRecordId: studentRecord2Id, reasonForLeaving: 'Moving' },
        admissionOfficerSession
      );
      await certificatesService.reviewCertificate(
        cert.id,
        { action: 'forward_for_approval', conduct: 'Good', progress: 'Good' },
        admissionOfficerSession
      );
      const issued = await certificatesService.issueCertificate(cert.id, {}, principalSession);

      // Reprint with reason
      const reprintRes = await certificatesService.reprintCertificate(
        cert.id,
        { reason: 'Parent lost original physical hardcopy; requested certified duplicate' },
        admissionOfficerSession
      );

      expect(reprintRes.newVersionNumber).toBe(2);
      expect(reprintRes.certificateNumber).toBe(issued.certificateNumber);

      // Check certificate versions vault
      const fullCert = await certificatesService.getCertificateById(cert.id, principalSession);
      expect(fullCert.versions.length).toBe(2);

      // Version 1 is original
      expect(fullCert.versions[0].versionNumber).toBe(1);
      expect(fullCert.versions[0].isDuplicate).toBe(false);
      expect(fullCert.versions[0].duplicateLabel).toBeNull();

      // Version 2 is marked DUPLICATE COPY
      expect(fullCert.versions[1].versionNumber).toBe(2);
      expect(fullCert.versions[1].isDuplicate).toBe(true);
      expect(fullCert.versions[1].duplicateLabel).toBe('DUPLICATE COPY');
      expect(fullCert.versions[1].issueOrReissueReason).toContain('Parent lost original');

      // Audit event logged
      const audit = await auditReportingService.listAuditLogs(
        { action: 'CERTIFICATE_REPRINTED' },
        principalSession
      );
      expect(audit.total).toBe(1);
    });
  });
});
