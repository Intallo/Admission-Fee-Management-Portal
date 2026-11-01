import { IDocumentsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  DocumentRequirementDTO,
  DocumentTypeDTO,
  StudentDocumentDTO,
} from '../../../modules/documents/types';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class InMemoryDocumentsRepository implements IDocumentsRepository {
  private documentTypesVault: DocumentTypeDTO[] = [
    { id: '10000000-0000-0000-0000-000000000001', code: 'BIRTH_CERTIFICATE', name: 'Birth Certificate', description: 'Mandatory proof of date of birth.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000002', code: 'STUDENT_PHOTOGRAPH', name: 'Student Photograph', description: 'Recent passport-size photograph.', mimeTypeAllowed: ['image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000003', code: 'PARENT_ID_PROOF', name: 'Parent/Guardian ID Proof', description: 'Aadhaar, Voter ID, or Passport of primary guardian.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000004', code: 'PREVIOUS_SCHOOL_TC', name: 'Previous School Transfer Certificate', description: 'Required for Grade 1 and above.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000005', code: 'PREVIOUS_MARKSHEET', name: 'Previous School Marksheet', description: 'Academic marks card from prior recognized institution.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
  ];

  private requirementsVault: DocumentRequirementDTO[] = [];
  private studentDocumentsVault = new Map<string, StudentDocumentDTO>();

  resetForTesting(): void {
    this.studentDocumentsVault.clear();
  }

  async listDocumentTypes(_session?: AuthenticatedUserSession): Promise<DocumentTypeDTO[]> {
    return [...this.documentTypesVault];
  }

  async listRequirements(gradeLevelId?: string, _session?: AuthenticatedUserSession): Promise<DocumentRequirementDTO[]> {
    if (gradeLevelId) {
      return this.requirementsVault.filter((r) => r.gradeLevelId === gradeLevelId);
    }
    return [...this.requirementsVault];
  }

  async saveDocument(doc: any, _session?: AuthenticatedUserSession): Promise<StudentDocumentDTO> {
    const id = doc.id || randomUUID();
    const type = this.documentTypesVault.find((t) => t.id === doc.documentTypeId);
    const saved: StudentDocumentDTO = {
      id,
      studentId: doc.studentId,
      admissionApplicationId: doc.admissionApplicationId,
      documentTypeId: doc.documentTypeId,
      documentTypeName: type ? type.name : 'Document',
      documentTypeCode: type ? type.code : 'DOC',
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      mimeType: doc.mimeType,
      storageBucket: doc.storageBucket || 'admission-documents',
      storagePath: doc.storagePath,
      verificationStatus: doc.verificationStatus || 'pending',
      replacesDocumentId: doc.replacesDocumentId || null,
      versionNumber: doc.versionNumber || 1,
      uploadedBy: doc.uploadedBy,
      uploadedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    };
    this.studentDocumentsVault.set(id, saved);
    return saved;
  }

  async getDocumentById(documentId: string, _session?: AuthenticatedUserSession): Promise<StudentDocumentDTO> {
    const found = this.studentDocumentsVault.get(documentId);
    if (!found) {
      throw new NotFoundError(`Document with ID "${documentId}" not found.`);
    }
    return found;
  }

  async listDocumentsForApplication(
    applicationId: string,
    _session?: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO[]> {
    return Array.from(this.studentDocumentsVault.values()).filter(
      (d) => d.admissionApplicationId === applicationId
    );
  }

  async verifyDocument(
    documentId: string,
    status: string,
    reason?: string,
    session?: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO> {
    const found = this.studentDocumentsVault.get(documentId);
    if (!found) {
      throw new NotFoundError(`Document "${documentId}" not found.`);
    }
    found.verificationStatus = status as any;
    found.reviewedBy = session ? session.staffId : null;
    found.reviewedAt = new Date().toISOString();
    found.rejectionReason = reason || null;
    return found;
  }
}
