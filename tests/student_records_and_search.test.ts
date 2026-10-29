import { describe, it, expect, beforeEach } from 'vitest';
import { studentRecordsService } from '../src/modules/student-records/service';
import { admissionsService } from '../src/modules/admissions/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { receiptsService } from '../src/modules/receipts/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { auditReportingService } from '../src/modules/audit-reporting/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../src/lib/errors';
import { toDecimalInrString } from '../src/modules/shared/types';

describe('Phase 6: Student Records, Search, Profiles and Mark-Left Workflow (US-30 - US-33)', () => {
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

  const clerkSession: AuthenticatedUserSession = {
    staffId: '55555555-5555-5555-5555-555555555555',
    authUserId: 'auth-clerk',
    email: 'clerk@school-demo.example',
    fullName: 'Anil Clerk',
    role: 'clerk',
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
  let testStudentId: string;

  beforeEach(async () => {
    admissionsService.resetForTesting();
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    certificatesService.resetForTesting();
    studentRecordsService.resetForTesting();
    auditReportingService.resetForTesting();

    // Setup an admitted student via Admissions service
    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          dateOfBirth: '2020-05-15',
          gender: 'male',
          stsNumber: 'STS-2026-789',
          diseNumber: 'DISE-29-001',
          transportMode: 'School Bus',
          addressLine1: '45 Lake View Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560024',
        },
        guardians: [
          {
            fullName: 'Vikram Sharma',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            email: 'vikram.sharma@example.com',
            residentialAddress: '45 Lake View Road, Bengaluru',
            isPrimaryContact: true,
          },
        ],
        sensitiveDetails: {
          aadhaarNumber: '998877665544',
          householdIncomeInr: toDecimalInrString('1200000.00'),
          casteCategory: 'General',
          subCaste: 'Brahmin',
        },
      },
      admissionOfficerSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Pending physical document verification' },
      admissionOfficerSession
    );
    const approval = await admissionsService.approveApplication(
      draft.id,
      { sectionId: sectionAId },
      principalSession
    );

    testStudentAcademicRecordId = approval.studentAcademicRecordId;
    testStudentId = approval.studentId;
  });

  describe('Student Search & Privacy Protection (US-30, R-06)', () => {
    it('returns student search results quickly with multi-criteria filters', async () => {
      const start = Date.now();
      const res = await studentRecordsService.searchStudents(
        { search: 'Aarav', academicYearId: currentYearId },
        principalSession
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000); // US-30 AC1: Within 3 seconds
      expect(res.total).toBe(1);
      expect(res.data[0].fullName).toBe('Aarav Sharma');
      expect(res.data[0].stsNumber).toBe('STS-2026-789');
      expect(res.data[0].diseNumber).toBe('DISE-29-001');
      expect(res.data[0].gradeLevelName).toBeDefined();
    });

    it('searches by admission number and STS number', async () => {
      const byAdm = await studentRecordsService.searchStudents(
        { search: 'ADM-2026', academicYearId: currentYearId },
        clerkSession
      );
      expect(byAdm.total).toBe(1);

      const bySts = await studentRecordsService.searchStudents(
        { search: 'STS-2026-789', academicYearId: currentYearId },
        clerkSession
      );
      expect(bySts.total).toBe(1);
    });

    it('strictly redacts sensitive PII from search results for unauthorized staff (R-06, US-30 AC2)', async () => {
      // Search performed by Accountant (unauthorized for sensitive demographic PII)
      const res = await studentRecordsService.searchStudents(
        { search: 'Aarav' },
        accountantSession
      );

      expect(res.total).toBe(1);
      const studentItem = res.data[0];

      // Public and institutional fields are visible
      expect(studentItem.fullName).toBe('Aarav Sharma');
      expect(studentItem.admissionNumber).toBeDefined();
      expect(studentItem.stsNumber).toBe('STS-2026-789');

      // Sensitive fields must NOT exist on search item DTO
      expect((studentItem as any).aadhaarNumber).toBeUndefined();
      expect((studentItem as any).householdIncomeInr).toBeUndefined();
      expect((studentItem as any).casteCategory).toBeUndefined();
    });

    it('includes and clearly labels Left/Transferred students in search results (US-30 AC3)', async () => {
      // Mark student as transferred
      await studentRecordsService.markStudentStatus(
        testStudentAcademicRecordId,
        {
          academicRecordId: testStudentAcademicRecordId,
          newStatus: 'transferred',
          exitDate: '2026-10-25',
          exitReason: 'Family relocated to another state',
        },
        principalSession
      );

      // Search all students
      const res = await studentRecordsService.searchStudents(
        { academicYearId: currentYearId, status: 'all' },
        clerkSession
      );

      const found = res.data.find((s) => s.studentAcademicRecordId === testStudentAcademicRecordId);
      expect(found).toBeDefined();
      expect(found?.status).toBe('transferred');
    });
  });

  describe('Student Profile Tabs & Role-Filtered View (US-31)', () => {
    it('returns full profile with sensitive PII and documents to Principal and Admission Officer (US-31 AC1, AC2)', async () => {
      const profile = await studentRecordsService.getStudentProfile(
        testStudentAcademicRecordId,
        currentYearId,
        principalSession
      );

      expect(profile.demographics.firstName).toBe('Aarav');
      expect(profile.guardians.length).toBeGreaterThan(0);
      expect(profile.currentAcademicRecord.status).toBe('admitted');

      // Sensitive details available
      expect(profile.sensitiveDetails).not.toBeNull();
      expect(profile.sensitiveDetails?.casteCategory).toBe('General');
      expect(profile.sensitiveDetails?.aadhaarNumberMasked).toContain('5544');

      // Audit event for sensitive PII view must be logged
      const auditRes = await auditReportingService.listAuditLogs(
        { action: 'SENSITIVE_PII_VIEWED' },
        principalSession
      );
      expect(auditRes.total).toBeGreaterThan(0);
    });

    it('hides sensitive PII and private documents tab from unauthorized staff (US-31 AC2, R-06)', async () => {
      const profile = await studentRecordsService.getStudentProfile(
        testStudentAcademicRecordId,
        currentYearId,
        accountantSession
      );

      // Sensitive demographic PII and documents are hidden
      expect(profile.sensitiveDetails).toBeNull();
      expect(profile.documents).toBeNull();

      // Fees tab is accessible to Accountant
      expect(profile.feeSummary).not.toBeNull();
    });
  });

  describe('Authorized Mark-Left Workflow & Seat Release (US-32, US-33)', () => {
    it('allows Principal to mark student as Left / Transferred with mandatory date and reason (US-32 AC1)', async () => {
      const result = await studentRecordsService.markStudentStatus(
        testStudentAcademicRecordId,
        {
          academicRecordId: testStudentAcademicRecordId,
          newStatus: 'transferred',
          exitDate: '2026-10-20',
          exitReason: 'Relocation to Mumbai for parent employment.',
        },
        principalSession
      );

      expect(result.previousStatus).toBe('admitted');
      expect(result.newStatus).toBe('transferred');
      expect(result.exitDate).toBe('2026-10-20');
      expect(result.exitReason).toBe('Relocation to Mumbai for parent employment.');

      // Check profile shows new status and updated status history
      const profile = await studentRecordsService.getStudentProfile(
        testStudentAcademicRecordId,
        currentYearId,
        principalSession
      );
      expect(profile.currentAcademicRecord.status).toBe('transferred');
      expect(profile.statusHistory.length).toBe(1);
      expect(profile.statusHistory[0].reason).toContain('Relocation to Mumbai');
    });

    it('denies non-Principal staff from marking student as Left (AUTHORIZATION_MATRIX.md)', async () => {
      await expect(
        studentRecordsService.markStudentStatus(
          testStudentAcademicRecordId,
          {
            academicRecordId: testStudentAcademicRecordId,
            newStatus: 'left',
            exitDate: '2026-10-20',
            exitReason: 'Leaving school',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        studentRecordsService.markStudentStatus(
          testStudentAcademicRecordId,
          {
            academicRecordId: testStudentAcademicRecordId,
            newStatus: 'left',
            exitDate: '2026-10-20',
            exitReason: 'Leaving school',
          },
          accountantSession
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('rejects status change when exit date or exit reason is missing (validation)', async () => {
      await expect(
        studentRecordsService.markStudentStatus(
          testStudentAcademicRecordId,
          {
            academicRecordId: testStudentAcademicRecordId,
            newStatus: 'left',
            exitDate: '',
            exitReason: 'Leaving',
          },
          principalSession
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        studentRecordsService.markStudentStatus(
          testStudentAcademicRecordId,
          {
            academicRecordId: testStudentAcademicRecordId,
            newStatus: 'left',
            exitDate: '2026-10-20',
            exitReason: '',
          },
          principalSession
        )
      ).rejects.toThrow(ValidationError);
    });

    it('frees student seat immediately upon marking Left/Transferred (US-32 AC4, US-42 AC6)', async () => {
      // Check initial section capacity utilization
      const capBefore = await admissionsService.checkCapacity(
        sectionAId,
        currentYearId
      );
      const enrolledBefore = capBefore.enrolledInSection;

      // Mark student as transferred
      await studentRecordsService.markStudentStatus(
        testStudentAcademicRecordId,
        {
          academicRecordId: testStudentAcademicRecordId,
          newStatus: 'transferred',
          exitDate: '2026-10-20',
          exitReason: 'Relocation to Pune.',
        },
        principalSession
      );

      // Check section capacity after: seat must be freed
      const capAfter = await admissionsService.checkCapacity(
        sectionAId,
        currentYearId
      );
      expect(capAfter.enrolledInSection).toBe(enrolledBefore - 1);
      expect(capAfter.availableInSection).toBe(capBefore.availableInSection + 1);
    });

    it('preserves all payments, receipts, and records permanently with zero hard delete (US-32 AC2, US-33 AC1)', async () => {
      // Mark student as left
      await studentRecordsService.markStudentStatus(
        testStudentAcademicRecordId,
        {
          academicRecordId: testStudentAcademicRecordId,
          newStatus: 'left',
          exitDate: '2026-10-20',
          exitReason: 'Completed school course.',
        },
        principalSession
      );

      // Student academic record and dues remain fully queryable
      const dues = await feesLedgerService.getStudentDues(testStudentAcademicRecordId, accountantSession);
      expect(dues).toBeDefined();

      // Deletion attempt is rejected
      await expect(studentRecordsService.deleteStudent()).rejects.toThrow(BusinessRuleError);
    });
  });
});
