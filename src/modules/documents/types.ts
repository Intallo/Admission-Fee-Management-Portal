/**
 * School Admission & Fee Management Portal
 * Module: Private Documents & Storage (Module 3 & Shared)
 */

import { UUID, IsoTimestampString } from '../shared/types';
import { Database } from '../../types/database.types';

export type DocumentVerificationStatus = Database['public']['Enums']['document_verification_status'];

export interface DocumentTypeDTO {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  mimeTypeAllowed: string[];
  maxFileSizeBytes: number;
}

export interface StudentDocumentDTO {
  id: UUID;
  studentId: UUID;
  admissionApplicationId: UUID | null;
  documentTypeId: UUID;
  documentTypeName: string;
  documentTypeCode: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageBucket: string;
  storagePath: string;
  verificationStatus: DocumentVerificationStatus;
  replacesDocumentId: UUID | null;
  versionNumber: number;
  uploadedBy: UUID | null;
  uploadedAt: IsoTimestampString;
  reviewedBy: UUID | null;
  reviewedAt: IsoTimestampString | null;
  rejectionReason: string | null;
}

export interface DocumentRequirementDTO {
  id: UUID;
  academicYearId: UUID;
  gradeLevelId: UUID | null;
  documentTypeId: UUID;
  documentTypeCode: string;
  documentTypeName: string;
  isRequired: boolean;
  appliesToNewAdmission: boolean;
  notes: string | null;
}

export interface DocumentChecklistItemDTO {
  documentTypeId: UUID;
  code: string;
  name: string;
  isRequired: boolean;
  isReceived: boolean;
  documentId: UUID | null;
  fileName: string | null;
  uploadedAt: IsoTimestampString | null;
  verificationStatus: DocumentVerificationStatus | null;
  versionCount: number;
}

export interface ApplicationChecklistDTO {
  applicationId: UUID;
  academicYearId: UUID;
  gradeLevelId: UUID;
  totalRequired: number;
  totalReceived: number;
  missingMandatoryCount: number;
  items: DocumentChecklistItemDTO[];
  canSubmit: boolean;
}

export interface RequestPresignedUploadUrlDTO {
  studentId: UUID;
  admissionApplicationId?: UUID;
  documentTypeId: UUID;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface PresignedUploadUrlResponseDTO {
  uploadUrl: string;
  storagePath: string;
  expiresInSeconds: number; // 900 seconds
}

export interface PresignedDownloadUrlResponseDTO {
  downloadUrl: string;
  fileName: string;
  expiresInSeconds: number; // 900 seconds
}
