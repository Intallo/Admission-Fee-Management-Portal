import { IDocumentsRepository } from '../interfaces';
import { runWithSessionOrSystem } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  DocumentRequirementDTO,
  DocumentTypeDTO,
  StudentDocumentDTO,
} from '../../../modules/documents/types';
import { NotFoundError } from '../../../lib/errors';
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
          `select id, code, name, description, mime_type_allowed, max_file_size_bytes
           from public.document_types
           order by name asc`
        );
        return res.rows.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description,
          mimeTypeAllowed: r.mime_type_allowed || ['application/pdf', 'image/jpeg', 'image/png'],
          maxFileSizeBytes: r.max_file_size_bytes || 5242880,
        }));
      },
      existingClient
    );
  }

  async listRequirements(
    gradeLevelId?: string,
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
        if (gradeLevelId) {
          sql += ` where r.grade_level_id = $1 or r.grade_level_id is null`;
          params.push(gradeLevelId);
        }
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
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const id = doc.id || randomUUID();
        const nowIso = new Date().toISOString();

        await client.query(
          `insert into public.student_documents (
             id, student_id, admission_application_id, document_type_id,
             storage_bucket, storage_object_key, original_filename, mime_type,
             file_size_bytes, verification_status, uploaded_by, uploaded_at,
             replaces_document_id
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            id,
            doc.studentId,
            doc.admissionApplicationId,
            doc.documentTypeId,
            doc.storageBucket || 'admission-documents',
            doc.storagePath,
            doc.fileName,
            doc.mimeType,
            doc.fileSizeBytes,
            doc.verificationStatus || 'pending',
            doc.uploadedBy,
            nowIso,
            doc.replacesDocumentId || null,
          ]
        );

        return this.getDocumentById(id, session, client);
      },
      existingClient
    );
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
        return {
          id: r.id,
          studentId: r.student_id,
          admissionApplicationId: r.admission_application_id,
          documentTypeId: r.document_type_id,
          documentTypeName: r.document_type_name,
          documentTypeCode: r.document_type_code,
          fileName: r.original_filename,
          fileSizeBytes: r.file_size_bytes,
          mimeType: r.mime_type,
          storageBucket: r.storage_bucket,
          storagePath: r.storage_object_key,
          verificationStatus: r.verification_status,
          replacesDocumentId: r.replaces_document_id,
          versionNumber: 1,
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
        return res.rows.map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          admissionApplicationId: r.admission_application_id,
          documentTypeId: r.document_type_id,
          documentTypeName: r.document_type_name,
          documentTypeCode: r.document_type_code,
          fileName: r.original_filename,
          fileSizeBytes: r.file_size_bytes,
          mimeType: r.mime_type,
          storageBucket: r.storage_bucket,
          storagePath: r.storage_object_key,
          verificationStatus: r.verification_status,
          replacesDocumentId: r.replaces_document_id,
          versionNumber: 1,
          uploadedBy: r.uploaded_by,
          uploadedAt: r.uploaded_at,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          rejectionReason: r.rejection_reason,
        }));
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
    return runWithSessionOrSystem(
      session,
      async (client) => {
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
      },
      existingClient
    );
  }
}
