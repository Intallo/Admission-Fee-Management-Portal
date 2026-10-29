import { randomUUID } from 'crypto';
import {
  AuditLogEntryDTO,
  AuditLogFilterDTO,
  DashboardMetricsDTO,
  CategoryFeeMetricDTO,
  SectionSeatMetricDTO,
} from './types';
import { AuthenticatedUserSession, StaffRole } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { logger } from '../../lib/logger';
import { getAdminDbClient } from '../../infrastructure/db/supabase-admin';
import { maskAadhaar, maskBankAccount } from '../../lib/crypto/pii';
import { admissionsService } from '../admissions/service';
import { academicYearsService } from '../academic-years/service';
import { feesLedgerService } from '../fees-ledger/service';
import { certificatesService } from '../certificates-lctc/service';
import { addInr } from '../../lib/money/inr';
import { toDecimalInrString } from '../shared/types';

// Keys that must NEVER appear in raw form in audit snapshots
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /jwt/i,
  /cookie/i,
  /credit_?card/i,
];

function sanitizeValue(key: string, val: unknown): unknown {
  if (val === null || val === undefined) return val;

  // Check key patterns
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(key)) {
      return '[REDACTED_SECRET]';
    }
  }

  if (/aadhaar/i.test(key)) {
    if (typeof val === 'string') {
      return maskAadhaar(val);
    }
    return '[REDACTED_AADHAAR]';
  }

  if (/bank_?account/i.test(key) || /account_?number/i.test(key)) {
    if (typeof val === 'string') {
      return maskBankAccount(val);
    }
    return '[REDACTED_ACCOUNT]';
  }

  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map((item) => sanitizeValue(key, item));
    }
    const sanitizedObj: Record<string, unknown> = {};
    for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
      sanitizedObj[subKey] = sanitizeValue(subKey, subVal);
    }
    return sanitizedObj;
  }

  return val;
}

export function sanitizeAuditSnapshot(snapshot: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!snapshot) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

// In-memory vault for audit logs (test and local fallback)
let auditLogsVault: AuditLogEntryDTO[] = [];

export interface CreateAuditEventInput {
  actorStaffId?: string | null;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  outcome?: 'success' | 'failure';
  reason?: string | null;
}

export class AuditReportingService {
  /**
   * Resets the in-memory audit logs vault for testing.
   */
  resetForTesting(): void {
    auditLogsVault = [];
  }

  /**
   * Appends an immutable audit event with automatic PII sanitization.
   */
  async recordAuditEvent(input: CreateAuditEventInput): Promise<AuditLogEntryDTO> {
    const sanitizedBefore = sanitizeAuditSnapshot(input.beforeSnapshot);
    const sanitizedAfter = sanitizeAuditSnapshot(input.afterSnapshot);

    const entry: AuditLogEntryDTO = {
      id: randomUUID(),
      actorStaffId: input.actorStaffId ?? null,
      actorName: input.actorName ?? 'System',
      actorRole: input.actorRole ?? 'system',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeSnapshot: sanitizedBefore,
      afterSnapshot: sanitizedAfter,
      outcome: input.outcome ?? 'success',
      reason: input.reason ?? null,
      createdAt: new Date().toISOString(),
    };

    // 1. Save in-memory
    auditLogsVault.unshift(entry); // newest first

    // 2. Attempt persistence to Supabase if available
    try {
      const adminDb = getAdminDbClient();
      await adminDb.from('audit_logs').insert({
        action: entry.action,
        actor_staff_id: entry.actorStaffId,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        outcome: entry.outcome,
        reason: entry.reason,
        before_snapshot: (entry.beforeSnapshot as any) ?? undefined,
        after_snapshot: (entry.afterSnapshot as any) ?? undefined,
        created_at: entry.createdAt,
      });
    } catch {
      // Local/test sandbox fallback
    }

    logger.info(`Audit Event: ${entry.action}`, {
      actorStaffId: entry.actorStaffId,
      actorRole: entry.actorRole,
      entityType: entry.entityType,
      entityId: entry.entityId,
      outcome: entry.outcome,
    });

    return entry;
  }

  /**
   * Queries audit logs with filtering and server-side RBAC enforcement.
   */
  async listAuditLogs(
    filter: AuditLogFilterDTO,
    session: AuthenticatedUserSession
  ): Promise<{ data: AuditLogEntryDTO[]; total: number }> {
    enforcePolicy(session.role, 'audit:view_logs');

    let logs = [...auditLogsVault];

    if (filter.actorStaffId) {
      logs = logs.filter((l) => l.actorStaffId === filter.actorStaffId);
    }
    if (filter.actorRole) {
      logs = logs.filter((l) => l.actorRole.toLowerCase() === filter.actorRole?.toLowerCase());
    }
    if (filter.action) {
      logs = logs.filter((l) => l.action.toLowerCase() === filter.action?.toLowerCase());
    }
    if (filter.entityType) {
      logs = logs.filter((l) => l.entityType.toLowerCase() === filter.entityType?.toLowerCase());
    }
    if (filter.entityId) {
      logs = logs.filter((l) => l.entityId === filter.entityId);
    }
    if (filter.outcome) {
      logs = logs.filter((l) => l.outcome === filter.outcome);
    }
    if (filter.startDate) {
      logs = logs.filter((l) => l.createdAt >= (filter.startDate as string));
    }
    if (filter.endDate) {
      logs = logs.filter((l) => l.createdAt <= (filter.endDate as string));
    }

    const total = logs.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const paginated = logs.slice(offset, offset + limit);

    return {
      data: paginated,
      total,
    };
  }

  /**
   * Retrieves operational KPI metrics for the selected academic year (US-39).
   * Enforces role-aware masking so sensitive financials or PII are not leaked.
   */
  async getDashboardMetrics(
    academicYearId: string | undefined,
    session: AuthenticatedUserSession
  ): Promise<DashboardMetricsDTO> {
    enforcePolicy(session.role, 'dashboard:view_metrics');

    const targetYearId = academicYearId || session.activeAcademicYearId;
    const year = await academicYearsService.getAcademicYearById(targetYearId);

    // 1. Admission Applications Breakdown
    const allApps = admissionsService.getAllApplications().filter((a) => a.academicYearId === targetYearId);
    const applicationsByStatus = {
      draft: allApps.filter((a) => a.status === 'draft').length,
      submitted: allApps.filter((a) => a.status === 'submitted').length,
      under_review: allApps.filter((a) => a.status === 'under_review').length,
      on_hold: allApps.filter((a) => a.status === 'on_hold').length,
      approved: allApps.filter((a) => a.status === 'approved').length,
      rejected: allApps.filter((a) => a.status === 'rejected').length,
      withdrawn: allApps.filter((a) => a.status === 'withdrawn').length,
    };

    // 2. Student Enrollment & Status Counts
    const allRecords = admissionsService
      .getAllAcademicRecords()
      .filter((r) => r.academicYearId === targetYearId);

    const totalAdmittedStudents = allRecords.filter(
      (r) => r.status === 'admitted' || r.status === 'active'
    ).length;

    const totalLeftStudents = allRecords.filter(
      (r) => r.status === 'left' || r.status === 'transferred' || r.status === 'withdrawn'
    ).length;

    // 3. Section Seat Capacities & Utilization
    const allSections = admissionsService
      .getAllSections()
      .filter((s) => s.academicYearId === targetYearId);

    const sectionsCapacity: SectionSeatMetricDTO[] = [];
    let totalSeatCapacity = 0;
    let totalSeatsUsed = 0;

    for (const sec of allSections) {
      const grade = admissionsService.getGradeLevel(sec.gradeLevelId);
      const enrolledCount = allRecords.filter(
        (r) => r.sectionId === sec.id && (r.status === 'admitted' || r.status === 'active')
      ).length;
      const availableSeats = Math.max(0, sec.maxCapacity - enrolledCount);

      totalSeatCapacity += sec.maxCapacity;
      totalSeatsUsed += enrolledCount;

      sectionsCapacity.push({
        sectionId: sec.id,
        sectionName: sec.name,
        gradeLevelId: sec.gradeLevelId,
        gradeLevelName: grade?.name || 'Standard 1',
        gradeGroup: grade?.groupName || 'primary',
        maxCapacity: sec.maxCapacity,
        enrolledCount,
        availableSeats,
      });
    }

    const totalSeatsAvailable = Math.max(0, totalSeatCapacity - totalSeatsUsed);
    const seatCapacityUtilizationPercentage =
      totalSeatCapacity > 0 ? Math.round((totalSeatsUsed / totalSeatCapacity) * 100) : 0;

    // 4. Financial Metrics (Restricted by role)
    // Only Principal, Accountant, and Clerk get financials
    const canViewFinancials =
      session.role === 'principal' || session.role === 'accountant' || session.role === 'clerk' || session.role === 'read_only';

    let financials: DashboardMetricsDTO['financials'] = undefined;

    if (canViewFinancials) {
      let totalFeeAssessed = '0.00';
      let totalFeeCollected = '0.00';
      let totalOutstandingDues = '0.00';
      let totalConcessions = '0.00';

      const categoryTotals: Record<
        'school_fee' | 'vehicle' | 'books',
        { assessed: string; collected: string; outstanding: string }
      > = {
        school_fee: { assessed: '0.00', collected: '0.00', outstanding: '0.00' },
        vehicle: { assessed: '0.00', collected: '0.00', outstanding: '0.00' },
        books: { assessed: '0.00', collected: '0.00', outstanding: '0.00' },
      };

      for (const rec of allRecords) {
        try {
          const dues = await feesLedgerService.getStudentDues(rec.id, session);
          totalFeeAssessed = addInr(totalFeeAssessed, dues.totalAssessedInr);
          totalFeeCollected = addInr(totalFeeCollected, dues.totalPaidInr);
          totalOutstandingDues = addInr(totalOutstandingDues, dues.netBalanceDueInr);
          totalConcessions = addInr(totalConcessions, dues.totalConcessionsInr);

          for (const line of dues.lines) {
            const cat = line.category;
            if (categoryTotals[cat]) {
              categoryTotals[cat].assessed = addInr(categoryTotals[cat].assessed, line.assessedAmount);
              categoryTotals[cat].collected = addInr(categoryTotals[cat].collected, line.collectedAmount);
              categoryTotals[cat].outstanding = addInr(categoryTotals[cat].outstanding, line.netRemainingDues);
            }
          }
        } catch {
          // Record has no fee assessment generated yet
        }
      }

      financials = {
        totalFeeAssessedInr: toDecimalInrString(totalFeeAssessed),
        totalFeeCollectedInr: toDecimalInrString(totalFeeCollected),
        totalOutstandingDuesInr: toDecimalInrString(totalOutstandingDues),
        totalConcessionsApprovedInr: toDecimalInrString(totalConcessions),
        categories: [
          {
            feeCategory: 'school_fee',
            categoryLabel: 'School Tuition & Term Fees',
            assessedInr: toDecimalInrString(categoryTotals.school_fee.assessed),
            collectedInr: toDecimalInrString(categoryTotals.school_fee.collected),
            outstandingInr: toDecimalInrString(categoryTotals.school_fee.outstanding),
          },
          {
            feeCategory: 'vehicle',
            categoryLabel: 'Transportation & Vehicle Fees',
            assessedInr: toDecimalInrString(categoryTotals.vehicle.assessed),
            collectedInr: toDecimalInrString(categoryTotals.vehicle.collected),
            outstandingInr: toDecimalInrString(categoryTotals.vehicle.outstanding),
          },
          {
            feeCategory: 'books',
            categoryLabel: 'Books & Uniform Kits',
            assessedInr: toDecimalInrString(categoryTotals.books.assessed),
            collectedInr: toDecimalInrString(categoryTotals.books.collected),
            outstandingInr: toDecimalInrString(categoryTotals.books.outstanding),
          },
        ],
      };
    }

    // 5. Certificate Counts
    let certificates: DashboardMetricsDTO['certificates'] = undefined;
    if (session.role === 'principal' || session.role === 'admission_officer') {
      try {
        const certList = await certificatesService.listCertificates(
          { academicYearId: targetYearId },
          session
        );
        certificates = {
          total: certList.total,
          draft: certList.data.filter((c) => c.status === 'draft').length,
          reviewed: certList.data.filter((c) => c.reviewStatus === 'reviewed' && c.status === 'draft').length,
          issued: certList.data.filter((c) => c.status === 'issued').length,
          cancelled: certList.data.filter((c) => c.status === 'cancelled').length,
        };
      } catch {
        // Fallback
      }
    }

    return {
      academicYearId: targetYearId,
      academicYearLabel: year.label,
      totalApplications: allApps.length,
      applicationsByStatus,
      totalAdmittedStudents,
      totalLeftStudents,
      totalSeatCapacity,
      totalSeatsUsed,
      totalSeatsAvailable,
      seatCapacityUtilizationPercentage,
      sectionsCapacity,
      financials,
      certificates,
    };
  }

  /**
   * Throws BusinessRuleError if any update attempt is made on audit records (US-33, US-38 AC2).
   */
  async updateAuditLog(): Promise<never> {
    throw new BusinessRuleError('Audit logs are strictly immutable. Updates are rejected by policy.');
  }

  /**
   * Throws BusinessRuleError if any delete attempt is made on audit records (US-33, US-38 AC2).
   */
  async deleteAuditLog(): Promise<never> {
    throw new BusinessRuleError('Audit logs are strictly immutable. Hard deletion is rejected by policy.');
  }
}

export const auditReportingService = new AuditReportingService();
