/**
 * School Admission & Fee Management Portal
 * Module: Student Records & Lifecycle (Module 8)
 */

import { UUID, AdmissionNumber, IsoTimestampString, DecimalInrString } from '../shared/types';
import { Database } from '../../types/database.types';

export type StudentYearStatus = Database['public']['Enums']['student_year_status']; // 'admitted' | 'active' | 'left' | 'transferred' | 'withdrawn'

export interface StudentProfileSummaryDTO {
  id: UUID;
  studentAcademicRecordId: UUID;
  admissionNumber: AdmissionNumber;
  stsNumber: string | null;
  diseNumber: string | null;
  fullName: string;
  gradeLevelName: string;
  sectionName: string;
  academicYearLabel: string;
  status: StudentYearStatus;
  primaryGuardianName: string;
  primaryGuardianMobile: string;
}

export interface StudentSensitiveDetailsDTO {
  studentId: UUID;
  aadhaarNumberMasked: string; // e.g. "XXXX-XXXX-1234" (Full decrypted number accessible only to Principal/ADM)
  householdIncomeInr: DecimalInrString | null;
  casteCategory: string | null;
  subCaste: string | null;
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
  updatedBy: UUID;
  updatedAt: IsoTimestampString;
}
