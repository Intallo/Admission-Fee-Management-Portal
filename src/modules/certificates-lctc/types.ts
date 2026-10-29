/**
 * School Admission & Fee Management Portal
 * Module: Leaving & Transfer Certificates (Module 9)
 */

import { UUID, CertificateNumber, IsoTimestampString } from '../shared/types';
import { Database } from '../../types/database.types';

export type CertificateKind = Database['public']['Enums']['certificate_kind'];   // 'LC' | 'TC'
export type CertificateState = Database['public']['Enums']['certificate_state']; // 'draft' | 'issued' | 'cancelled'

export interface CertificateSummaryDTO {
  id: UUID;
  studentAcademicRecordId: UUID;
  studentName: string;
  admissionNumber: string;
  standard: string;
  academicYear: string;
  certificateType: CertificateKind;
  certificateNumber: CertificateNumber | null;
  status: CertificateState;
  generatedBy: UUID | null;
  approvedBy: UUID | null;
  issuedAt: IsoTimestampString | null;
}

export interface IssueCertificateRequestDTO {
  reasonForLeaving: string;
  conduct: string;
  progress: string;
  remarks?: string;
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

export interface ReprintCertificateResultDTO {
  certificateId: UUID;
  certificateNumber: CertificateNumber;
  newVersionNumber: number;
  reason: string;
  reprintedAt: IsoTimestampString;
  pdfDownloadUrl: string;
}
