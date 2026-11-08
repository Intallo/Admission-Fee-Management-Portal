import { IDocumentsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  DocumentRequirementDTO,
  DocumentTypeDTO,
  StudentDocumentDTO,
} from '../../../modules/documents/types';
import { BusinessRuleError, NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class InMemoryDocumentsRepository implements IDocumentsRepository {
  private documentTypesVault: DocumentTypeDTO[] = [
    { id: '10000000-0000-0000-0000-000000000001', code: 'BIRTH_CERTIFICATE', name: 'Birth Certificate', description: 'Mandatory proof of date of birth.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000002', code: 'STUDENT_PHOTOGRAPH', name: 'Student Photograph', description: 'Recent passport-size photograph.', mimeTypeAllowed: ['image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000003', code: 'PARENT_ID_PROOF', name: 'Parent/Guardian ID Proof', description: 'Aadhaar, Voter ID, or Passport of primary guardian.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000004', code: 'PREVIOUS_SCHOOL_TC', name: 'Previous School Transfer Certificate', description: 'Required for Grade 1 and above.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
    { id: '10000000-0000-0000-0000-000000000005', code: 'PREVIOUS_MARKSHEET', name: 'Previous School Marksheet', description: 'Academic marks card from prior recognized institution.', mimeTypeAllowed: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5242880 },
  ];

  private requirementsVault: DocumentRequirementDTO[] = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      academicYearId: '00000000-0000-0000-0000-000000000001',
      gradeLevelId: null,
      documentTypeId: '10000000-0000-0000-0000-000000000001',
      documentTypeCode: 'BIRTH_CERTIFICATE',
      documentTypeName: 'Birth Certificate',
      isRequired: true,
      appliesToNewAdmission: true,
      notes: 'Mandatory for all new admissions.',
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      academicYearId: '00000000-0000-0000-0000-000000000001',
      gradeLevelId: null,
      documentTypeId: '10000000-0000-0000-0000-000000000002',
      documentTypeCode: 'STUDENT_PHOTOGRAPH',
      documentTypeName: 'Student Photograph',
      isRequired: true,
      appliesToNewAdmission: true,
      notes: 'Mandatory photo on student profile.',
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      academicYearId: '00000000-0000-0000-0000-000000000001',
      gradeLevelId: null,
      documentTypeId: '10000000-0000-0000-0000-000000000003',
      documentTypeCode: 'PARENT_ID_PROOF',
      documentTypeName: 'Parent/Guardian ID Proof',
      isRequired: false,
      appliesToNewAdmission: true,
      notes: 'Optional supporting identity proof.',
    },
  ];

  private studentDocumentsVault = new Map<string, StudentDocumentDTO>();

  resetForTesting(): void {
    this.studentDocumentsVault.clear();
  }

  async listDocumentTypes(_session?: AuthenticatedUserSession): Promise<DocumentTypeDTO[]> {
    return [...this.documentTypesVault];
  }

  async getDocumentTypeById(id: string, _session?: AuthenticatedUserSession): Promise<DocumentTypeDTO> {
    const found = this.documentTypesVault.find((t) => t.id === id);
    if (!found) {
      throw new NotFoundError(`Document type with ID "${id}" not found.`);
    }
    return found;
  }

  async listRequirements(
    academicYearId?: string,
    gradeLevelId?: string | null,
    _session?: AuthenticatedUserSession
  ): Promise<DocumentRequirementDTO[]> {
    return this.requirementsVault.filter((r) => {
      if (academicYearId && r.academicYearId !== academicYearId) {
        return false;
      }
      if (gradeLevelId && r.gradeLevelId !== null && r.gradeLevelId !== gradeLevelId) {
        return false;
      }
      return true;
    });
  }

  async saveDocument(doc: any, _session?: AuthenticatedUserSession): Promise<StudentDocumentDTO> {
    const id = doc.id || randomUUID();
    const type = this.documentTypesVault.find((t) => t.id === (doc.documentTypeId || doc.document_type_id)) ||
                 this.documentTypesVault.find((t) => t.code === doc.documentTypeCode);

    const studentId = doc.studentId || doc.student_id;
    const applicationId = doc.admissionApplicationId || doc.applicationId || doc.admission_application_id;

    // Validate cross-student access if application is specified
    if (applicationId && studentId) {
      for (const existing of this.studentDocumentsVault.values()) {
        if (existing.admissionApplicationId === applicationId && existing.studentId !== studentId) {
          throw new BusinessRuleError("Document student does not match the admission application's student");
        }
      }
    }

    const documentTypeId = type ? type.id : doc.documentTypeId;

    // Check for existing active document to replace
    let replacesDocumentId = doc.replacesDocumentId || null;
    let versionNumber = doc.versionNumber || 1;

    const existingActive = Array.from(this.studentDocumentsVault.values()).find(
      (d) =>
        ((applicationId && d.admissionApplicationId === applicationId) ||
         (!applicationId && studentId && d.studentId === studentId)) &&
        d.documentTypeId === documentTypeId &&
        d.verificationStatus !== 'replaced'
    );

    if (existingActive) {
      existingActive.verificationStatus = 'replaced';
      replacesDocumentId = existingActive.id;
      versionNumber = (existingActive.versionNumber || 1) + 1;
    }

    const saved: StudentDocumentDTO = {
      id,
      studentId,
      admissionApplicationId: applicationId || null,
      documentTypeId,
      documentTypeName: type ? type.name : 'Document',
      documentTypeCode: type ? type.code : 'DOC',
      fileName: doc.fileName || doc.originalFileName || 'document.pdf',
      fileSizeBytes: doc.fileSizeBytes || 0,
      mimeType: doc.mimeType || 'application/pdf',
      storageBucket: doc.storageBucket || 'admission-documents',
      storagePath: doc.storagePath || `applications/${applicationId}/${id}-${doc.fileName}`,
      verificationStatus: doc.verificationStatus || 'pending',
      replacesDocumentId,
      versionNumber,
      uploadedBy: doc.uploadedBy || null,
      uploadedAt: doc.uploadedAt || new Date().toISOString(),
      reviewedBy: doc.reviewedBy || null,
      reviewedAt: doc.reviewedAt || null,
      rejectionReason: doc.rejectionReason || null,
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
      (d) => d.admissionApplicationId === applicationId || d.studentId === applicationId
    );
  }

  async listDocumentsForStudent(
    studentId: string,
    _session?: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO[]> {
    return Array.from(this.studentDocumentsVault.values()).filter(
      (d) => d.studentId === studentId
    );
  }

  async getDocumentVersions(
    documentId: string,
    _session?: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO[]> {
    const currentDoc = this.studentDocumentsVault.get(documentId);
    if (!currentDoc) {
      throw new NotFoundError(`Document with ID "${documentId}" not found.`);
    }

    const allForType = Array.from(this.studentDocumentsVault.values()).filter(
      (d) =>
        ((currentDoc.admissionApplicationId && d.admissionApplicationId === currentDoc.admissionApplicationId) ||
         (!currentDoc.admissionApplicationId && d.studentId === currentDoc.studentId)) &&
        d.documentTypeId === currentDoc.documentTypeId
    );

    return allForType.sort((a, b) => b.versionNumber - a.versionNumber);
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
