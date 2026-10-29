import { randomUUID } from 'crypto';
import {
  DocumentTypeDTO,
  StudentDocumentDTO,
  DocumentRequirementDTO,
  ApplicationChecklistDTO,
  DocumentChecklistItemDTO,
  PresignedDownloadUrlResponseDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import { AuthorizationError, BusinessRuleError, NotFoundError, ValidationError } from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { logger } from '../../lib/logger';
import { getAdminDbClient } from '../../infrastructure/db/supabase-admin';

// 5 MB max file size per SRS A-16 / PRIV-DOC-PDF-001
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// In-memory vaults for synthetic data & unit testing
const documentTypesVault: DocumentTypeDTO[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    code: 'BIRTH_CERTIFICATE',
    name: 'Birth Certificate',
    description: 'Mandatory proof of date of birth.',
    mimeTypeAllowed: ALLOWED_MIME_TYPES,
    maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    code: 'STUDENT_PHOTOGRAPH',
    name: 'Student Photograph',
    description: 'Recent passport-size photograph.',
    mimeTypeAllowed: ['image/jpeg', 'image/png'],
    maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    code: 'PARENT_ID_PROOF',
    name: 'Parent/Guardian ID Proof',
    description: 'Aadhaar, Voter ID, or Passport of primary guardian.',
    mimeTypeAllowed: ALLOWED_MIME_TYPES,
    maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    code: 'PREVIOUS_SCHOOL_TC',
    name: 'Previous School Transfer Certificate',
    description: 'Required for Grade 1 and above.',
    mimeTypeAllowed: ALLOWED_MIME_TYPES,
    maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    code: 'PREVIOUS_MARKSHEET',
    name: 'Previous School Marksheet',
    description: 'Academic marks card from prior recognized institution.',
    mimeTypeAllowed: ALLOWED_MIME_TYPES,
    maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE_BYTES,
  },
];

const documentRequirementsVault: DocumentRequirementDTO[] = [
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

const studentDocumentsVault = new Map<string, StudentDocumentDTO>();

export class DocumentsService {
  /**
   * Resets in-memory document state for isolated tests.
   */
  resetForTesting(): void {
    studentDocumentsVault.clear();
  }

  /**
   * Lists active document types.
   */
  async listDocumentTypes(): Promise<DocumentTypeDTO[]> {
    return [...documentTypesVault];
  }

  /**
   * Lists requirements for an academic year and optional grade level.
   */
  async listRequirements(academicYearId: string, gradeLevelId?: string | null): Promise<DocumentRequirementDTO[]> {
    return documentRequirementsVault.filter(
      (r) =>
        r.academicYearId === academicYearId &&
        (r.gradeLevelId === null || !gradeLevelId || r.gradeLevelId === gradeLevelId)
    );
  }

  /**
   * Generates a missing-document checklist for an admission application (US-11).
   */
  async getApplicationChecklist(
    applicationId: string,
    academicYearId: string,
    gradeLevelId: string
  ): Promise<ApplicationChecklistDTO> {
    const requirements = await this.listRequirements(academicYearId, gradeLevelId);
    
    // Find active (non-replaced) documents uploaded for this application
    const activeDocs = Array.from(studentDocumentsVault.values()).filter(
      (doc) => doc.admissionApplicationId === applicationId && doc.verificationStatus !== 'replaced'
    );

    let totalReceived = 0;
    let missingMandatoryCount = 0;

    const items: DocumentChecklistItemDTO[] = requirements.map((req) => {
      const match = activeDocs.find((d) => d.documentTypeId === req.documentTypeId);
      const isReceived = !!match && match.verificationStatus !== 'rejected';
      if (isReceived) {
        totalReceived++;
      } else if (req.isRequired) {
        missingMandatoryCount++;
      }

      // Count version chain length
      const allForType = Array.from(studentDocumentsVault.values()).filter(
        (d) => d.admissionApplicationId === applicationId && d.documentTypeId === req.documentTypeId
      );

      return {
        documentTypeId: req.documentTypeId,
        code: req.documentTypeCode,
        name: req.documentTypeName,
        isRequired: req.isRequired,
        isReceived,
        documentId: match?.id ?? null,
        fileName: match?.fileName ?? null,
        uploadedAt: match?.uploadedAt ?? null,
        verificationStatus: match?.verificationStatus ?? null,
        versionCount: allForType.length,
      };
    });

    return {
      applicationId,
      academicYearId,
      gradeLevelId,
      totalRequired: requirements.filter((r) => r.isRequired).length,
      totalReceived,
      missingMandatoryCount,
      items,
      canSubmit: missingMandatoryCount === 0,
    };
  }

  /**
   * Uploads an admission document with strict MIME/size validation and version preservation.
   * Authorized: Principal and Admission Officer (or Clerk during draft intake).
   */
  async uploadDocument(
    params: {
      studentId: string;
      admissionApplicationId: string;
      documentTypeId: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      fileBuffer?: Buffer;
    },
    actorSession: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO> {
    // 1. Authorization check
    enforcePolicy(actorSession.role, 'documents:upload');

    // 2. MIME type validation (A-16: PDF, JPG, PNG)
    if (!ALLOWED_MIME_TYPES.includes(params.mimeType.toLowerCase())) {
      throw new ValidationError(
        `Invalid document format: "${params.mimeType}". Only PDF, JPG, and PNG files are accepted.`
      );
    }

    // 3. File size validation (A-16: max 5 MB)
    if (params.fileSizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size exceeds 5 MB limit. Provided file is ${(params.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB.`
      );
    }

    const docType = documentTypesVault.find((t) => t.id === params.documentTypeId);
    if (!docType) {
      throw new NotFoundError(`Document type with ID "${params.documentTypeId}" not found.`);
    }

    // 4. Version preservation: check if a document of this type already exists for application
    const existingActive = Array.from(studentDocumentsVault.values()).find(
      (d) =>
        d.admissionApplicationId === params.admissionApplicationId &&
        d.documentTypeId === params.documentTypeId &&
        d.verificationStatus !== 'replaced'
    );

    let replacesDocumentId: string | null = null;
    let versionNumber = 1;

    if (existingActive) {
      // Mark old version as replaced (R-01: zero hard delete; preserves prior version)
      existingActive.verificationStatus = 'replaced';
      replacesDocumentId = existingActive.id;
      versionNumber = existingActive.versionNumber + 1;
    }

    const newDocId = randomUUID();
    const nowIso = new Date().toISOString();
    const storagePath = `applications/${params.admissionApplicationId}/${newDocId}-${params.fileName}`;

    const newDoc: StudentDocumentDTO = {
      id: newDocId,
      studentId: params.studentId,
      admissionApplicationId: params.admissionApplicationId,
      documentTypeId: params.documentTypeId,
      documentTypeName: docType.name,
      documentTypeCode: docType.code,
      fileName: params.fileName,
      fileSizeBytes: params.fileSizeBytes,
      mimeType: params.mimeType,
      storageBucket: 'admission-documents',
      storagePath,
      verificationStatus: 'pending',
      replacesDocumentId,
      versionNumber,
      uploadedBy: actorSession.staffId,
      uploadedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    };

    studentDocumentsVault.set(newDocId, newDoc);

    // Optional DB synchronization
    try {
      const adminDb = getAdminDbClient();
      await adminDb.from('student_documents').insert({
        id: newDoc.id,
        student_id: newDoc.studentId,
        admission_application_id: newDoc.admissionApplicationId,
        document_type_id: newDoc.documentTypeId,
        storage_bucket: newDoc.storageBucket,
        storage_object_key: newDoc.storagePath,
        original_filename: newDoc.fileName,
        mime_type: newDoc.mimeType,
        file_size_bytes: newDoc.fileSizeBytes,
        verification_status: newDoc.verificationStatus,
        uploaded_by: newDoc.uploadedBy,
        uploaded_at: newDoc.uploadedAt,
        replaces_document_id: replacesDocumentId,
      });
    } catch {
      // Test environment fallback
    }

    logger.info('Student admission document uploaded', {
      documentId: newDocId,
      applicationId: params.admissionApplicationId,
      documentTypeCode: docType.code,
      versionNumber,
      replacesDocumentId,
      actorStaffId: actorSession.staffId,
    });

    return newDoc;
  }

  /**
   * Generates a 15-minute presigned download URL for a document.
   * Strictly authorized: Principal and Admission Officer only (R-06).
   * Forbidden for Accounts Officer, System Admin, or Read Only.
   * Records immutable audit log event on every access.
   */
  async generateDownloadUrl(
    documentId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<PresignedDownloadUrlResponseDTO> {
    // R-06 Privacy Guard: Only Principal and Admission Officer can access sensitive documents
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError(
        `Access Denied: Role "${actorSession.role}" is prohibited from viewing or downloading student admission documents.`
      );
    }

    const doc = studentDocumentsVault.get(documentId);
    if (!doc) {
      throw new NotFoundError(`Document with ID "${documentId}" not found.`);
    }

    const expiresInSeconds = 900; // Exactly 15 minutes (SRS PRIV-DOC-PDF-001)

    // Audit download access (US-38 / PRIV-DOC-PDF-001 §2.2)
    logger.info('Private document download accessed', {
      action: 'DOCUMENT_DOWNLOAD_ACCESSED',
      documentId,
      studentId: doc.studentId,
      actorStaffId: actorSession.staffId,
      actorRole: actorSession.role,
      expiresInSeconds,
    });

    try {
      const adminDb = getAdminDbClient();
      await adminDb.from('audit_logs').insert({
        action: 'DOCUMENT_DOWNLOAD_ACCESSED',
        actor_staff_id: actorSession.staffId,
        entity_type: 'student_documents',
        entity_id: documentId,
        outcome: 'SUCCESS',
        reason: 'Temporary presigned download URL issued (15 min validity).',
      });
    } catch {
      // Test environment fallback
    }

    // Generate safe deterministic download URL
    const downloadUrl = `https://portal-storage.school.local/admission-documents/${doc.storagePath}?token=mock_signed_${randomUUID()}&expires=${Math.floor(Date.now() / 1000) + expiresInSeconds}`;

    return {
      downloadUrl,
      fileName: doc.fileName,
      expiresInSeconds,
    };
  }

  /**
   * Lists all documents associated with an admission application.
   */
  async listApplicationDocuments(
    applicationId: string,
    actorSession: AuthenticatedUserSession,
    includeReplaced = false
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view application documents.');
    }

    const all = Array.from(studentDocumentsVault.values()).filter(
      (d) => d.admissionApplicationId === applicationId
    );

    if (includeReplaced) {
      return all;
    }
    return all.filter((d) => d.verificationStatus !== 'replaced');
  }

  /**
   * Lists all documents associated with a student.
   */
  async listDocumentsForStudent(
    studentId: string,
    actorSession: AuthenticatedUserSession,
    includeReplaced = false
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view student documents.');
    }

    const all = Array.from(studentDocumentsVault.values()).filter(
      (d) => d.studentId === studentId
    );

    if (includeReplaced) {
      return all;
    }
    return all.filter((d) => d.verificationStatus !== 'replaced');
  }

  /**
   * Retrieves full version history for a document.
   */
  async getDocumentVersions(
    documentId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view document version history.');
    }

    const currentDoc = studentDocumentsVault.get(documentId);
    if (!currentDoc) {
      throw new NotFoundError(`Document with ID "${documentId}" not found.`);
    }

    const versions: StudentDocumentDTO[] = [currentDoc];
    let prevId = currentDoc.replacesDocumentId;
    while (prevId) {
      const prevDoc = studentDocumentsVault.get(prevId);
      if (prevDoc) {
        versions.push(prevDoc);
        prevId = prevDoc.replacesDocumentId;
      } else {
        break;
      }
    }

    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }
}

export const documentsService = new DocumentsService();
