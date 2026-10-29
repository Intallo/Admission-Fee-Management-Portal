/**
 * School Admission & Fee Management Portal
 * Module: Leaving & Transfer Certificates (Module 9)
 */

import { UUID, CertificateNumber, IsoTimestampString, DecimalInrString } from '../shared/types';
import { Database } from '../../types/database.types';

export type CertificateKind = Database['public']['Enums']['certificate_kind'];   // 'LC' | 'TC'
export type CertificateState = Database['public']['Enums']['certificate_state']; // 'draft' | 'issued' | 'cancelled'
export type CertificateReviewStatus = 'pending' | 'reviewed' | 'returned';

export interface CertificateContentSnapshotDTO {
  schoolName: string;
  certificateType: CertificateKind;
  certificateNumber: CertificateNumber;
  academicYearLabel: string;
  studentName: string;
  admissionNumber: string;
  admissionDate: string;
  stsNumber: string | null;
  gender: string;
  dateOfBirth: string;
  dateOfBirthInWords: string;
  placeOfBirth: string | null;
  fatherName: string;
  motherName: string;
  nationality: string;
  religion: string | null;
  caste: string | null;
  subCaste: string | null;
  standardStudied: string;
  lastClassStudied: string;
  previousSchoolAttended: string | null;
  dateOfLeaving: string;
  reasonForLeaving: string;
  conduct: string;
  progress: string;
  feeDuesStatus: 'cleared' | 'dues_pending_with_override';
  feeDuesAmountInr: DecimalInrString;
  duesOverrideReason?: string | null;
  remarks?: string | null;
  issueDate: string;
  signatories: {
    clerkSignatureLine: string;
    admissionOfficerSignatureLine: string;
    principalSignatureLine: string;
  };
}

export interface CertificateVersionDTO {
  id: UUID;
  studentYearCertificateId: UUID;
  versionNumber: number;
  contentSnapshot: CertificateContentSnapshotDTO;
  templateVersion: string;
  pdfStorageBucket: string | null;
  pdfStorageObjectKey: string | null;
  issueOrReissueReason: string | null;
  generatedBy: UUID | null;
  approvedBy: UUID | null;
  isDuplicate: boolean;
  duplicateLabel?: string | null;
  generatedAt: IsoTimestampString;
}

export interface StudentCertificateDTO {
  id: UUID;
  studentAcademicRecordId: UUID;
  studentId: UUID;
  studentName: string;
  admissionNumber: string;
  gradeLevelId: UUID;
  gradeLevelName: string;
  sectionId: UUID;
  sectionName: string;
  academicYearId: UUID;
  academicYearLabel: string;
  certificateType: CertificateKind;
  certificateNumber: CertificateNumber | null;
  status: CertificateState;
  reviewStatus: CertificateReviewStatus;
  reviewedBy: UUID | null;
  reviewedByName?: string | null;
  reviewedAt: IsoTimestampString | null;
  reviewRemarks?: string | null;
  conduct: string;
  progress: string;
  reasonForLeaving: string;
  dateOfLeaving: string;
  intendedSchool?: string | null;
  unpaidBalanceInr: DecimalInrString;
  duesOverrideReason?: string | null;
  generatedBy: UUID | null;
  approvedBy: UUID | null;
  approvedByName?: string | null;
  issuedAt: IsoTimestampString | null;
  versions: CertificateVersionDTO[];
  createdAt: IsoTimestampString;
  updatedAt: IsoTimestampString;
}

export interface RequestCertificateRequestDTO {
  studentAcademicRecordId: UUID;
  certificateType?: CertificateKind; // Defaults to 'TC'
  reasonForLeaving: string;
  dateOfLeaving?: string; // YYYY-MM-DD
  intendedSchool?: string;
  conduct?: string;
  progress?: string;
  remarks?: string;
}

export interface ReviewCertificateRequestDTO {
  action: 'forward_for_approval' | 'return_to_draft';
  conduct: string;
  progress: string;
  remarks?: string;
}

export interface IssueCertificateRequestDTO {
  reasonForLeaving?: string;
  dateOfLeaving?: string;
  conduct?: string;
  progress?: string;
  remarks?: string;
  duesOverrideReason?: string;
}

export interface IssueCertificateResultDTO {
  certificateId: UUID;
  certificateNumber: CertificateNumber;
  certificateType: CertificateKind;
  status: 'issued';
  versionNumber: number;
  studentName: string;
  approvedBy: UUID;
  issuedAt: IsoTimestampString;
  pdfStorageKey: string;
}

export interface ReprintCertificateRequestDTO {
  reason: string;
}

export interface ReprintCertificateResultDTO {
  certificateId: UUID;
  certificateNumber: CertificateNumber;
  newVersionNumber: number;
  reason: string;
  reprintedAt: IsoTimestampString;
  pdfDownloadUrl: string;
}

export interface CertificateFilterDTO {
  academicYearId?: string;
  gradeLevelId?: string;
  sectionId?: string;
  status?: CertificateState | 'all';
  reviewStatus?: CertificateReviewStatus | 'all';
  search?: string;
  studentId?: string;
  limit?: number;
  offset?: number;
}
