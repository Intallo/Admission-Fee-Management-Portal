/**
 * School Admission & Fee Management Portal
 * Module: Audit Trail & Reporting (Module 10)
 */

import { UUID, IsoTimestampString, DecimalInrString } from '../shared/types';

export interface AuditLogEntryDTO {
  id: UUID;
  actorStaffId: UUID | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: UUID | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  outcome: 'success' | 'failure';
  reason: string | null;
  createdAt: IsoTimestampString;
}

export interface DashboardMetricsDTO {
  academicYearLabel: string;
  totalAdmittedStudents: number;
  totalPendingApplications: number;
  seatCapacityUtilizationPercentage: number;
  totalFeeAssessedInr: DecimalInrString;
  totalFeeCollectedInr: DecimalInrString;
  totalOutstandingDuesInr: DecimalInrString;
  totalConcessionsApprovedInr: DecimalInrString;
}

export interface OutstandingDuesReportRowDTO {
  gradeLevelName: string;
  sectionName: string;
  totalStudents: number;
  totalAssessedInr: DecimalInrString;
  totalCollectedInr: DecimalInrString;
  totalDuesInr: DecimalInrString;
}
