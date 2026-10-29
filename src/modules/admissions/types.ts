/**
 * School Admission & Fee Management Portal
 * Module: Admissions Intake & Verification (Module 3)
 */

import { UUID, ApplicationNumber, AdmissionNumber, IsoTimestampString, DecimalInrString } from '../shared/types';
import { Database } from '../../types/database.types';

export type AdmissionApplicationStatus = Database['public']['Enums']['admission_application_status'];

export interface AdmissionApplicationSummaryDTO {
  id: UUID;
  applicationNumber: ApplicationNumber | null;
  academicYearId: UUID;
  gradeLevelId: UUID;
  studentName: string;
  status: AdmissionApplicationStatus;
  submissionDate: string | null;
  missingDocumentsCount: number;
  createdAt: IsoTimestampString;
}

export interface StudentDemographicsDTO {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
  motherTongue?: string;
  bloodGroup?: string;
  religion?: string;
  stsNumber?: string;
  diseNumber?: string;
}

export interface GuardianDetailsDTO {
  relationship: string;
  fullName: string;
  mobileNumber: string;
  email?: string;
  occupation?: string;
  annualIncomeInr?: DecimalInrString;
  residentialAddress: string;
  isPrimaryContact: boolean;
}

export interface CreateAdmissionDraftDTO {
  academicYearId: UUID;
  gradeLevelId: UUID;
  student: StudentDemographicsDTO;
  guardians: GuardianDetailsDTO[];
}

export interface ApproveAdmissionRequestDTO {
  sectionId: UUID;
  remarks?: string;
}

export interface ApproveAdmissionResultDTO {
  applicationId: UUID;
  applicationNumber: ApplicationNumber;
  admissionNumber: AdmissionNumber;
  studentId: UUID;
  studentAcademicRecordId: UUID;
  sectionId: UUID;
  status: 'approved';
  approvedBy: UUID;
  approvedAt: IsoTimestampString;
  initialAssessmentId: UUID;
  initialBilledAmountInr: DecimalInrString;
}
