import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import {
  setPostgresPoolForTesting,
  closePostgresPool,
  withTransaction,
  withSystemTransaction,
  runWithSessionOrSystem,
  query,
  getActiveTransactionContext,
  generateActorSignature,
} from '../src/infrastructure/db/postgres-pool';
import { PostgresAdmissionsRepository } from '../src/infrastructure/repositories/postgres/admissions.repository';
import { PostgresDocumentsRepository } from '../src/infrastructure/repositories/postgres/documents.repository';
import { PostgresFeeConfigurationRepository } from '../src/infrastructure/repositories/postgres/fee-configuration.repository';
import { PostgresStudentRecordsRepository } from '../src/infrastructure/repositories/postgres/student-records.repository';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { NotFoundError, BusinessRuleError, AuthorizationError } from '../src/lib/errors';
import { randomUUID } from 'crypto';

describe('Milestone M8.3.4: Transaction Boundary and Repository Correctness', () => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'principal',
    fullName: 'Dr. Ramesh Kulkarni',
    email: 'principal@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const clerkSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: '44444444-4444-4444-4444-444444444444',
    role: 'clerk',
    fullName: 'Deepa Rao',
    email: 'clerk@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  let originalEnvSecret: string | undefined;

  beforeEach(() => {
    originalEnvSecret = process.env.ACTOR_SIGNING_SECRET;
    process.env.ACTOR_SIGNING_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.ACTOR_SIGNING_SECRET = originalEnvSecret;
    setPostgresPoolForTesting(null);
  });

  // ============================================================================
  // Suite 1: Connection Pool Isolation & Single Connection Guarantee
  // ============================================================================
  describe('1. Single Connection Guarantee & No Nested Pool Acquisition', () => {
    it('requests exactly ONE pool connection during createDraft workflow', async () => {
      let connectCount = 0;
      let releaseCount = 0;
      const queryLog: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          queryLog.push(trimmed);

          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('from public.academic_years where id = $1')) {
            return { rows: [{ id: params[0], label: '2026-2027' }], rowCount: 1 };
          }
          if (trimmed.includes('private.next_application_number')) {
            return { rows: [{ val: '1/2026-27' }], rowCount: 1 };
          }
          if (trimmed.includes('receipt_number_counters as c')) {
            return { rows: [{ val: 1 }], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.students')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.admission_applications')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.guardians')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.student_guardians')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.admission_status_history')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.audit_logs')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('from public.admission_applications a') && trimmed.includes('join public.students s')) {
            return {
              rows: [
                {
                  id: params[0],
                  application_number: '1/2026-27',
                  academic_year_id: '00000000-0000-0000-0000-000000000001',
                  requested_grade_level_id: '30000000-0000-0000-0000-000000000004',
                  requested_section_id: null,
                  status: 'draft',
                  student_id: 'student-uuid-001',
                  first_name: 'Aarav',
                  last_name: 'Patil',
                  dob: '2020-01-01',
                  gender: 'male',
                  nationality: 'Indian',
                  mother_tongue: 'Kannada',
                  blood_group: 'O+',
                  sts_number: null,
                  dise_number: null,
                  caste: null,
                  subcaste: null,
                  transport_opted_in: false,
                  decision_reason: null,
                  seat_reserved_until: null,
                  override_missing_documents_reason: null,
                  fee_generated: false,
                },
              ],
              rowCount: 1,
            };
          }
          if (trimmed.includes('from public.student_guardians sg')) {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('from public.admission_status_history h')) {
            return { rows: [], rowCount: 0 };
          }

          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCount++;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          connectCount++;
          return mockClient;
        }),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresAdmissionsRepository();
      const draft = await repo.createDraft(
        {
          academicYearId: '00000000-0000-0000-0000-000000000001',
          gradeLevelId: '30000000-0000-0000-0000-000000000004',
          student: {
            firstName: 'Aarav',
            lastName: 'Patil',
            dob: '2020-01-01',
            gender: 'male',
          },
        },
        clerkSession
      );

      // Verify connection was requested EXACTLY ONCE
      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);

      // Verify returned DTO is fully populated and non-undefined
      expect(draft).toBeDefined();
      expect(draft.status).toBe('draft');
      expect(draft.applicationNumber).toBe('1/2026-27');
      expect(draft.student.firstName).toBe('Aarav');
    });

    it('requests exactly ONE pool connection during updateDraft workflow', async () => {
      let connectCount = 0;
      let releaseCount = 0;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('select * from public.admission_applications where id = $1')) {
            return {
              rows: [{ id: params[0], status: 'draft', student_id: 'student-uuid-001' }],
              rowCount: 1,
            };
          }
          if (trimmed.includes('update public.admission_applications')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('update public.students')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('from public.admission_applications a')) {
            return {
              rows: [
                {
                  id: params[0],
                  application_number: '1/2026-27',
                  academic_year_id: '00000000-0000-0000-0000-000000000001',
                  requested_grade_level_id: '30000000-0000-0000-0000-000000000004',
                  status: 'draft',
                  student_id: 'student-uuid-001',
                  first_name: 'Aarav Updated',
                  last_name: 'Patil',
                  dob: '2020-01-01',
                  gender: 'male',
                  nationality: 'Indian',
                  mother_tongue: 'Kannada',
                },
              ],
              rowCount: 1,
            };
          }
          if (trimmed.includes('from public.student_guardians sg') || trimmed.includes('from public.admission_status_history h')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCount++;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          connectCount++;
          return mockClient;
        }),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresAdmissionsRepository();
      const updated = await repo.updateDraft(
        'app-uuid-001',
        {
          student: { firstName: 'Aarav Updated' },
        },
        clerkSession
      );

      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);
      expect(updated).toBeDefined();
      expect(updated.student.firstName).toBe('Aarav Updated');
    });

    it('requests exactly ONE pool connection during saveDocument workflow', async () => {
      let connectCount = 0;
      let releaseCount = 0;

      const docId = randomUUID();

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.student_documents')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('from public.student_documents d')) {
            return {
              rows: [
                {
                  id: docId,
                  student_id: 'student-001',
                  admission_application_id: 'app-001',
                  document_type_id: 'type-001',
                  document_type_name: 'Birth Certificate',
                  document_type_code: 'BIRTH_CERTIFICATE',
                  original_filename: 'birth_cert.pdf',
                  file_size_bytes: 1024,
                  mime_type: 'application/pdf',
                  storage_bucket: 'admission-documents',
                  storage_object_key: 'app-001/birth_cert.pdf',
                  verification_status: 'pending',
                  replaces_document_id: null,
                  uploaded_by: clerkSession.staffId,
                  uploaded_at: new Date().toISOString(),
                  reviewed_by: null,
                  reviewed_at: null,
                  rejection_reason: null,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCount++;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          connectCount++;
          return mockClient;
        }),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresDocumentsRepository();
      const savedDoc = await repo.saveDocument(
        {
          id: docId,
          studentId: 'student-001',
          admissionApplicationId: 'app-001',
          documentTypeId: 'type-001',
          fileName: 'birth_cert.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1024,
          storagePath: 'app-001/birth_cert.pdf',
          uploadedBy: clerkSession.staffId,
        },
        clerkSession
      );

      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);
      expect(savedDoc).toBeDefined();
      expect(savedDoc.id).toBe(docId);
      expect(savedDoc.fileName).toBe('birth_cert.pdf');
      expect(savedDoc.verificationStatus).toBe('pending');
    });

    it('requests exactly ONE pool connection during verifyDocument workflow', async () => {
      let connectCount = 0;
      let releaseCount = 0;
      const docId = 'doc-to-verify-001';

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('update public.student_documents')) {
            return { rows: [{ id: docId }], rowCount: 1 };
          }
          if (trimmed.includes('from public.student_documents d')) {
            return {
              rows: [
                {
                  id: docId,
                  student_id: 'student-001',
                  admission_application_id: 'app-001',
                  document_type_id: 'type-001',
                  document_type_name: 'Birth Certificate',
                  document_type_code: 'BIRTH_CERTIFICATE',
                  original_filename: 'birth_cert.pdf',
                  file_size_bytes: 1024,
                  mime_type: 'application/pdf',
                  storage_bucket: 'admission-documents',
                  storage_object_key: 'app-001/birth_cert.pdf',
                  verification_status: 'verified',
                  replaces_document_id: null,
                  uploaded_by: clerkSession.staffId,
                  uploaded_at: new Date().toISOString(),
                  reviewed_by: principalSession.staffId,
                  reviewed_at: new Date().toISOString(),
                  rejection_reason: null,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCount++;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          connectCount++;
          return mockClient;
        }),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresDocumentsRepository();
      const verified = await repo.verifyDocument(docId, 'verified', undefined, principalSession);

      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);
      expect(verified).toBeDefined();
      expect(verified.verificationStatus).toBe('verified');
      expect(verified.reviewedBy).toBe(principalSession.staffId);
    });

    it('requests exactly ONE pool connection during createFeeStructure workflow', async () => {
      let connectCount = 0;
      let releaseCount = 0;
      const structId = randomUUID();

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.fee_structures')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.fee_structure_lines')) {
            return { rows: [], rowCount: 1 };
          }
          if (trimmed.includes('from public.fee_structures s')) {
            return {
              rows: [
                {
                  id: structId,
                  academic_year_id: 'year-001',
                  grade_level_id: 'grade-001',
                  grade_level_name: 'Standard 1',
                  version: 1,
                  status: 'draft',
                  approved_by: null,
                  approved_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
              rowCount: 1,
            };
          }
          if (trimmed.includes('from public.fee_structure_lines l')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCount++;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          connectCount++;
          return mockClient;
        }),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresFeeConfigurationRepository();
      const created = await repo.createFeeStructure(
        {
          id: structId,
          academicYearId: 'year-001',
          gradeLevelId: 'grade-001',
          version: 1,
          status: 'draft',
          lines: [],
        },
        principalSession
      );

      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);
      expect(created).toBeDefined();
      expect(created.id).toBe(structId);
    });
  });

  // ============================================================================
  // Suite 2: Simulated SQL Failure, Rollback & Connection Release
  // ============================================================================
  describe('2. Simulated SQL Failure & Atomic Rollback', () => {
    it('executes ROLLBACK and releases client when simulated SQL error occurs during createDraft', async () => {
      let rolledBack = false;
      let released = false;
      let resetAllCalled = false;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'ROLLBACK') {
            rolledBack = true;
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'RESET ALL') {
            resetAllCalled = true;
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          if (trimmed.includes('from public.academic_years where id = $1')) {
            return { rows: [{ id: 'year-001', label: '2026-2027' }], rowCount: 1 };
          }
          if (trimmed.includes('private.next_application_number')) {
            return { rows: [{ val: '1/2026-27' }], rowCount: 1 };
          }
          if (trimmed.includes('receipt_number_counters as c')) {
            return { rows: [{ val: 1 }], rowCount: 1 };
          }
          if (trimmed.includes('insert into public.students')) {
            // Simulate foreign key or check constraint failure in database
            const dbError = new Error('duplicate key value violates unique constraint "students_pkey"');
            (dbError as any).code = '23505';
            throw dbError;
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          released = true;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => mockClient),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresAdmissionsRepository();
      await expect(
        repo.createDraft(
          {
            academicYearId: 'year-001',
            gradeLevelId: 'grade-001',
            student: { firstName: 'Test', lastName: 'Fail' },
          },
          clerkSession
        )
      ).rejects.toThrow('duplicate key value violates unique constraint');

      expect(rolledBack).toBe(true);
      expect(resetAllCalled).toBe(true);
      expect(released).toBe(true);
    });

    it('executes ROLLBACK and releases client when simulated SQL error occurs during saveDocument', async () => {
      let rolledBack = false;
      let released = false;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN') return { rows: [], rowCount: 0 };
          if (trimmed === 'ROLLBACK') {
            rolledBack = true;
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'RESET ALL') return { rows: [], rowCount: 0 };
          if (trimmed.includes('set_config')) return { rows: [{ set_config: '' }], rowCount: 1 };
          if (trimmed.includes('insert into public.student_documents')) {
            const err = new Error('violates foreign key constraint "student_documents_student_id_fkey"');
            (err as any).code = '23503';
            throw err;
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          released = true;
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => mockClient),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      const repo = new PostgresDocumentsRepository();
      await expect(
        repo.saveDocument(
          {
            studentId: 'non-existent-student',
            admissionApplicationId: 'app-001',
            documentTypeId: 'type-001',
            fileName: 'doc.pdf',
          },
          clerkSession
        )
      ).rejects.toThrow('violates foreign key constraint');

      expect(rolledBack).toBe(true);
      expect(released).toBe(true);
    });
  });

  // ============================================================================
  // Suite 3: RLS Actor Context & Signature Persistence Across Workflow
  // ============================================================================
  describe('3. RLS Actor Context & Signature Persistence', () => {
    it('sets app.current_staff_id, app.current_role, and app.actor_signature throughout transaction', async () => {
      const capturedConfigs: Record<string, string> = {};

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();
          if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            capturedConfigs['app.current_staff_id'] = params[0];
            capturedConfigs['app.current_role'] = params[1];
            capturedConfigs['app.actor_signature'] = params[2];
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => mockClient),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      await withTransaction(principalSession, async (client) => {
        const activeTx = getActiveTransactionContext();
        expect(activeTx).toBeDefined();
        expect(activeTx?.client).toBe(client);
        expect(activeTx?.actorSession?.staffId).toBe(principalSession.staffId);
        expect(activeTx?.actorSession?.role).toBe('principal');
      });

      expect(capturedConfigs['app.current_staff_id']).toBe(principalSession.staffId);
      expect(capturedConfigs['app.current_role']).toBe('principal');

      const expectedSig = generateActorSignature(principalSession.staffId, 'principal', testSecret);
      expect(capturedConfigs['app.actor_signature']).toBe(expectedSig);
    });

    it('rejects attempt to switch actor session inside active transaction context', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async () => ({ rows: [], rowCount: 0 })),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => mockClient),
        on: vi.fn(),
      } as unknown as Pool;

      setPostgresPoolForTesting(mockPool);

      await expect(
        withTransaction(principalSession, async () => {
          // Attempt nested transaction with different actor session
          await withTransaction(clerkSession, async () => {});
        })
      ).rejects.toThrow(/Cannot switch actor session inside active transaction/);
    });
  });

  // ============================================================================
  // Suite 4: Real PostgreSQL Database Verification (When Available in CI/Docker)
  // ============================================================================
  describe('4. Real PostgreSQL Database Verification', () => {
    it('verifies transaction boundary, read-after-write, and atomic rollback on live database if available', async () => {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return;
      }

      let realPool: Pool | null = null;
      try {
        realPool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 2000,
        });
        await realPool.query('SELECT 1');
      } catch {
        if (realPool) await realPool.end();
        return;
      }

      setPostgresPoolForTesting(realPool);

      try {
        // Step 1: Ensure academic year exists
        const yearRes = await realPool.query('SELECT id, label FROM public.academic_years LIMIT 1');
        if (yearRes.rowCount === 0) {
          return;
        }
        const yearId = yearRes.rows[0].id;
        const yearLabel = yearRes.rows[0].label;

        const gradeRes = await realPool.query('SELECT id FROM public.grade_levels LIMIT 1');
        if (gradeRes.rowCount === 0) {
          return;
        }
        const gradeId = gradeRes.rows[0].id;

        // Ensure staff member exists for RLS session (reuse seeded principal if present)
        const existingStaff = await realPool.query(
          'SELECT id, email, role, full_name FROM public.staff_members WHERE email = $1',
          [principalSession.email]
        );
        let activePrincipalSession = principalSession;
        if (existingStaff.rowCount && existingStaff.rowCount > 0) {
          activePrincipalSession = {
            ...principalSession,
            staffId: existingStaff.rows[0].id,
            authUserId: existingStaff.rows[0].id,
          };
        } else {
          await realPool.query(
            `INSERT INTO public.staff_members (id, email, role, full_name, is_active)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (id) DO UPDATE SET is_active = true`,
            [principalSession.staffId, principalSession.email, principalSession.role, principalSession.fullName]
          );
        }

        const repo = new PostgresAdmissionsRepository();

        // Step 2: Test createDraft on real PostgreSQL
        const testStudentName = `TxTestStudent_${Date.now()}`;
        const draft = await repo.createDraft(
          {
            academicYearId: yearId,
            gradeLevelId: gradeId,
            student: {
              firstName: testStudentName,
              lastName: 'BoundaryCheck',
              dob: '2019-06-10',
              gender: 'female',
            },
          },
          activePrincipalSession
        );

        // Verify returned DTO reflects committed state
        expect(draft).toBeDefined();
        expect(draft.id).toBeDefined();
        expect(draft.student.firstName).toBe(testStudentName);
        expect(draft.status).toBe('draft');

        // Step 3: Test updateDraft on real PostgreSQL
        const updatedName = `${testStudentName}_Updated`;
        const updated = await repo.updateDraft(
          draft.id,
          {
            student: { firstName: updatedName },
          },
          activePrincipalSession
        );

        expect(updated).toBeDefined();
        expect(updated.student.firstName).toBe(updatedName);

        // Step 4: Test atomic rollback on real PostgreSQL
        let threwError = false;
        try {
          await withTransaction(activePrincipalSession, async (client) => {
            // Write a dummy record
            await client.query(
              `INSERT INTO public.admission_status_history (
                 id, admission_application_id, from_status, to_status, changed_by, reason, created_at
               ) VALUES ($1, $2, 'draft', 'on_hold', $3, 'Temporary Rollback Test', now())`,
              [randomUUID(), draft.id, activePrincipalSession.staffId]
            );

            // Trigger forced SQL failure
            await client.query('SELECT 1 / 0');
          });
        } catch (err: any) {
          threwError = true;
          expect(err.message).toContain('division by zero');
        }

        expect(threwError).toBe(true);

        // Verify rollback removed partial writes in real PostgreSQL
        const historyCheck = await realPool.query(
          `SELECT id FROM public.admission_status_history WHERE reason = 'Temporary Rollback Test'`
        );
        expect(historyCheck.rowCount).toBe(0);

        // Cleanup test data
        await realPool.query('DELETE FROM public.admission_status_history WHERE admission_application_id = $1', [draft.id]);
        await realPool.query('DELETE FROM public.admission_applications WHERE id = $1', [draft.id]);
        await realPool.query('DELETE FROM public.students WHERE id = $1', [draft.studentId]);
      } finally {
        await realPool.end();
        setPostgresPoolForTesting(null);
      }
    });
  });
});
