/**
 * School Admission & Fee Management Portal
 * Module: Admissions Intake & Verification (Module 3)
 */

import { UUID, ApplicationNumber, AdmissionNumber, IsoTimestampString, DecimalInrString } from '../shared/types';
import { Database } from '../../types/database.types';
import { ApplicationChecklistDTO } from '../documents/types';

export type AdmissionApplicationStatus = Database['public']['Enums']['admission_application_status'];
export type GradeGroup = Database['public']['Enums']['grade_group'];

export interface AdmissionApplicationSummaryDTO {
  id: UUID;
  applicationNumber: ApplicationNumber | null;
  academicYearId: UUID;
  academicYearLabel: string;
  gradeLevelId: UUID;
  gradeLevelName: string;
  sectionId?: UUID | null;
  sectionName?: string | null;
  studentId: UUID;
  studentName: string;
  stsNumber?: string | null;
  status: AdmissionApplicationStatus;
  submissionDate: string | null;
  missingDocumentsCount: number;
  feeGenerated: boolean;
  createdAt: IsoTimestampString;
  updatedAt: IsoTimestampString;
}

export interface StudentDemographicsDTO {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  religion?: string;
  placeOfBirth?: string;
  nationality?: string;
  motherTongue?: string;
  stsNumber?: string;
  diseNumber?: string;
  previousSchoolName?: string;
  previousSchoolTcNumber?: string;
  previousClass?: string;
  transportMode?: 'School Bus' | 'Public' | 'Private' | 'Walking';
  transportOptedIn?: boolean;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface StudentSensitiveDetailsDTO {
  aadhaarNumber?: string;
  aadhaarLastFour?: string | null;
  caste?: string | null;
  casteCategory?: string | null;
  subCaste?: string | null;
  annualFamilyIncome?: DecimalInrString | null;
  householdIncomeInr?: DecimalInrString | null;
  casteCertificateNumber?: string | null;
  incomeCertificateNumber?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
}

export interface GuardianDetailsDTO {
  id?: UUID;
  relationship: string;
  fullName: string;
  mobileNumber: string;
  alternateMobileNumber?: string;
  email?: string;
  occupation?: string;
  annualIncomeInr?: DecimalInrString;
  residentialAddress?: string;
  isPrimaryContact: boolean;
  canCollectStudent?: boolean;
}

export interface AdmissionStatusHistoryItemDTO {
  id: UUID;
  fromStatus: AdmissionApplicationStatus | null;
  toStatus: AdmissionApplicationStatus;
  changedBy: UUID | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  reason: string | null;
  changedAt: IsoTimestampString;
}

export interface SectionCapacityDTO {
  sectionId: UUID;
  sectionName: string;
  gradeLevelId: UUID;
  gradeLevelName: string;
  gradeGroup: GradeGroup;
  enrolledInSection: number;
  sectionMaxCapacity: number;
  availableInSection: number;
  enrolledInGroup: number;
  groupMaxCapacity: number;
  availableInGroup: number;
  isCapacityAvailable: boolean;
}

export interface CapacityPolicyConfig {
  mode: 'section_only' | 'division_group_only' | 'dual_enforcement';
  defaultSectionCapacity: number; // default 40
  divisionGroupCapacity: number;  // default 100 per SRS §3 A-08
}

export interface AdmissionApplicationDetailDTO {
  id: UUID;
  applicationNumber: ApplicationNumber | null;
  academicYearId: UUID;
  academicYearLabel: string;
  requestedGradeLevelId: UUID;
  requestedGradeLevelName: string;
  requestedSectionId: UUID | null;
  requestedSectionName: string | null;
  status: AdmissionApplicationStatus;
  studentId: UUID;
  student: StudentDemographicsDTO;
  sensitiveDetails?: StudentSensitiveDetailsDTO | null; // Omitted or masked for unauthorized roles
  guardians: GuardianDetailsDTO[];
  checklist: ApplicationChecklistDTO;
  capacity?: SectionCapacityDTO | null;
  statusHistory: AdmissionStatusHistoryItemDTO[];
  decisionReason: string | null;
  seatReservedUntil: string | null;
  feeGenerated: boolean;
  submittedAt: IsoTimestampString | null;
  reviewedAt: IsoTimestampString | null;
  reviewedBy: UUID | null;
  createdBy: UUID | null;
  createdAt: IsoTimestampString;
  updatedAt: IsoTimestampString;
}

export interface CreateAdmissionDraftDTO {
  academicYearId: UUID;
  gradeLevelId: UUID;
  requestedSectionId?: UUID | null;
  applicationDate?: string; // YYYY-MM-DD, defaults to today
  student: StudentDemographicsDTO;
  sensitiveDetails?: StudentSensitiveDetailsDTO;
  guardians: GuardianDetailsDTO[];
}

export interface UpdateAdmissionDraftDTO {
  gradeLevelId?: UUID;
  requestedSectionId?: UUID | null;
  student?: Partial<StudentDemographicsDTO>;
  sensitiveDetails?: Partial<StudentSensitiveDetailsDTO>;
  guardians?: GuardianDetailsDTO[];
}

export interface SubmitApplicationRequestDTO {
  overrideMissingDocumentsReason?: string;
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
  initialAssessmentId: UUID | null;
  initialBilledAmountInr: DecimalInrString;
  feeGenerated: boolean;
}

export interface RejectAdmissionRequestDTO {
  reason: string;
}

export interface HoldAdmissionRequestDTO {
  reason: string;
  seatReservedUntil?: string; // ISO date
}

export interface ReturnToDraftRequestDTO {
  reason: string;
}

export interface ApplicationListFilterDTO {
  academicYearId?: UUID;
  status?: AdmissionApplicationStatus;
  gradeLevelId?: UUID;
  sectionId?: UUID;
  search?: string;
  feeNotGenerated?: boolean;
}

export interface ApplicationStatusCountsDTO {
  draftCount: number;
  submittedCount: number;
  underReviewCount: number;
  onHoldCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

export type AdmissionStatusCountsDTO = ApplicationStatusCountsDTO;

export interface ApplicationListResponseDTO {
  items: AdmissionApplicationSummaryDTO[];
  counts: ApplicationStatusCountsDTO;
}
