import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { DocumentsService, documentsService, MAX_DOCUMENT_FILE_SIZE_BYTES } from '../src/modules/documents/service';
import { PostgresDocumentsRepository } from '../src/infrastructure/repositories/postgres/documents.repository';
import { InMemoryDocumentsRepository } from '../src/infrastructure/repositories/in-memory/documents.repository';
import { setPostgresPoolForTesting, closePostgresPool } from '../src/infrastructure/db/postgres-pool';
import {
  setAdminDbClientForTesting,
  resetAdminDbClient,
  MockStorageBucket,
} from '../src/infrastructure/db/supabase-admin';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { AuthorizationError, BusinessRuleError, NotFoundError, ValidationError } from '../src/lib/errors';
import { randomUUID } from 'crypto';

describe('Milestone M8.3.8 — Document Management and Storage Integrity', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: 'auth-principal',
    email: 'principal@school-demo.example',
    fullName: 'Principal Administrator',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: 'auth-admissions',
    email: 'admissions@school-demo.example',
    fullName: 'Admissions Officer',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: 'auth-accountant',
    email: 'accounts@school-demo.example',
    fullName: 'Accounts Officer',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const systemAdminSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: 'auth-admin',
    email: 'sysadmin@school-demo.example',
    fullName: 'System Admin',
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const clerkSession: AuthenticatedUserSession = {
    staffId: '55555555-5555-5555-5555-555555555555',
    authUserId: 'auth-clerk',
    email: 'clerk@school-demo.example',
    fullName: 'Intake Clerk',
    role: 'clerk',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const gradeLevelId = '30000000-0000-0000-0000-000000000004';
  const birthCertTypeId = '10000000-0000-0000-0000-000000000001';
  const photoTypeId = '10000000-0000-0000-0000-000000000002';
  const parentIdTypeId = '10000000-0000-0000-0000-000000000003';

  // In-memory relational tables for Postgres repository testing
  let dbTables: {
    document_types: any[];
    document_requirements: any[];
    student_documents: any[];
    admission_applications: any[];
    students: any[];
  };

  let mockStorage: MockStorageBucket;

  function createSimulatedPostgresClient(): PoolClient {
    return {
      query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        const trimmed = sql.trim().replace(/\s+/g, ' ');

        if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK' || trimmed === 'RESET ALL') {
          return { rows: [], rowCount: 0 };
        }
        if (trimmed.includes('set_config')) {
          return { rows: [{ set_config: '' }], rowCount: 1 };
        }

        // 1. List document types
        if (trimmed.includes('from public.document_types') && trimmed.includes('where is_active = true')) {
          const rows = dbTables.document_types.filter((dt) => dt.is_active);
          return { rows, rowCount: rows.length };
        }

        // Document type by id
        if (trimmed.includes('from public.document_types where id = $1')) {
          const dt = dbTables.document_types.find((t) => t.id === params[0]);
          return { rows: dt ? [dt] : [], rowCount: dt ? 1 : 0 };
        }

        // Document type by code
        if (trimmed.includes('from public.document_types where code = $1')) {
          const dt = dbTables.document_types.find((t) => t.code === params[0]);
          return { rows: dt ? [dt] : [], rowCount: dt ? 1 : 0 };
        }

        // 2. List document requirements
        if (trimmed.includes('from public.document_requirements r') && trimmed.includes('join public.document_types dt')) {
          let rows = dbTables.document_requirements.map((req) => {
            const dt = dbTables.document_types.find((t) => t.id === req.document_type_id);
            return {
              id: req.id,
              academic_year_id: req.academic_year_id,
              grade_level_id: req.grade_level_id,
              document_type_id: req.document_type_id,
              is_required: req.is_required,
              applies_to_new_admission: req.applies_to_new_admission,
              notes: req.notes,
              document_type_code: dt?.code || 'DOC',
              document_type_name: dt?.name || 'Document',
            };
          });

          if (params.length > 0 && params[0]) {
            rows = rows.filter((r) => r.academic_year_id === params[0]);
          }
          if (params.length > 1 && params[1]) {
            rows = rows.filter((r) => r.grade_level_id === params[1] || r.grade_level_id === null);
          }

          return { rows, rowCount: rows.length };
        }

        // Admission application check
        if (trimmed.includes('select id, student_id from public.admission_applications where id = $1')) {
          const app = dbTables.admission_applications.find((a) => a.id === params[0]);
          return { rows: app ? [app] : [], rowCount: app ? 1 : 0 };
        }

        // Find existing active document for replacement
        if (trimmed.includes('from public.student_documents') && trimmed.includes("verification_status <> 'replaced'") && trimmed.includes('for update')) {
          const appId = params[0];
          const studentId = params[1];
          const docTypeId = params[2];

          const active = dbTables.student_documents.find(
            (d) =>
              ((appId && d.admission_application_id === appId) || (!appId && studentId && d.student_id === studentId)) &&
              d.document_type_id === docTypeId &&
              d.verification_status !== 'replaced'
          );

          return { rows: active ? [active] : [], rowCount: active ? 1 : 0 };
        }

        // Update verification_status = 'replaced'
        if (trimmed.startsWith('update public.student_documents') && trimmed.includes("verification_status = 'replaced'")) {
          const targetId = params[0];
          const target = dbTables.student_documents.find((d) => d.id === targetId);
          if (target) {
            target.verification_status = 'replaced';
          }
          return { rows: [], rowCount: target ? 1 : 0 };
        }

        // Verify document update
        if (trimmed.startsWith('update public.student_documents') && trimmed.includes('set verification_status = $1')) {
          const [status, reviewedBy, reviewedAt, reason, docId] = params;
          const target = dbTables.student_documents.find((d) => d.id === docId);
          if (target) {
            target.verification_status = status;
            target.reviewed_by = reviewedBy;
            target.reviewed_at = reviewedAt;
            target.rejection_reason = reason;
            return { rows: [{ id: docId }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // Insert new document
        if (trimmed.startsWith('insert into public.student_documents')) {
          const newDoc = {
            id: params[0],
            student_id: params[1],
            admission_application_id: params[2],
            document_type_id: params[3],
            storage_bucket: params[4],
            storage_object_key: params[5],
            original_filename: params[6],
            mime_type: params[7],
            file_size_bytes: params[8],
            verification_status: params[9],
            uploaded_by: params[10],
            uploaded_at: params[11],
            replaces_document_id: params[12],
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          };
          dbTables.student_documents.push(newDoc);
          return { rows: [], rowCount: 1 };
        }

        // Get document by ID
        if (trimmed.includes('from public.student_documents d') && trimmed.includes('where d.id = $1')) {
          const d = dbTables.student_documents.find((x) => x.id === params[0]);
          if (!d) return { rows: [], rowCount: 0 };
          const dt = dbTables.document_types.find((t) => t.id === d.document_type_id);
          return {
            rows: [
              {
                ...d,
                document_type_name: dt?.name || 'Document',
                document_type_code: dt?.code || 'DOC',
              },
            ],
            rowCount: 1,
          };
        }

        // Replaces document id query
        if (trimmed === 'select replaces_document_id from public.student_documents where id = $1') {
          const d = dbTables.student_documents.find((x) => x.id === params[0]);
          return {
            rows: d ? [{ replaces_document_id: d.replaces_document_id }] : [],
            rowCount: d ? 1 : 0,
          };
        }

        // List documents for application or student
        if (trimmed.includes('from public.student_documents d') && (trimmed.includes('where d.admission_application_id = $1 or d.student_id = $1') || trimmed.includes('where d.student_id = $1'))) {
          const target = params[0];
          const matched = dbTables.student_documents
            .filter((d) => d.admission_application_id === target || d.student_id === target)
            .sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
            .map((d) => {
              const dt = dbTables.document_types.find((t) => t.id === d.document_type_id);
              return {
                ...d,
                document_type_name: dt?.name || 'Document',
                document_type_code: dt?.code || 'DOC',
              };
            });
          return { rows: matched, rowCount: matched.length };
        }

        // Get document versions
        if (trimmed.includes('from public.student_documents d') && trimmed.includes('order by d.uploaded_at asc')) {
          const [appId, studentId, docTypeId] = params;
          const matched = dbTables.student_documents
            .filter(
              (d) =>
                ((appId && d.admission_application_id === appId) || (!appId && studentId && d.student_id === studentId)) &&
                d.document_type_id === docTypeId
            )
            .sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
            .map((d) => {
              const dt = dbTables.document_types.find((t) => t.id === d.document_type_id);
              return {
                ...d,
                document_type_name: dt?.name || 'Document',
                document_type_code: dt?.code || 'DOC',
              };
            });
          return { rows: matched, rowCount: matched.length };
        }

        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
  }

  beforeEach(() => {
    resetAdminDbClient();
    closePostgresPool();
    documentsService.resetForTesting();

    mockStorage = new MockStorageBucket();
    setAdminDbClientForTesting({
      storage: {
        from: (_bucket: string) => mockStorage,
        getBucket: (_bucket: string) => mockStorage,
      },
    });

    dbTables = {
      document_types: [
        { id: birthCertTypeId, code: 'BIRTH_CERTIFICATE', name: 'Birth Certificate', description: 'Mandatory DOB proof', is_active: true },
        { id: photoTypeId, code: 'STUDENT_PHOTOGRAPH', name: 'Student Photograph', description: 'Passport photograph', is_active: true },
        { id: parentIdTypeId, code: 'PARENT_ID_PROOF', name: 'Parent/Guardian ID Proof', description: 'Aadhaar / Voter ID', is_active: true },
      ],
      document_requirements: [
        { id: '20000000-0000-0000-0000-000000000001', academic_year_id: academicYearId, grade_level_id: null, document_type_id: birthCertTypeId, is_required: true, applies_to_new_admission: true, notes: 'Mandatory' },
        { id: '20000000-0000-0000-0000-000000000002', academic_year_id: academicYearId, grade_level_id: null, document_type_id: photoTypeId, is_required: true, applies_to_new_admission: true, notes: 'Mandatory photo' },
        { id: '20000000-0000-0000-0000-000000000003', academic_year_id: academicYearId, grade_level_id: null, document_type_id: parentIdTypeId, is_required: false, applies_to_new_admission: true, notes: 'Optional ID' },
      ],
      student_documents: [],
      admission_applications: [
        { id: 'app-valid-001', student_id: 'student-valid-001', academic_year_id: academicYearId, grade_level_id: gradeLevelId },
        { id: 'app-other-002', student_id: 'student-other-002', academic_year_id: academicYearId, grade_level_id: gradeLevelId },
      ],
      students: [
        { id: 'student-valid-001', first_name: 'Aarav', last_name: 'Sharma' },
        { id: 'student-other-002', first_name: 'Diya', last_name: 'Patel' },
      ],
    };

    const mockPool = {
      connect: vi.fn().mockImplementation(async () => createSimulatedPostgresClient()),
      on: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    setPostgresPoolForTesting(mockPool);
  });

  // ----------------------------------------------------------------------------
  // 1. Document Types & Requirements Retrieval
  // ----------------------------------------------------------------------------
  describe('1. Document Types & Requirements Retrieval from Database', () => {
    it('retrieves active document types from PostgreSQL repository', async () => {
      const repo = new PostgresDocumentsRepository();
      const types = await repo.listDocumentTypes(admissionOfficerSession);

      expect(types).toHaveLength(3);
      expect(types.map((t) => t.code)).toContain('BIRTH_CERTIFICATE');
      expect(types.map((t) => t.code)).toContain('STUDENT_PHOTOGRAPH');

      const photoType = types.find((t) => t.code === 'STUDENT_PHOTOGRAPH');
      expect(photoType?.mimeTypeAllowed).toEqual(['image/jpeg', 'image/png']);
      expect(photoType?.maxFileSizeBytes).toBe(5242880);
    });

    it('retrieves document type by ID from PostgreSQL', async () => {
      const repo = new PostgresDocumentsRepository();
      const dt = await repo.getDocumentTypeById(birthCertTypeId, admissionOfficerSession);
      expect(dt).toBeDefined();
      expect(dt.code).toBe('BIRTH_CERTIFICATE');
      expect(dt.name).toBe('Birth Certificate');
    });

    it('throws NotFoundError for non-existent document type ID', async () => {
      const repo = new PostgresDocumentsRepository();
      await expect(
        repo.getDocumentTypeById('00000000-0000-0000-0000-999999999999', admissionOfficerSession)
      ).rejects.toThrow(NotFoundError);
    });

    it('retrieves document requirements filtered by academic year and grade level', async () => {
      const repo = new PostgresDocumentsRepository();
      const reqs = await repo.listRequirements(academicYearId, gradeLevelId, admissionOfficerSession);

      expect(reqs).toHaveLength(3);
      const birthReq = reqs.find((r) => r.documentTypeCode === 'BIRTH_CERTIFICATE');
      expect(birthReq?.isRequired).toBe(true);
      const parentIdReq = reqs.find((r) => r.documentTypeCode === 'PARENT_ID_PROOF');
      expect(parentIdReq?.isRequired).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Admission Checklist Calculations
  // ----------------------------------------------------------------------------
  describe('2. Admission Checklist Calculations from Durable Repository Data', () => {
    it('computes missing mandatory checklist items accurately using repository data', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      // No documents uploaded initially: 2 mandatory required
      const initialChecklist = await svc.getApplicationChecklist('app-valid-001', academicYearId, gradeLevelId, admissionOfficerSession);
      expect(initialChecklist.totalRequired).toBe(2);
      expect(initialChecklist.totalReceived).toBe(0);
      expect(initialChecklist.missingMandatoryCount).toBe(2);
      expect(initialChecklist.canSubmit).toBe(false);

      // Upload mandatory Birth Certificate
      await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_cert.pdf',
          fileSizeBytes: 102400,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const afterBirthChecklist = await svc.getApplicationChecklist('app-valid-001', academicYearId, gradeLevelId, admissionOfficerSession);
      expect(afterBirthChecklist.totalReceived).toBe(1);
      expect(afterBirthChecklist.missingMandatoryCount).toBe(1);
      expect(afterBirthChecklist.canSubmit).toBe(false);

      // Upload mandatory Student Photo
      await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: photoTypeId,
          fileName: 'student_photo.jpg',
          fileSizeBytes: 204800,
          mimeType: 'image/jpeg',
        },
        admissionOfficerSession
      );

      const completeChecklist = await svc.getApplicationChecklist('app-valid-001', academicYearId, gradeLevelId, admissionOfficerSession);
      expect(completeChecklist.totalReceived).toBe(2);
      expect(completeChecklist.missingMandatoryCount).toBe(0);
      expect(completeChecklist.canSubmit).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Upload & Binary Storage in Private Bucket
  // ----------------------------------------------------------------------------
  describe('3. Upload & Binary Storage in Private Bucket', () => {
    it('uploads file buffer to private object storage and persists metadata in database', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const testBuffer = Buffer.from('%PDF-1.4 test binary document content');

      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_cert.pdf',
          fileSizeBytes: testBuffer.length,
          mimeType: 'application/pdf',
          fileBuffer: testBuffer,
        },
        admissionOfficerSession
      );

      expect(doc).toBeDefined();
      expect(doc.id).toBeDefined();
      expect(doc.fileName).toBe('birth_cert.pdf');
      expect(doc.storageBucket).toBe('admission-documents');
      expect(doc.versionNumber).toBe(1);
      expect(doc.replacesDocumentId).toBeNull();

      // Verify binary stored in private storage bucket
      expect(mockStorage.hasFile(doc.storagePath)).toBe(true);
      const stored = mockStorage.getFile(doc.storagePath);
      expect(stored?.buffer.toString()).toBe('%PDF-1.4 test binary document content');
      expect(stored?.contentType).toBe('application/pdf');

      // Verify metadata persisted in database
      expect(dbTables.student_documents).toHaveLength(1);
      expect(dbTables.student_documents[0].id).toBe(doc.id);
      expect(dbTables.student_documents[0].original_filename).toBe('birth_cert.pdf');
    });

    it('rolls back uploaded binary from storage when database metadata persistence fails (0 orphaned files)', async () => {
      const failingRepo = new PostgresDocumentsRepository();
      vi.spyOn(failingRepo, 'saveDocument').mockRejectedValueOnce(
        new Error('Database unique constraint violation / connection dropped')
      );

      const svc = new DocumentsService(failingRepo);
      const testBuffer = Buffer.from('binary-content-to-rollback');

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'fail_cert.pdf',
            fileSizeBytes: testBuffer.length,
            mimeType: 'application/pdf',
            fileBuffer: testBuffer,
          },
          admissionOfficerSession
        )
      ).rejects.toThrow('Database unique constraint violation');

      // Verify no orphaned binary remains in storage
      expect(mockStorage.hasFile('applications/app-valid-001/fail_cert.pdf')).toBe(false);
      expect(dbTables.student_documents).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Versioning & Historical Record Preservation
  // ----------------------------------------------------------------------------
  describe('4. Version Replacement & History Preservation', () => {
    it('preserves historical version and links replacement relationships correctly', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      // Version 1
      const docV1 = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_cert_v1.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );
      expect(docV1.versionNumber).toBe(1);
      expect(docV1.replacesDocumentId).toBeNull();
      expect(docV1.verificationStatus).toBe('pending');

      // Version 2 replacing Version 1
      const docV2 = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_cert_v2.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );
      expect(docV2.versionNumber).toBe(2);
      expect(docV2.replacesDocumentId).toBe(docV1.id);
      expect(docV2.verificationStatus).toBe('pending');

      // Version 1 must still exist in database with verificationStatus 'replaced'
      const historicalV1 = await svc.getDocumentById(docV1.id, admissionOfficerSession);
      expect(historicalV1).toBeDefined();
      expect(historicalV1.id).toBe(docV1.id);
      expect(historicalV1.verificationStatus).toBe('replaced');
      expect(historicalV1.versionNumber).toBe(1);

      // Version 3 replacing Version 2
      const docV3 = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_cert_v3.pdf',
          fileSizeBytes: 4096,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );
      expect(docV3.versionNumber).toBe(3);
      expect(docV3.replacesDocumentId).toBe(docV2.id);

      // Version 2 is now 'replaced'
      const historicalV2 = await svc.getDocumentById(docV2.id, admissionOfficerSession);
      expect(historicalV2.verificationStatus).toBe('replaced');

      // Version history retrieved in descending version order
      const versions = await svc.getDocumentVersions(docV3.id, admissionOfficerSession);
      expect(versions).toHaveLength(3);
      expect(versions[0].id).toBe(docV3.id);
      expect(versions[0].versionNumber).toBe(3);
      expect(versions[1].id).toBe(docV2.id);
      expect(versions[1].versionNumber).toBe(2);
      expect(versions[2].id).toBe(docV1.id);
      expect(versions[2].versionNumber).toBe(1);
    });

    it('active application document list filters out replaced versions by default', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      const v1 = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_v1.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const v2 = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'birth_v2.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const activeDocs = await svc.listApplicationDocuments('app-valid-001', admissionOfficerSession, false);
      expect(activeDocs).toHaveLength(1);
      expect(activeDocs[0].id).toBe(v2.id);

      const allDocs = await svc.listApplicationDocuments('app-valid-001', admissionOfficerSession, true);
      expect(allDocs).toHaveLength(2);
      expect(allDocs.map((d) => d.id)).toContain(v1.id);
      expect(allDocs.map((d) => d.id)).toContain(v2.id);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Signed URLs & Elimination of Fake Internal Fallbacks
  // ----------------------------------------------------------------------------
  describe('5. Signed Download URLs & No Fake Fallbacks', () => {
    it('generates genuine private signed download URL with 15-minute expiry', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'verified_doc.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const signed = await svc.generateDownloadUrl(doc.id, admissionOfficerSession);
      expect(signed).toBeDefined();
      expect(signed.expiresInSeconds).toBe(900); // 15 mins per SRS
      expect(signed.fileName).toBe('verified_doc.pdf');

      // Genuine storage signed URL format
      expect(signed.downloadUrl).toContain('https://storage.supabase.co/storage/v1/object/sign/');
      expect(signed.downloadUrl).toContain('token=');
      expect(signed.downloadUrl).toContain('expires=');

      // Strictly verifies removal of synthetic storage.school.internal fallback
      expect(signed.downloadUrl).not.toContain('storage.school.internal');
    });

    it('Principal can generate signed download URL for student documents', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'principal_view.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const signed = await svc.generateDownloadUrl(doc.id, principalSession);
      expect(signed.downloadUrl).toBeDefined();
      expect(signed.downloadUrl).toContain('https://');
    });

    it('throws explicit BusinessRuleError when storage is unavailable during URL signing', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'doc_storage_down.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      // Simulate storage outage
      mockStorage.shouldFail = true;
      mockStorage.failureMessage = 'Storage service 503 Service Unavailable';

      await expect(
        svc.generateDownloadUrl(doc.id, admissionOfficerSession)
      ).rejects.toThrow(BusinessRuleError);

      await expect(
        svc.generateDownloadUrl(doc.id, admissionOfficerSession)
      ).rejects.toThrow('Storage service 503 Service Unavailable');
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Role Authorization & Cross-Entity Access Controls
  // ----------------------------------------------------------------------------
  describe('6. Role Authorization & Cross-Entity Access Controls', () => {
    it('denies Accounts Officer, System Administrator, and Clerk from downloading documents', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'secure_birth_cert.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      await expect(
        svc.generateDownloadUrl(doc.id, accountantSession)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        svc.generateDownloadUrl(doc.id, systemAdminSession)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        svc.generateDownloadUrl(doc.id, clerkSession)
      ).rejects.toThrow(AuthorizationError);
    });

    it('denies Accounts Officer and System Administrator from viewing version history', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'versioned_cert.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      await expect(
        svc.getDocumentVersions(doc.id, accountantSession)
      ).rejects.toThrow(AuthorizationError);

      await expect(
        svc.getDocumentVersions(doc.id, systemAdminSession)
      ).rejects.toThrow(AuthorizationError);
    });

    it('denies uploading document when student ID does not match the admission application (cross-student access)', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      // Attempting to upload for student-other-002 against app-valid-001 (which belongs to student-valid-001)
      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-other-002',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'cross_student.pdf',
            fileSizeBytes: 1024,
            mimeType: 'application/pdf',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow("Document student does not match the admission application's student");
    });

    it('denies downloading document when requested with mismatched application scope (cross-application access)', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'scoped_doc.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      // Requesting with mismatched application scope
      await expect(
        svc.generateDownloadUrl(doc.id, admissionOfficerSession, {
          applicationId: 'app-other-002',
        })
      ).rejects.toThrow('Access Denied: Document does not belong to the requested admission application.');

      // Requesting with mismatched student scope
      await expect(
        svc.generateDownloadUrl(doc.id, admissionOfficerSession, {
          studentId: 'student-other-002',
        })
      ).rejects.toThrow('Access Denied: Document does not belong to the requested student.');

      // Requesting with correct scope succeeds
      const correct = await svc.generateDownloadUrl(doc.id, admissionOfficerSession, {
        applicationId: 'app-valid-001',
        studentId: 'student-valid-001',
      });
      expect(correct.downloadUrl).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // 7. File Size & MIME Type Validations
  // ----------------------------------------------------------------------------
  describe('7. File Size and MIME Type Restrictions', () => {
    it('rejects unsupported MIME types (e.g. text/plain, executable, word)', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'malicious.exe',
            fileSizeBytes: 1024,
            mimeType: 'application/x-msdownload',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'notes.txt',
            fileSizeBytes: 512,
            mimeType: 'text/plain',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow('Invalid document format');
    });

    it('rejects PDF format for STUDENT_PHOTOGRAPH which strictly requires image/jpeg or image/png', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: photoTypeId,
            fileName: 'photo.pdf',
            fileSizeBytes: 1024,
            mimeType: 'application/pdf',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow('Document type "Student Photograph" only allows image/jpeg, image/png');
    });

    it('rejects oversized files exceeding 5 MB limit', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const oversizedBytes = MAX_DOCUMENT_FILE_SIZE_BYTES + 1; // 5 MB + 1 byte

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'huge_scan.pdf',
            fileSizeBytes: oversizedBytes,
            mimeType: 'application/pdf',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow('File size exceeds 5 MB limit');
    });

    it('rejects zero-byte files (<= 0 bytes)', async () => {
      const svc = new DocumentsService(new PostgresDocumentsRepository());

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'empty.pdf',
            fileSizeBytes: 0,
            mimeType: 'application/pdf',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Storage Outages & Explicit Error Propagation
  // ----------------------------------------------------------------------------
  describe('8. Storage Outage & Explicit Error Behavior', () => {
    it('throws explicit BusinessRuleError when private storage upload fails', async () => {
      mockStorage.shouldFail = true;
      mockStorage.failureMessage = 'Storage network timeout (ECONNREFUSED)';

      const svc = new DocumentsService(new PostgresDocumentsRepository());
      const buffer = Buffer.from('test-content');

      await expect(
        svc.uploadDocument(
          {
            studentId: 'student-valid-001',
            admissionApplicationId: 'app-valid-001',
            documentTypeId: birthCertTypeId,
            fileName: 'timeout.pdf',
            fileSizeBytes: buffer.length,
            mimeType: 'application/pdf',
            fileBuffer: buffer,
          },
          admissionOfficerSession
        )
      ).rejects.toThrow('Storage network timeout (ECONNREFUSED)');
    });
  });

  // ----------------------------------------------------------------------------
  // 9. Document Verification Workflow
  // ----------------------------------------------------------------------------
  describe('9. Document Verification Workflow', () => {
    it('allows Principal or Admission Officer to verify or reject documents with reason', async () => {
      const repo = new PostgresDocumentsRepository();
      const svc = new DocumentsService(repo);

      const doc = await svc.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'to_verify.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      expect(doc.verificationStatus).toBe('pending');

      // Verify document
      const verified = await svc.verifyDocument(doc.id, 'verified', undefined, admissionOfficerSession);
      expect(verified.verificationStatus).toBe('verified');
      expect(verified.reviewedBy).toBe(admissionOfficerSession.staffId);

      // Re-verify with rejection reason
      const rejected = await svc.verifyDocument(doc.id, 'rejected', 'Blurry copy, please re-upload', principalSession);
      expect(rejected.verificationStatus).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Blurry copy, please re-upload');
      expect(rejected.reviewedBy).toBe(principalSession.staffId);
    });
  });

  // ----------------------------------------------------------------------------
  // 10. Persistence Across Repository Re-instantiation
  // ----------------------------------------------------------------------------
  describe('10. Persistence Across Repository Re-instantiation', () => {
    it('persists documents and version chains across fresh repository instances', async () => {
      const repo1 = new PostgresDocumentsRepository();
      const svc1 = new DocumentsService(repo1);

      const v1 = await svc1.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'doc_reinst_v1.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      const v2 = await svc1.uploadDocument(
        {
          studentId: 'student-valid-001',
          admissionApplicationId: 'app-valid-001',
          documentTypeId: birthCertTypeId,
          fileName: 'doc_reinst_v2.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
        },
        admissionOfficerSession
      );

      // Instantiate completely fresh repository instance (simulating server reboot)
      const repo2 = new PostgresDocumentsRepository();
      const svc2 = new DocumentsService(repo2);

      const docV2Fetched = await svc2.getDocumentById(v2.id, admissionOfficerSession);
      expect(docV2Fetched.id).toBe(v2.id);
      expect(docV2Fetched.versionNumber).toBe(2);
      expect(docV2Fetched.replacesDocumentId).toBe(v1.id);

      const versions = await svc2.getDocumentVersions(v2.id, admissionOfficerSession);
      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
    });
  });
});
