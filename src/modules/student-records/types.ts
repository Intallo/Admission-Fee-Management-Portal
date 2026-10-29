/**
 * School Admission & Fee Management Portal
 * Module: Student Records & Lifecycle (Module 8)
 */

import { UUID, AdmissionNumber, IsoTimestampString, DecimalInrString } from '../shared/types';
import { Database } from '../../types/database.types';
import { GuardianDetailsDTO, StudentDemographicsDTO } from '../admissions/types';
import { StudentFeeSummaryDTO } from '../fees-ledger/types';
import { ReceiptDTO } from '../receipts/types';

export type StudentYearStatus = Database['public']['Enums']['student_year_status']; // 'admitted' | 'active' | 'left' | 'transferred' | 'withdrawn'

export interface StudentSearchFilterDTO {
  search?: string;
  academicYearId?: string;
  gradeLevelId?: string;
  sectionId?: string;
  status?: StudentYearStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface StudentSearchItemDTO {
  id: UUID;
  studentAcademicRecordId: UUID;
  academicYearId: UUID;
  academicYearLabel: string;
  admissionNumber: AdmissionNumber;
  stsNumber: string | null;
  diseNumber: string | null;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  gradeLevelId: UUID;
  gradeLevelName: string;
  sectionId: UUID;
  sectionName: string;
  status: StudentYearStatus;
  primaryGuardianName: string;
  primaryGuardianMobile: string;
  transportOptedIn: boolean;
}

export interface StudentSensitiveDetailsDTO {
  studentId: UUID;
  aadhaarNumberMasked: string; // e.g. "••••-••••-1234" (Full unmasked number accessible only to Principal/ADM)
  aadhaarNumberUnmasked?: string; // only returned to Principal / ADM if decrypted
  householdIncomeInr: DecimalInrString | null;
  casteCategory: string | null;
  subCaste: string | null;
  religion?: string | null;
  motherTongue?: string | null;
}

export interface StudentStatusHistoryItemDTO {
  id: UUID;
  academicRecordId: UUID;
  previousStatus: StudentYearStatus;
  newStatus: StudentYearStatus;
  effectiveDate: string;
  reason: string;
  changedByStaffId: UUID;
  changedByStaffName: string;
  createdAt: IsoTimestampString;
}

export interface StudentAcademicRecordHistoryDTO {
  academicRecordId: UUID;
  academicYearId: UUID;
  academicYearLabel: string;
  gradeLevelName: string;
  sectionName: string;
  admissionNumber: string;
  admissionDate: string;
  status: StudentYearStatus;
  rollNumber: string | null;
  transportOptedIn: boolean;
  notes: string | null;
}

export interface StudentCertificateSummaryDTO {
  id: UUID;
  certificateType: 'LC' | 'TC';
  certificateNumber: string | null;
  status: 'draft' | 'issued' | 'cancelled';
  reviewStatus?: 'pending' | 'reviewed' | 'returned';
  issuedAt: string | null;
}

export interface StudentProfileDTO {
  studentId: UUID;
  demographics: StudentDemographicsDTO;
  guardians: GuardianDetailsDTO[];
  currentAcademicRecord: StudentAcademicRecordHistoryDTO;
  academicHistory: StudentAcademicRecordHistoryDTO[];
  statusHistory: StudentStatusHistoryItemDTO[];
  sensitiveDetails: StudentSensitiveDetailsDTO | null; // null if unauthorized
  documents: Array<{
    id: UUID;
    documentTypeCode: string;
    documentTypeName: string;
    verificationStatus: string;
    versionNumber: number;
    createdAt: string;
  }> | null; // null if unauthorized
  feeSummary: StudentFeeSummaryDTO | null; // null if unauthorized
  receipts: ReceiptDTO[] | null; // null if unauthorized
  certificates: StudentCertificateSummaryDTO[];
}

export interface MarkStudentStatusRequestDTO {
  academicRecordId: UUID;
  newStatus: 'left' | 'transferred' | 'withdrawn';
  exitDate: string; // YYYY-MM-DD
  exitReason: string;
}

export interface MarkStudentStatusResultDTO {
  academicRecordId: UUID;
  studentId: UUID;
  previousStatus: StudentYearStatus;
  newStatus: StudentYearStatus;
  exitDate: string;
  exitReason: string;
  updatedBy: UUID;
  updatedAt: IsoTimestampString;
}
