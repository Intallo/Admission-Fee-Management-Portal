import { describe, it, expect, beforeEach, vi } from 'vitest';
import { studentRecordsService } from '../src/modules/student-records/service';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { admissionsService } from '../src/modules/admissions/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { receiptsService } from '../src/modules/receipts/service';
import { auditReportingService } from '../src/modules/audit-reporting/service';
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

import { GET as searchStudentsRoute } from '../src/app/api/v1/students/route';
import { GET as getStudentProfileRoute } from '../src/app/api/v1/students/[id]/route';
import { POST as markStudentStatusRoute } from '../src/app/api/v1/students/[id]/status/route';
import { GET as listCertificatesRoute, POST as requestCertificateRoute } from '../src/app/api/v1/certificates/route';
import { POST as prepopulateCertificatesRoute } from '../src/app/api/v1/certificates/prepopulate/route';
import { GET as getCertificateRoute } from '../src/app/api/v1/certificates/[id]/route';
import { POST as reviewCertificateRoute } from '../src/app/api/v1/certificates/[id]/review/route';
import { POST as issueCertificateRoute } from '../src/app/api/v1/certificates/[id]/issue/route';
import { POST as reprintCertificateRoute } from '../src/app/api/v1/certificates/[id]/reprint/route';
import { GET as getAuditLogsRoute } from '../src/app/api/v1/audit-logs/route';
import { GET as getDashboardMetricsRoute } from '../src/app/api/v1/dashboard/metrics/route';

describe('Phase 6: Student Records, Certificates, Audit & Dashboard API Routes', () => {
  const currentYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  let testAcademicRecordId: string;

  beforeEach(async () => {
    admissionsService.resetForTesting();
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    certificatesService.resetForTesting();
    studentRecordsService.resetForTesting();
    auditReportingService.resetForTesting();

    currentMockSession = {
      staffId: 'principal-uuid-test',
      authUserId: 'principal-auth-uuid',
      email: 'principal@school-demo.example',
      fullName: 'Dr. Ramesh Kulkarni (Principal)',
      role: 'principal',
      isActive: true,
      activeAcademicYearId: currentYearId,
      activeAcademicYearLabel: '2026-2027',
    };

    // Create an admitted student
    const admSession: AuthenticatedUserSession = {
      staffId: 'adm-uuid-test',
      authUserId: 'adm-auth-uuid',
      email: 'adm@school-demo.example',
      fullName: 'Suma Patil (Admission Officer)',
      role: 'admission_officer',
      isActive: true,
      activeAcademicYearId: currentYearId,
      activeAcademicYearLabel: '2026-2027',
    };

    const draft = await admissionsService.createDraftApplication(
      {
        academicYearId: currentYearId,
        gradeLevelId: std1GradeId,
        requestedSectionId: sectionAId,
        student: {
          firstName: 'Ananya',
          lastName: 'Deshmukh',
          dateOfBirth: '2020-03-12',
          gender: 'female',
          stsNumber: 'STS-2026-555',
          transportMode: 'Private',
        },
        guardians: [
          {
            fullName: 'Rajesh Deshmukh',
            relationship: 'Father',
            mobileNumber: '+919900112233',
            isPrimaryContact: true,
          },
        ],
        sensitiveDetails: {
          aadhaarNumber: '112233445566',
          householdIncomeInr: toDecimalInrString('800000.00'),
          casteCategory: 'General',
        },
      },
      admSession
    );

    await admissionsService.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Intake verification pending hardcopy' },
      admSession
    );
    const adm = await admissionsService.approveApplication(
      draft.id,
      { sectionId: sectionAId },
      currentMockSession
    );
    testAcademicRecordId = adm.studentAcademicRecordId;
  });

  describe('Student Records API Routes', () => {
    it('GET /api/v1/students - searches students with correlation id header', async () => {
      const req = new Request('http://localhost/api/v1/students?search=Ananya', {
        headers: { 'x-correlation-id': 'corr-search-1' },
      });

      const res = await searchStudentsRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-correlation-id')).toBe('corr-search-1');

      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.data[0].fullName).toBe('Ananya Deshmukh');
    });

    it('GET /api/v1/students/[id] - retrieves student profile', async () => {
      const req = new Request(`http://localhost/api/v1/students/${testAcademicRecordId}`);
      const res = await getStudentProfileRoute(req, { params: { id: testAcademicRecordId } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.demographics.firstName).toBe('Ananya');
      expect(body.currentAcademicRecord.status).toBe('admitted');
    });

    it('POST /api/v1/students/[id]/status - marks student Left / Transferred (Principal)', async () => {
      const req = new Request(`http://localhost/api/v1/students/${testAcademicRecordId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicRecordId: testAcademicRecordId,
          newStatus: 'transferred',
          exitDate: '2026-10-29',
          exitReason: 'Family shifted residence',
        }),
      });

      const res = await markStudentStatusRoute(req, { params: { id: testAcademicRecordId } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.newStatus).toBe('transferred');
      expect(body.previousStatus).toBe('admitted');
    });

    it('POST /api/v1/students/[id]/status - rejects unauthorized role', async () => {
      currentMockSession.role = 'accountant'; // Accountant is not authorized to mark student Left

      const req = new Request(`http://localhost/api/v1/students/${testAcademicRecordId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicRecordId: testAcademicRecordId,
          newStatus: 'transferred',
          exitDate: '2026-10-29',
          exitReason: 'Family shifted residence',
        }),
      });

      const res = await markStudentStatusRoute(req, { params: { id: testAcademicRecordId } });
      expect(res.status).toBe(403);
    });
  });

  describe('Certificates API Routes', () => {
    it('POST /api/v1/certificates/prepopulate - batch creates draft records', async () => {
      const req = new Request('http://localhost/api/v1/certificates/prepopulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId: currentYearId }),
      });

      const res = await prepopulateCertificatesRoute(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.createdCount).toBe(1);
    });

    it('Two-Step Certificate API flow: Review (Step 1) -> Issue (Step 2) -> Reprint', async () => {
      // 1. Request certificate
      const req1 = new Request('http://localhost/api/v1/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentAcademicRecordId: testAcademicRecordId,
          certificateType: 'TC',
          reasonForLeaving: 'Course completed',
          dateOfLeaving: '2026-10-29',
        }),
      });
      const res1 = await requestCertificateRoute(req1);
      expect(res1.status).toBe(201);
      const cert = await res1.json();

      // 2. Step 1: Admission Officer Review
      currentMockSession.role = 'admission_officer';
      const reqReview = new Request(`http://localhost/api/v1/certificates/${cert.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'forward_for_approval',
          conduct: 'Good',
          progress: 'Satisfactory',
          remarks: 'Reviewed and forwarded',
        }),
      });
      const resReview = await reviewCertificateRoute(reqReview, { params: { id: cert.id } });
      expect(resReview.status).toBe(200);

      // 3. Step 2: Principal Approval & Issue
      currentMockSession.role = 'principal';
      const reqIssue = new Request(`http://localhost/api/v1/certificates/${cert.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks: 'Approved by Principal',
          duesOverrideReason: 'Authorized by Principal override',
        }),
      });
      const resIssue = await issueCertificateRoute(reqIssue, { params: { id: cert.id } });
      expect(resIssue.status).toBe(201);
      const issuedBody = await resIssue.json();
      expect(issuedBody.certificateNumber).toMatch(/^TC-2026-\d{4}$/);

      // 4. Duplicate Reprint
      const reqReprint = new Request(`http://localhost/api/v1/certificates/${cert.id}/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Parent required duplicate copy for state board submission',
        }),
      });
      const resReprint = await reprintCertificateRoute(reqReprint, { params: { id: cert.id } });
      expect(resReprint.status).toBe(200);
      const reprintBody = await resReprint.json();
      expect(reprintBody.newVersionNumber).toBe(2);
    });
  });

  describe('Audit and Dashboard API Routes', () => {
    it('GET /api/v1/audit-logs - returns audit trail for Principal', async () => {
      const req = new Request('http://localhost/api/v1/audit-logs');
      const res = await getAuditLogsRoute(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
    });

    it('GET /api/v1/dashboard/metrics - returns operational metrics for Principal', async () => {
      const req = new Request('http://localhost/api/v1/dashboard/metrics');
      const res = await getDashboardMetricsRoute(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.academicYearId).toBe(currentYearId);
      expect(body.totalAdmittedStudents).toBe(1);
      expect(body.financials).toBeDefined();
    });

    it('GET /api/v1/dashboard/metrics - denies System Administrator', async () => {
      currentMockSession.role = 'system_admin';
      const req = new Request('http://localhost/api/v1/dashboard/metrics');
      const res = await getDashboardMetricsRoute(req);
      expect(res.status).toBe(403);
    });
  });
});
