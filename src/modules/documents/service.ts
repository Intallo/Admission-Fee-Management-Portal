import { randomUUID } from 'crypto';
import {
  DocumentTypeDTO,
  StudentDocumentDTO,
  DocumentRequirementDTO,
  ApplicationChecklistDTO,
  DocumentChecklistItemDTO,
  PresignedDownloadUrlResponseDTO,
  DocumentVerificationStatus,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import { AuthorizationError, BusinessRuleError, NotFoundError, ValidationError } from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { logger } from '../../lib/logger';
import { IDocumentsRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';
import { PostgresDocumentsRepository } from '../../infrastructure/repositories/postgres/documents.repository';
import { getAdminDbClient, resetAdminDbClient } from '../../infrastructure/db/supabase-admin';

// 5 MB max file size per SRS A-16 / PRIV-DOC-PDF-001
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export class DocumentsService {
  private customRepo?: IDocumentsRepository;

  constructor(customRepo?: IDocumentsRepository) {
    this.customRepo = customRepo;
  }

  private get repo(): IDocumentsRepository {
    return this.customRepo ?? getRepositories().documents;
  }

  isPostgres(): boolean {
    if (process.env.PERSISTENCE_MODE === 'postgres' || process.env.NODE_ENV === 'production') {
      return true;
    }
    return this.repo instanceof PostgresDocumentsRepository;
  }

  /**
   * Resets document state for isolated tests.
   */
  resetForTesting(): void {
    resetAdminDbClient();
    if (this.repo.resetForTesting) {
      this.repo.resetForTesting();
    }
  }

  /**
   * Lists active document types from the repository.
   */
  async listDocumentTypes(actorSession?: AuthenticatedUserSession): Promise<DocumentTypeDTO[]> {
    return this.repo.listDocumentTypes(actorSession);
  }

  /**
   * Lists requirements for an academic year and optional grade level from the repository.
   */
  async listRequirements(
    academicYearId: string,
    gradeLevelId?: string | null,
    actorSession?: AuthenticatedUserSession
  ): Promise<DocumentRequirementDTO[]> {
    return this.repo.listRequirements(academicYearId, gradeLevelId, actorSession);
  }

  /**
   * Generates a missing-document checklist for an admission application (US-11).
   * Fully backed by durable repository queries.
   */
  async getApplicationChecklist(
    applicationId: string,
    academicYearId: string,
    gradeLevelId: string,
    actorSession?: AuthenticatedUserSession
  ): Promise<ApplicationChecklistDTO> {
    const requirements = await this.listRequirements(academicYearId, gradeLevelId, actorSession);
    const allDocs = await this.repo.listDocumentsForApplication(applicationId, actorSession);

    const activeDocs = allDocs.filter((doc) => doc.verificationStatus !== 'replaced');

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

      const allForType = allDocs.filter((d) => d.documentTypeId === req.documentTypeId);

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
   * Uploads an admission document with strict MIME/size validation, storage upload,
   * rollback on failure, and version preservation.
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
    enforcePolicy(actorSession.role, 'documents:upload');

    if (!params.fileName || params.fileName.trim() === '') {
      throw new ValidationError('Document file name is required.');
    }

    if (!ALLOWED_MIME_TYPES.includes(params.mimeType.toLowerCase())) {
      throw new ValidationError(
        `Invalid document format: "${params.mimeType}". Only PDF, JPG, and PNG files are accepted.`
      );
    }

    if (params.fileSizeBytes <= 0 || params.fileSizeBytes > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size exceeds 5 MB limit. Provided file is ${(params.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB.`
      );
    }

    const docTypes = await this.repo.listDocumentTypes(actorSession);
    const docType = docTypes.find((t) => t.id === params.documentTypeId);
    if (!docType) {
      throw new NotFoundError(`Document type with ID "${params.documentTypeId}" not found.`);
    }

    if (docType.mimeTypeAllowed && !docType.mimeTypeAllowed.map((m: string) => m.toLowerCase()).includes(params.mimeType.toLowerCase())) {
      throw new ValidationError(
        `Invalid document format: "${params.mimeType}". Document type "${docType.name}" only allows ${docType.mimeTypeAllowed.join(', ')}.`
      );
    }

    if (docType.maxFileSizeBytes && params.fileSizeBytes > docType.maxFileSizeBytes) {
      throw new ValidationError(
        `File size exceeds limit for "${docType.name}". Limit is ${(docType.maxFileSizeBytes / (1024 * 1024)).toFixed(2)} MB.`
      );
    }

    const newDocId = randomUUID();
    const storageBucket = 'admission-documents';
    const storagePath = `applications/${params.admissionApplicationId}/${newDocId}-${params.fileName}`;

    let uploadedToStorage = false;
    if (params.fileBuffer) {
      try {
        const adminDb = getAdminDbClient();
        const { error } = await adminDb.storage
          .from(storageBucket)
          .upload(storagePath, params.fileBuffer, { contentType: params.mimeType, upsert: false });

        if (error) {
          throw new BusinessRuleError(`Failed to upload document binary to private storage: ${error.message}`);
        }
        uploadedToStorage = true;
      } catch (storageErr: any) {
        if (storageErr instanceof BusinessRuleError) {
          throw storageErr;
        }
        throw new BusinessRuleError(`Storage service unavailable: ${storageErr?.message || 'Upload connection failed'}`);
      }
    }

    let savedDoc: StudentDocumentDTO;
    try {
      savedDoc = await this.repo.saveDocument(
        {
          id: newDocId,
          studentId: params.studentId,
          admissionApplicationId: params.admissionApplicationId,
          documentTypeId: params.documentTypeId,
          documentTypeName: docType.name,
          documentTypeCode: docType.code,
          fileName: params.fileName,
          fileSizeBytes: params.fileSizeBytes,
          mimeType: params.mimeType,
          storageBucket,
          storagePath,
          verificationStatus: 'pending',
          uploadedBy: actorSession.staffId,
        },
        actorSession
      );
    } catch (saveError) {
      // Task 10: Delete uploaded binary data if metadata persistence fails
      if (uploadedToStorage) {
        try {
          const adminDb = getAdminDbClient();
          await adminDb.storage.from(storageBucket).remove([storagePath]);
        } catch (cleanupErr) {
          logger.error('Failed to cleanup orphaned storage file after metadata failure', {
            storagePath,
            error: cleanupErr,
          });
        }
      }
      throw saveError;
    }

    logger.info('Student admission document uploaded', {
      documentId: savedDoc.id,
      applicationId: params.admissionApplicationId,
      documentTypeCode: docType.code,
      versionNumber: savedDoc.versionNumber,
      replacesDocumentId: savedDoc.replacesDocumentId,
      actorStaffId: actorSession.staffId,
    });

    return savedDoc;
  }

  /**
   * Generates a real signed download URL from private storage.
   * Authorized: Principal and Admission Officer only.
   * Denied to Accountant and System Administrator.
   * Never falls back to fake synthetic URLs.
   */
  async generateDownloadUrl(
    documentId: string,
    actorSession: AuthenticatedUserSession,
    expectedScope?: { applicationId?: string; studentId?: string }
  ): Promise<PresignedDownloadUrlResponseDTO> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError(
        `Access Denied: Role "${actorSession.role}" is prohibited from viewing or downloading student admission documents.`
      );
    }

    const doc = await this.repo.getDocumentById(documentId, actorSession);
    if (!doc) {
      throw new NotFoundError(`Document with ID "${documentId}" not found.`);
    }

    // Task 13: Validate cross-student and cross-application access
    if (expectedScope?.applicationId && doc.admissionApplicationId && doc.admissionApplicationId !== expectedScope.applicationId) {
      throw new AuthorizationError('Access Denied: Document does not belong to the requested admission application.');
    }
    if (expectedScope?.studentId && doc.studentId !== expectedScope.studentId) {
      throw new AuthorizationError('Access Denied: Document does not belong to the requested student.');
    }

    const expiresInSeconds = 900; // Exactly 15 minutes (SRS PRIV-DOC-PDF-001)

    logger.info('Private document download accessed', {
      action: 'DOCUMENT_DOWNLOAD_ACCESSED',
      documentId,
      studentId: doc.studentId,
      actorStaffId: actorSession.staffId,
      actorRole: actorSession.role,
      expiresInSeconds,
    });

    const adminDb = getAdminDbClient();
    let result: any;
    try {
      result = await adminDb.storage
        .from(doc.storageBucket || 'admission-documents')
        .createSignedUrl(doc.storagePath, expiresInSeconds);
    } catch (err: any) {
      throw new BusinessRuleError(`Storage service unavailable: ${err?.message || 'Storage signing request failed'}`);
    }

    if (result.error || !result.data?.signedUrl) {
      throw new BusinessRuleError(
        `Failed to generate signed download URL: ${result.error?.message || 'Storage signing failed.'}`
      );
    }

    return {
      downloadUrl: result.data.signedUrl,
      fileName: doc.fileName,
      expiresInSeconds,
    };
  }

  /**
   * Retrieves single document metadata by ID.
   */
  async getDocumentById(
    documentId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view document details.');
    }
    return this.repo.getDocumentById(documentId, actorSession);
  }

  /**
   * Lists application documents with role protection.
   */
  async listApplicationDocuments(
    applicationId: string,
    actorSession: AuthenticatedUserSession,
    includeReplaced = false
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view application documents.');
    }
    const docs = await this.repo.listDocumentsForApplication(applicationId, actorSession);
    if (includeReplaced) return docs;
    return docs.filter((d) => d.verificationStatus !== 'replaced');
  }

  /**
   * Lists student documents with role protection.
   */
  async listDocumentsForStudent(
    studentId: string,
    actorSession: AuthenticatedUserSession,
    includeReplaced = false
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view student documents.');
    }
    const docs = this.repo.listDocumentsForStudent
      ? await this.repo.listDocumentsForStudent(studentId, actorSession)
      : await this.repo.listDocumentsForApplication(studentId, actorSession);

    if (includeReplaced) return docs;
    return docs.filter((d) => d.verificationStatus !== 'replaced');
  }

  /**
   * Retrieves complete version history for a document.
   */
  async getDocumentVersions(
    documentId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO[]> {
    if (actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may view document version history.');
    }

    if (this.repo.getDocumentVersions) {
      return this.repo.getDocumentVersions(documentId, actorSession);
    }

    const currentDoc = await this.repo.getDocumentById(documentId, actorSession);
    return [currentDoc];
  }

  /**
   * Verifies or rejects an uploaded document.
   */
  async verifyDocument(
    documentId: string,
    status: DocumentVerificationStatus,
    reason?: string,
    actorSession?: AuthenticatedUserSession
  ): Promise<StudentDocumentDTO> {
    if (actorSession && actorSession.role !== 'principal' && actorSession.role !== 'admission_officer') {
      throw new AuthorizationError('Access Denied: Only Principal and Admission Officers may verify documents.');
    }
    return this.repo.verifyDocument(documentId, status, reason, actorSession);
  }
}

export const documentsService = new DocumentsService();
