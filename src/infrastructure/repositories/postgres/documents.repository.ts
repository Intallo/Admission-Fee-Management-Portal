import { IDocumentsRepository } from '../interfaces';
import { runWithSessionOrSystem, withTransaction } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  DocumentRequirementDTO,
  DocumentTypeDTO,
  StudentDocumentDTO,
} from '../../../modules/documents/types';
import { BusinessRuleError, NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class PostgresDocumentsRepository implements IDocumentsRepository {
  async listDocumentTypes(
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<DocumentTypeDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select id, code, name, description, is_active
           from public.document_types
           where is_active = true
           order by name asc`
        );
        return res.rows.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          mimeTypeAllowed: r.code === 'STUDENT_PHOTOGRAPH'
            ? ['image/jpeg', 'image/png']
            : ['application/pdf', 'image/jpeg', 'image/png'],
          maxFileSizeBytes: 5242880,
        }));
      },
      existingClient
    );
  }

  async getDocumentTypeById(
    id: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<DocumentTypeDTO> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select id, code, name, description, is_active
           from public.document_types
           where id = $1`,
          [id]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Document type with ID "${id}" not found.`);
        }
        const r = res.rows[0];
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          mimeTypeAllowed: r.code === 'STUDENT_PHOTOGRAPH'
            ? ['image/jpeg', 'image/png']
            : ['application/pdf', 'image/jpeg', 'image/png'],
          maxFileSizeBytes: 5242880,
        };
      },
      existingClient
    );
  }

  async listRequirements(
    academicYearId?: string,
    gradeLevelId?: string | null,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<DocumentRequirementDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        let sql = `select r.id, r.academic_year_id, r.grade_level_id, r.document_type_id,
                          r.is_required, r.applies_to_new_admission, r.notes,
                          dt.code as document_type_code, dt.name as document_type_name
                   from public.document_requirements r
                   join public.document_types dt on dt.id = r.document_type_id`;
        const params: any[] = [];
        const conditions: string[] = [];

        if (academicYearId) {
          params.push(academicYearId);
          conditions.push(`r.academic_year_id = $${params.length}`);
        }

        if (gradeLevelId) {
          params.push(gradeLevelId);
          conditions.push(`(r.grade_level_id = $${params.length} or r.grade_level_id is null)`);
        }

        if (conditions.length > 0) {
          sql += ` where ` + conditions.join(' and ');
        }
        sql += ` order by r.is_required desc, dt.name asc`;

        const res = await client.query(sql, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          academicYearId: r.academic_year_id,
          gradeLevelId: r.grade_level_id || null,
          documentTypeId: r.document_type_id,
          documentTypeCode: r.document_type_code,
          documentTypeName: r.document_type_name,
          isRequired: r.is_required,
          appliesToNewAdmission: r.applies_to_new_admission,
          notes: r.notes || null,
        }));
      },
      existingClient
    );
  }

  async saveDocument(
    doc: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO> {
    const runInTx = async (client: PoolClient) => {
        const id = doc.id || randomUUID();
        const nowIso = new Date().toISOString();
        const studentId = doc.studentId || doc.student_id;
        const applicationId = doc.admissionApplicationId || doc.applicationId || doc.admission_application_id || null;

        // Task 13: Validate cross-student access if application is provided
        if (applicationId && studentId) {
          const appRes = await client.query(
            `select id, student_id from public.admission_applications where id = $1`,
            [applicationId]
          );
          if (appRes.rowCount && appRes.rowCount > 0) {
            const appRow = appRes.rows[0];
            if (appRow.student_id && appRow.student_id !== studentId) {
              throw new BusinessRuleError("Document student does not match the admission application's student");
            }
          }
        }

        // Resolve documentTypeId if code was passed
        let documentTypeId = doc.documentTypeId || doc.document_type_id;
        if (!documentTypeId && doc.documentTypeCode) {
          const dtRes = await client.query(
            `select id from public.document_types where code = $1`,
            [doc.documentTypeCode]
          );
          if (dtRes.rowCount && dtRes.rowCount > 0) {
            documentTypeId = dtRes.rows[0].id;
          }
        }

        // Task 6 & 7: Query for existing active document to replace
        let replacesDocumentId = doc.replacesDocumentId || null;
        if (documentTypeId && (applicationId || studentId)) {
          const existingRes = await client.query(
            `select id, replaces_document_id, verification_status
             from public.student_documents
             where (admission_application_id = $1 or ($1 is null and student_id = $2))
               and document_type_id = $3
               and verification_status <> 'replaced'
             order by uploaded_at desc
             limit 1
             for update`,
            [applicationId, studentId, documentTypeId]
          );

          if (existingRes.rowCount && existingRes.rowCount > 0) {
            const existingRow = existingRes.rows[0];
            replacesDocumentId = existingRow.id;
            await client.query(
              `update public.student_documents
               set verification_status = 'replaced'
               where id = $1`,
              [existingRow.id]
            );
          }
        }

        const fileName = doc.fileName || doc.originalFileName || doc.original_filename || 'document.pdf';
        const storagePath = doc.storagePath || doc.storage_object_key || `applications/${applicationId || studentId}/${id}-${fileName}`;
        const mimeType = doc.mimeType || doc.mime_type || 'application/pdf';
        const fileSizeBytes = doc.fileSizeBytes || doc.file_size_bytes || 0;
        const verificationStatus = doc.verificationStatus || doc.verification_status || 'pending';
        const uploadedBy = doc.uploadedBy || doc.uploaded_by || (session ? session.staffId : null);

        await client.query(
          `insert into public.student_documents (
             id, student_id, admission_application_id, document_type_id,
             storage_bucket, storage_object_key, original_filename, mime_type,
             file_size_bytes, verification_status, uploaded_by, uploaded_at,
             replaces_document_id
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            id,
            studentId,
            applicationId,
            documentTypeId,
            doc.storageBucket || doc.storage_bucket || 'admission-documents',
            storagePath,
            fileName,
            mimeType,
            fileSizeBytes,
            verificationStatus,
            uploadedBy,
            nowIso,
            replacesDocumentId,
          ]
        );

        return this.getDocumentById(id, session, client);
    };

    if (session) {
      return withTransaction(session, runInTx, existingClient);
    }
    return runWithSessionOrSystem(session, runInTx, existingClient);
  }

  async getDocumentById(
    documentId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select d.id, d.student_id, d.admission_application_id, d.document_type_id,
                  d.storage_bucket, d.storage_object_key, d.original_filename, d.mime_type,
                  d.file_size_bytes, d.verification_status, d.uploaded_by, d.uploaded_at,
                  d.replaces_document_id, d.reviewed_by, d.reviewed_at, d.rejection_reason,
                  dt.name as document_type_name, dt.code as document_type_code
           from public.student_documents d
           join public.document_types dt on dt.id = d.document_type_id
           where d.id = $1`,
          [documentId]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Document with ID "${documentId}" not found.`);
        }
        const r = res.rows[0];

        // Compute version number by following replaces_document_id chain
        let versionNumber = 1;
        let currentReplacesId = r.replaces_document_id;
        while (currentReplacesId) {
          versionNumber++;
          const prevRes = await client.query(
            `select replaces_document_id from public.student_documents where id = $1`,
            [currentReplacesId]
          );
          if (!prevRes.rowCount || prevRes.rowCount === 0) break;
          currentReplacesId = prevRes.rows[0].replaces_document_id;
        }

        return {
          id: r.id,
          studentId: r.student_id,
          admissionApplicationId: r.admission_application_id,
          documentTypeId: r.document_type_id,
          documentTypeName: r.document_type_name,
          documentTypeCode: r.document_type_code,
          fileName: r.original_filename,
          fileSizeBytes: Number(r.file_size_bytes || 0),
          mimeType: r.mime_type,
          storageBucket: r.storage_bucket,
          storagePath: r.storage_object_key,
          verificationStatus: r.verification_status,
          replacesDocumentId: r.replaces_document_id,
          versionNumber,
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          rejectionReason: r.rejection_reason,
        };
      },
      existingClient
    );
  }

  async listDocumentsForApplication(
    applicationId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select d.id, d.student_id, d.admission_application_id, d.document_type_id,
                  d.storage_bucket, d.storage_object_key, d.original_filename, d.mime_type,
                  d.file_size_bytes, d.verification_status, d.uploaded_by, d.uploaded_at,
                  d.replaces_document_id, d.reviewed_by, d.reviewed_at, d.rejection_reason,
                  dt.name as document_type_name, dt.code as document_type_code
           from public.student_documents d
           join public.document_types dt on dt.id = d.document_type_id
           where d.admission_application_id = $1 or d.student_id = $1
           order by d.uploaded_at asc`,
          [applicationId]
        );

        // Group rows by document_type_id to compute sequential version numbers accurately
        const typeVersions = new Map<string, number>();

        return res.rows.map((r: any) => {
          const currentCount = (typeVersions.get(r.document_type_id) || 0) + 1;
          typeVersions.set(r.document_type_id, currentCount);

          return {
            id: r.id,
            studentId: r.student_id,
            admissionApplicationId: r.admission_application_id,
            documentTypeId: r.document_type_id,
            documentTypeName: r.document_type_name,
            documentTypeCode: r.document_type_code,
            fileName: r.original_filename,
            fileSizeBytes: Number(r.file_size_bytes || 0),
            mimeType: r.mime_type,
            storageBucket: r.storage_bucket,
            storagePath: r.storage_object_key,
            verificationStatus: r.verification_status,
            replacesDocumentId: r.replaces_document_id,
            versionNumber: currentCount,
            uploadedBy: r.uploaded_by,
            uploadedAt: r.uploaded_at,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            rejectionReason: r.rejection_reason,
          };
        });
      },
      existingClient
    );
  }

  async listDocumentsForStudent(
    studentId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select d.id, d.student_id, d.admission_application_id, d.document_type_id,
                  d.storage_bucket, d.storage_object_key, d.original_filename, d.mime_type,
                  d.file_size_bytes, d.verification_status, d.uploaded_by, d.uploaded_at,
                  d.replaces_document_id, d.reviewed_by, d.reviewed_at, d.rejection_reason,
                  dt.name as document_type_name, dt.code as document_type_code
           from public.student_documents d
           join public.document_types dt on dt.id = d.document_type_id
           where d.student_id = $1
           order by d.uploaded_at asc`,
          [studentId]
        );

        const typeVersions = new Map<string, number>();

        return res.rows.map((r: any) => {
          const currentCount = (typeVersions.get(r.document_type_id) || 0) + 1;
          typeVersions.set(r.document_type_id, currentCount);

          return {
            id: r.id,
            studentId: r.student_id,
            admissionApplicationId: r.admission_application_id,
            documentTypeId: r.document_type_id,
            documentTypeName: r.document_type_name,
            documentTypeCode: r.document_type_code,
            fileName: r.original_filename,
            fileSizeBytes: Number(r.file_size_bytes || 0),
            mimeType: r.mime_type,
            storageBucket: r.storage_bucket,
            storagePath: r.storage_object_key,
            verificationStatus: r.verification_status,
            replacesDocumentId: r.replaces_document_id,
            versionNumber: currentCount,
            uploadedBy: r.uploaded_by,
            uploadedAt: r.uploaded_at,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            rejectionReason: r.rejection_reason,
          };
        });
      },
      existingClient
    );
  }

  async getDocumentVersions(
    documentId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const currentDoc = await this.getDocumentById(documentId, session, client);

        const res = await client.query(
          `select d.id, d.student_id, d.admission_application_id, d.document_type_id,
                  d.storage_bucket, d.storage_object_key, d.original_filename, d.mime_type,
                  d.file_size_bytes, d.verification_status, d.uploaded_by, d.uploaded_at,
                  d.replaces_document_id, d.reviewed_by, d.reviewed_at, d.rejection_reason,
                  dt.name as document_type_name, dt.code as document_type_code
           from public.student_documents d
           join public.document_types dt on dt.id = d.document_type_id
           where (
             (d.admission_application_id is not null and d.admission_application_id = $1)
             or (d.admission_application_id is null and d.student_id = $2)
           )
           and d.document_type_id = $3
           order by d.uploaded_at asc`,
          [currentDoc.admissionApplicationId, currentDoc.studentId, currentDoc.documentTypeId]
        );

        let vCounter = 0;
        const allVersions = res.rows.map((r: any) => {
          vCounter++;
          return {
            id: r.id,
            studentId: r.student_id,
            admissionApplicationId: r.admission_application_id,
            documentTypeId: r.document_type_id,
            documentTypeName: r.document_type_name,
            documentTypeCode: r.document_type_code,
            fileName: r.original_filename,
            fileSizeBytes: Number(r.file_size_bytes || 0),
            mimeType: r.mime_type,
            storageBucket: r.storage_bucket,
            storagePath: r.storage_object_key,
            verificationStatus: r.verification_status,
            replacesDocumentId: r.replaces_document_id,
            versionNumber: vCounter,
            uploadedBy: r.uploaded_by,
            uploadedAt: r.uploaded_at,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            rejectionReason: r.rejection_reason,
          };
        });

        // Return latest version first
        return allVersions.sort((a, b) => b.versionNumber - a.versionNumber);
      },
      existingClient
    );
  }

  async verifyDocument(
    documentId: string,
    status: string,
    reason?: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentDocumentDTO> {
    const runInTx = async (client: PoolClient) => {
        const nowIso = new Date().toISOString();
        const staffId = session ? session.staffId : null;
        const res = await client.query(
          `update public.student_documents
           set verification_status = $1, reviewed_by = $2, reviewed_at = $3, rejection_reason = $4
           where id = $5
           returning id`,
          [status, staffId, nowIso, reason || null, documentId]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Document "${documentId}" not found.`);
        }
        return this.getDocumentById(documentId, session, client);
    };

    if (session) {
      return withTransaction(session, runInTx, existingClient);
    }
    return runWithSessionOrSystem(session, runInTx, existingClient);
  }
}
