/**
 * School Admission & Fee Management Portal
 * Module: Audit Trail & Reporting (Module 10)
 */

import { UUID, IsoTimestampString, DecimalInrString } from '../shared/types';
import { StaffRole } from '../identity-access/types';

export interface AuditLogEntryDTO {
  id: string;
  actorStaffId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  outcome: 'success' | 'failure';
  reason: string | null;
  createdAt: IsoTimestampString;
}

export interface AuditLogFilterDTO {
  actorStaffId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  outcome?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export interface SectionSeatMetricDTO {
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeGroup: string;
  maxCapacity: number;
  enrolledCount: number;
  availableSeats: number;
}

export interface CategoryFeeMetricDTO {
  feeCategory: 'school_fee' | 'vehicle' | 'books';
  categoryLabel: string;
  assessedInr: DecimalInrString;
  collectedInr: DecimalInrString;
  outstandingInr: DecimalInrString;
}

export interface DashboardMetricsDTO {
  academicYearId: string;
  academicYearLabel: string;
  // Admission metrics
  totalApplications: number;
  applicationsByStatus: {
    draft: number;
    submitted: number;
    under_review: number;
    on_hold: number;
    approved: number;
    rejected: number;
    withdrawn: number;
  };
  totalAdmittedStudents: number;
  totalLeftStudents: number;
  // Capacity metrics
  totalSeatCapacity: number;
  totalSeatsUsed: number;
  totalSeatsAvailable: number;
  seatCapacityUtilizationPercentage: number;
  sectionsCapacity: SectionSeatMetricDTO[];
  // Financial metrics (restricted for non-financial roles)
  financials?: {
    totalFeeAssessedInr: DecimalInrString;
    totalFeeCollectedInr: DecimalInrString;
    totalOutstandingDuesInr: DecimalInrString;
    totalConcessionsApprovedInr: DecimalInrString;
    categories: CategoryFeeMetricDTO[];
  };
  // Certificate metrics
  certificates?: {
    total: number;
    draft: number;
    reviewed: number;
    issued: number;
    cancelled: number;
  };
}

export interface OutstandingDuesReportRowDTO {
  gradeLevelName: string;
  sectionName: string;
  totalStudents: number;
  totalAssessedInr: DecimalInrString;
  totalCollectedInr: DecimalInrString;
  totalDuesInr: DecimalInrString;
}
