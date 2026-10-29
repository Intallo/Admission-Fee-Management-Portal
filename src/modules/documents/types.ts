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
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageBucket: string;
  storagePath: string;
  verificationStatus: DocumentVerificationStatus;
  verifiedBy: UUID | null;
  verifiedAt: IsoTimestampString | null;
  uploadedAt: IsoTimestampString;
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
