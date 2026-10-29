import { describe, it, expect, beforeEach } from 'vitest';
import { auditReportingService } from '../src/modules/audit-reporting/service';
import { admissionsService } from '../src/modules/admissions/service';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { feesLedgerService } from '../src/modules/fees-ledger/service';
import { receiptsService } from '../src/modules/receipts/service';
import { certificatesService } from '../src/modules/certificates-lctc/service';
import { studentRecordsService } from '../src/modules/student-records/service';
import { seedComprehensiveSyntheticData } from '../src/modules/shared/seed-data';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
} from '../src/lib/errors';
import { toDecimalInrString } from '../src/modules/shared/types';

describe('Phase 6: Audit Trail, Operational Dashboards, and Synthetic Demo Data (US-38 - US-41)', () => {
  const currentYearId = '00000000-0000-0000-0000-000000000001'; // 2026-2027
  const closedYearId = '00000000-0000-0000-0000-000000000000';  // 2025-2026
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
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

  beforeEach(async () => {
    admissionsService.resetForTesting();
    feeConfigurationService.resetForTesting();
    feesLedgerService.resetForTesting();
    receiptsService.resetForTesting();
    certificatesService.resetForTesting();
    studentRecordsService.resetForTesting();
    auditReportingService.resetForTesting();
  });

  describe('Immutable Audit Trail & Data Sanitization (US-38, US-33)', () => {
    it('records immutable audit events with actor, action, timestamp, and entity (US-38 AC1)', async () => {
      const entry = await auditReportingService.recordAuditEvent({
        actorStaffId: principalSession.staffId,
        actorName: principalSession.fullName,
        actorRole: principalSession.role,
        action: 'ACADEMIC_YEAR_CONFIGURED',
        entityType: 'academic_year',
        entityId: currentYearId,
        outcome: 'success',
        reason: 'Configured new school term',
      });

      expect(entry.id).toBeDefined();
      expect(entry.action).toBe('ACADEMIC_YEAR_CONFIGURED');
      expect(entry.actorRole).toBe('principal');
      expect(entry.createdAt).toBeDefined();

      const list = await auditReportingService.listAuditLogs(
        { action: 'ACADEMIC_YEAR_CONFIGURED' },
        principalSession
      );
      expect(list.total).toBe(1);
    });

    it('strictly prevents updates and hard deletes on audit records (US-33, US-38 AC2)', async () => {
      await expect(auditReportingService.updateAuditLog()).rejects.toThrow(BusinessRuleError);
      await expect(auditReportingService.deleteAuditLog()).rejects.toThrow(BusinessRuleError);
    });

    it('automatically sanitizes and redacts sensitive PII and secrets from audit snapshots (US-38 AC4)', async () => {
      const entry = await auditReportingService.recordAuditEvent({
        actorStaffId: admissionOfficerSession.staffId,
        actorName: admissionOfficerSession.fullName,
        actorRole: admissionOfficerSession.role,
        action: 'TEST_PII_LOGGING',
        entityType: 'student',
        beforeSnapshot: {
          password: 'SecretPassword123!',
          userToken: 'eyJhbGciOi...',
          aadhaarNumber: '123456789012',
          bankAccountNumber: '987654321098',
          publicName: 'Aarav Sharma',
        },
      });

      const snapshot = entry.beforeSnapshot as any;

      // Sensitive passwords and tokens redacted
      expect(snapshot.password).toBe('[REDACTED_SECRET]');
      expect(snapshot.userToken).toBe('[REDACTED_SECRET]');

      // Aadhaar and bank account masked (only last 4 digits)
      expect(snapshot.aadhaarNumber).toContain('9012');
      expect(snapshot.aadhaarNumber).not.toBe('123456789012');
      expect(snapshot.bankAccountNumber).toContain('1098');

      // Public fields untouched
      expect(snapshot.publicName).toBe('Aarav Sharma');
    });

    it('restricts audit queries to authorized roles (Principal, SysAdmin, Accountant) (US-38)', async () => {
      // Principal can view
      await expect(
        auditReportingService.listAuditLogs({}, principalSession)
      ).resolves.toBeDefined();

      // SysAdmin can view
      await expect(
        auditReportingService.listAuditLogs({}, sysAdminSession)
      ).resolves.toBeDefined();

      // Accountant can view
      await expect(
        auditReportingService.listAuditLogs({}, accountantSession)
      ).resolves.toBeDefined();

      // Admission Officer is denied audit query access
      await expect(
        auditReportingService.listAuditLogs({}, admissionOfficerSession)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Operational Dashboards & Academic Year Scoping (US-39)', () => {
    it('calculates operational metrics accurately with correct academic-year scoping (US-39 AC1, AC2)', async () => {
      // Seed comprehensive synthetic data
      await seedComprehensiveSyntheticData();

      const dashboard = await auditReportingService.getDashboardMetrics(
        currentYearId,
        principalSession
      );

      expect(dashboard.academicYearId).toBe(currentYearId);
      expect(dashboard.academicYearLabel).toBe('2026-2027');

      // Check student and application figures
      expect(dashboard.totalApplications).toBeGreaterThan(0);
      expect(dashboard.totalAdmittedStudents).toBe(3); // 3 active/admitted (Aarav, Priya, Rohan)
      expect(dashboard.totalLeftStudents).toBe(1);     // 1 transferred (Kavya Rao)

      // Check seat capacity utilization
      expect(dashboard.totalSeatCapacity).toBeGreaterThan(0);
      expect(dashboard.seatCapacityUtilizationPercentage).toBeGreaterThanOrEqual(0);

      // Check financial aggregates (Principal view)
      expect(dashboard.financials).toBeDefined();
      expect(parseFloat(dashboard.financials!.totalFeeAssessedInr)).toBeGreaterThan(0);
      expect(parseFloat(dashboard.financials!.totalFeeCollectedInr)).toBeGreaterThan(0);
      expect(dashboard.financials!.categories.length).toBe(3); // School Fee, Vehicle, Books
    });

    it('enforces role-aware data projection: non-financial staff do not receive fee totals (privacy)', async () => {
      await seedComprehensiveSyntheticData();

      // Admission officer dashboard query
      const admDashboard = await auditReportingService.getDashboardMetrics(
        currentYearId,
        admissionOfficerSession
      );

      // Operational and seat metrics are visible
      expect(admDashboard.totalApplications).toBeGreaterThan(0);
      expect(admDashboard.totalAdmittedStudents).toBe(3);
      expect(admDashboard.sectionsCapacity.length).toBeGreaterThan(0);

      // Financials must be strictly undefined / hidden for Admission Officer!
      expect(admDashboard.financials).toBeUndefined();
    });

    it('denies System Administrator from viewing institutional student and business metrics', async () => {
      await expect(
        auditReportingService.getDashboardMetrics(currentYearId, sysAdminSession)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Comprehensive Synthetic Seed Data Verification (US-41)', () => {
    it('seeds all required synthetic scenarios cleanly without real personal data (US-41 AC1, AC2)', async () => {
      const summary = await seedComprehensiveSyntheticData();

      expect(summary.admittedCount).toBeGreaterThanOrEqual(4);
      expect(summary.paymentsCount).toBeGreaterThanOrEqual(3);
      expect(summary.certificatesCount).toBeGreaterThanOrEqual(1);

      // Verify Student 1 (Aarav) has full paid status and issued TC
      const searchRes = await studentRecordsService.searchStudents(
        { search: 'Aarav' },
        principalSession
      );
      expect(searchRes.total).toBe(1);

      const certs = await certificatesService.listCertificates(
        { studentId: searchRes.data[0].id },
        principalSession
      );
      expect(certs.total).toBeGreaterThan(0);
      expect(certs.data[0].status).toBe('issued');
      expect(certs.data[0].certificateNumber).toMatch(/^TC-2026-\d{4}$/);

      // Verify Student 4 (Kavya) was marked transferred
      const searchKavya = await studentRecordsService.searchStudents(
        { search: 'Kavya' },
        principalSession
      );
      expect(searchKavya.total).toBe(1);
      expect(searchKavya.data[0].status).toBe('transferred');
    });
  });
});
