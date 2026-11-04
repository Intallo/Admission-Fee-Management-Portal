import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PoolClient } from 'pg';
import {
  setPostgresPoolForTesting,
  closePostgresPool,
} from '../src/infrastructure/db/postgres-pool';
import { PostgresStudentRecordsRepository } from '../src/infrastructure/repositories/postgres/student-records.repository';
import { StudentRecordsService } from '../src/modules/student-records/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../src/lib/errors';
import { encryptSensitiveField } from '../src/lib/crypto/pii';
import { setPersistenceMode } from '../src/infrastructure/repositories/registry';

describe('Milestone M8.3.7: Student Records Production Completion & PostgreSQL Durability', () => {
  const currentYearId = '00000000-0000-0000-0000-000000000001'; // 2026-2027
  const priorYearId = '00000000-0000-0000-0000-000000000000'; // 2025-2026 (closed)
  const std1GradeId = '30000000-0000-0000-0000-000000000004';
  const std2GradeId = '30000000-0000-0000-0000-000000000005';
  const sectionAId = '40000000-0000-0000-0000-000000000001';

  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'principal',
    fullName: 'Dr. Ramesh Kulkarni (Principal)',
    email: 'principal@school-demo.example',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: '33333333-3333-3333-3333-333333333333',
    role: 'admission_officer',
    fullName: 'Sneha Joshi (Admission Officer)',
    email: 'admissions@school-demo.example',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: '22222222-2222-2222-2222-222222222222',
    role: 'accountant',
    fullName: 'Vinod Patil (Accountant)',
    email: 'accounts@school-demo.example',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const sysAdminSession: AuthenticatedUserSession = {
    staffId: '55555555-5555-5555-5555-555555555555',
    authUserId: '55555555-5555-5555-5555-555555555555',
    role: 'system_admin',
    fullName: 'Admin User (System Administrator)',
    email: 'admin@school-demo.example',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const clerkSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: '44444444-4444-4444-4444-444444444444',
    role: 'clerk',
    fullName: 'Deepa Rao (Clerk)',
    email: 'clerk@school-demo.example',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  // State store representing durable PostgreSQL tables
  let dbTables: {
    academic_years: any[];
    grade_levels: any[];
    sections: any[];
    students: any[];
    guardians: any[];
    student_guardians: any[];
    student_sensitive_details: any[];
    admission_applications: any[];
    student_academic_records: any[];
    student_documents: any[];
    document_types: any[];
    student_fee_assessments: any[];
    receipts: any[];
    student_year_certificates: any[];
    audit_logs: any[];
  };

  let service: StudentRecordsService;
  let repo: PostgresStudentRecordsRepository;

  beforeEach(() => {
    setPersistenceMode('postgres');

    dbTables = {
      academic_years: [
        { id: currentYearId, label: '2026-2027', start_date: '2026-06-01', end_date: '2027-05-31', status: 'current', is_closed: false },
        { id: priorYearId, label: '2025-2026', start_date: '2025-06-01', end_date: '2026-05-31', status: 'closed', is_closed: true },
      ],
      grade_levels: [
        { id: std1GradeId, code: 'STD1', name: 'Standard 1', group_name: 'primary' },
        { id: std2GradeId, code: 'STD2', name: 'Standard 2', group_name: 'primary' },
      ],
      sections: [
        { id: sectionAId, academic_year_id: currentYearId, grade_level_id: std1GradeId, name: 'Section A', max_capacity: 40 },
      ],
      document_types: [
        { id: 'dt-001', code: 'BIRTH_CERTIFICATE', name: 'Birth Certificate' },
        { id: 'dt-002', code: 'PREVIOUS_TC', name: 'Transfer Certificate' },
      ],
      students: [
        {
          id: 'stud-001',
          first_name: 'Aarav',
          middle_name: 'Kumar',
          last_name: 'Sharma',
          dob: '2019-05-15',
          gender: 'male',
          nationality: 'Indian',
          mother_tongue: 'Hindi',
          blood_group: 'B+',
          religion: 'Hindu',
          caste: 'General',
          subcaste: 'Brahmin',
          category: 'General',
          sts_number: 'STS-2026-789',
          dise_number: 'DISE-29-001',
          transport_opted_in: true,
          address_line1: '45 Lake View Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560024',
        },
      ],
      guardians: [
        {
          id: 'guard-001',
          full_name: 'Vikram Sharma',
          relationship_to_student: 'Father',
          phone: '+919876543210',
          email: 'vikram@example.com',
          occupation: 'Engineer',
          address_line_1: '45 Lake View Road',
        },
      ],
      student_guardians: [
        {
          student_id: 'stud-001',
          guardian_id: 'guard-001',
          relationship_type: 'Father',
          is_primary_contact: true,
        },
      ],
      student_sensitive_details: [
        {
          student_id: 'stud-001',
          aadhaar_encrypted: encryptSensitiveField('998877665544'),
          aadhaar_last_four: '5544',
          caste: 'General',
          sub_caste: 'Brahmin',
          annual_family_income: '1200000.00',
        },
      ],
      admission_applications: [
        {
          id: 'app-001',
          application_number: '1/2026-27',
          student_id: 'stud-001',
          academic_year_id: currentYearId,
          requested_grade_level_id: std1GradeId,
          status: 'approved',
        },
      ],
      student_academic_records: [
        {
          id: 'rec-2025-001',
          student_id: 'stud-001',
          academic_year_id: priorYearId,
          grade_level_id: std1GradeId,
          section_id: sectionAId,
          admission_number: 'ADM-2025-0001',
          status: 'admitted',
          admission_date: '2025-06-05',
          roll_number: '101',
          transport_opted_in: true,
          notes: 'Admitted in 2025',
          created_at: '2025-06-05T09:00:00.000Z',
        },
        {
          id: 'rec-2026-001',
          student_id: 'stud-001',
          academic_year_id: currentYearId,
          grade_level_id: std2GradeId,
          section_id: sectionAId,
          admission_number: 'ADM-2025-0001',
          status: 'active',
          admission_date: '2026-06-01',
          roll_number: '201',
          transport_opted_in: true,
          notes: 'Promoted to STD 2',
          created_at: '2026-06-01T09:00:00.000Z',
        },
      ],
      student_documents: [
        {
          id: 'doc-001',
          student_id: 'stud-001',
          document_type_id: 'dt-001',
          original_filename: 'birth_cert.pdf',
          verification_status: 'verified',
          replaces_document_id: null,
          created_at: '2026-06-01T10:00:00.000Z',
        },
      ],
      student_fee_assessments: [
        {
          id: 'assess-001',
          student_academic_record_id: 'rec-2026-001',
          assessment_number: 'ASM-2026-0001',
          status: 'active',
        },
      ],
      receipts: [
        {
          id: 'rct-001',
          student_academic_record_id: 'rec-2026-001',
          receipt_number: 'RCT-2026-000001',
          category: 'tuition',
          rendered_snapshot: { totalAmount: '15000.00' },
          created_at: '2026-06-10T11:00:00.000Z',
        },
      ],
      student_year_certificates: [
        {
          id: 'cert-001',
          student_academic_record_id: 'rec-2026-001',
          certificate_type: 'TC',
          certificate_number: 'TC-2026-0001',
          status: 'draft',
          issued_at: null,
        },
      ],
      audit_logs: [],
    };

    const createMockClient = () => {
      let inTx = false;
      let txRollbackSnapshot: string | null = null;

      const client = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();

          // Transaction handling
          if (trimmed === 'BEGIN') {
            inTx = true;
            txRollbackSnapshot = JSON.stringify(dbTables);
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'COMMIT') {
            inTx = false;
            txRollbackSnapshot = null;
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'ROLLBACK') {
            inTx = false;
            if (txRollbackSnapshot) {
              dbTables = JSON.parse(txRollbackSnapshot);
              txRollbackSnapshot = null;
            }
            return { rows: [], rowCount: 0 };
          }
          if (trimmed === 'RESET ALL') {
            return { rows: [], rowCount: 0 };
          }
          if (trimmed.includes('set_config')) {
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }

          // 1. Lookups on student_academic_records
          if (trimmed.includes('from public.student_academic_records') && trimmed.includes('limit 1')) {
            const ident = params[0]?.toLowerCase();
            const found = dbTables.student_academic_records.find(
              (r) =>
                r.id.toLowerCase() === ident ||
                r.admission_number?.toLowerCase() === ident
            );
            return {
              rows: found ? [{ id: found.id, student_id: found.student_id, academic_year_id: found.academic_year_id, admission_number: found.admission_number }] : [],
              rowCount: found ? 1 : 0,
            };
          }

          // 2. Lookups on students by identifier
          if (trimmed.includes('from public.students') && trimmed.includes('limit 1')) {
            const ident = params[0]?.toLowerCase();
            const found = dbTables.students.find(
              (s) =>
                s.id.toLowerCase() === ident ||
                s.sts_number?.toLowerCase() === ident ||
                s.dise_number?.toLowerCase() === ident
            );
            return {
              rows: found ? [{ id: found.id }] : [],
              rowCount: found ? 1 : 0,
            };
          }

          // 3. Lookups on admission_applications by identifier
          if (trimmed.includes('from public.admission_applications') && trimmed.includes('limit 1')) {
            const ident = params[0]?.toLowerCase();
            const found = dbTables.admission_applications.find(
              (a) =>
                a.id.toLowerCase() === ident ||
                a.application_number?.toLowerCase() === ident
            );
            return {
              rows: found ? [{ student_id: found.student_id }] : [],
              rowCount: found ? 1 : 0,
            };
          }

          // 4. Student Demographics query
          if (trimmed.includes('from public.students') && trimmed.includes('where id = $1')) {
            const stud = dbTables.students.find((s) => s.id === params[0]);
            return {
              rows: stud ? [stud] : [],
              rowCount: stud ? 1 : 0,
            };
          }

          // 5. Academic history query (all records for student)
          if (trimmed.includes('from public.student_academic_records r') && trimmed.includes('where r.student_id = $1')) {
            const records = dbTables.student_academic_records.filter((r) => r.student_id === params[0]);
            const rows = records.map((r) => {
              const yr = dbTables.academic_years.find((y) => y.id === r.academic_year_id) || { label: '2026-2027', start_date: '2026-06-01' };
              const gr = dbTables.grade_levels.find((g) => g.id === r.grade_level_id) || { name: 'Standard 1' };
              const sec = dbTables.sections.find((s) => s.id === r.section_id) || { name: 'Section A' };
              return {
                record_id: r.id,
                admission_number: r.admission_number,
                status: r.status,
                admission_date: r.admission_date,
                academic_year_id: r.academic_year_id,
                academic_year_label: yr.label,
                year_start_date: yr.start_date,
                grade_level_id: gr.id,
                grade_level_name: gr.name,
                section_id: sec.id,
                section_name: sec.name,
                roll_number: r.roll_number,
                transport_opted_in: r.transport_opted_in,
                notes: r.notes,
                created_at: r.created_at,
              };
            });
            rows.sort((a, b) => (b.year_start_date > a.year_start_date ? 1 : -1));
            return { rows, rowCount: rows.length };
          }

          // 6. Guardians query
          if (trimmed.includes('from public.student_guardians sg')) {
            const sId = params[0];
            const links = dbTables.student_guardians.filter((sg) => sg.student_id === sId);
            const rows = links.map((sg) => {
              const g = dbTables.guardians.find((x) => x.id === sg.guardian_id) || {};
              return {
                id: g.id,
                relationship: sg.relationship_type || g.relationship_to_student || '',
                full_name: g.full_name,
                phone: g.phone,
                email: g.email,
                occupation: g.occupation,
                address_line_1: g.address_line_1,
                is_primary_contact: sg.is_primary_contact,
              };
            });
            return { rows, rowCount: rows.length };
          }

          // 7. Sensitive details query
          if (trimmed.includes('from public.student_sensitive_details')) {
            const sId = params[0];
            const found = dbTables.student_sensitive_details.find((d) => d.student_id === sId);
            return {
              rows: found ? [found] : [],
              rowCount: found ? 1 : 0,
            };
          }

          // 8. Documents query
          if (trimmed.includes('from public.student_documents d')) {
            const sId = params[0];
            const docs = dbTables.student_documents.filter((d) => d.student_id === sId);
            const rows = docs.map((d) => {
              const dt = dbTables.document_types.find((t) => t.id === d.document_type_id) || { code: 'DOC', name: 'Document' };
              return {
                id: d.id,
                document_type_code: dt.code,
                document_type_name: dt.name,
                verification_status: d.verification_status,
                replaces_document_id: d.replaces_document_id,
                uploaded_at: d.created_at,
                created_at: d.created_at,
              };
            });
            return { rows, rowCount: rows.length };
          }

          // 9. Certificates query
          if (trimmed.includes('from public.student_year_certificates')) {
            const rId = params[0];
            const certs = dbTables.student_year_certificates.filter((c) => c.student_academic_record_id === rId);
            return {
              rows: certs.map((c) => ({
                id: c.id,
                certificate_type: c.certificate_type,
                certificate_number: c.certificate_number,
                status: c.status,
                issued_at: c.issued_at,
              })),
              rowCount: certs.length,
            };
          }

          // 10. Audit logs query (for status history)
          if (trimmed.includes('from public.audit_logs a')) {
            const rId = params[0];
            const logs = dbTables.audit_logs.filter((a) => a.entity_id === rId && a.action === 'STUDENT_STATUS_CHANGED');
            return {
              rows: logs.map((a) => ({
                id: a.id,
                academic_record_id: a.entity_id,
                action: a.action,
                actor_staff_id: a.actor_staff_id,
                outcome: a.outcome,
                reason: a.reason,
                before_snapshot: a.before_snapshot,
                after_snapshot: a.after_snapshot,
                created_at: a.created_at,
                changed_by_staff_name: 'Dr. Ramesh Kulkarni (Principal)',
              })),
              rowCount: logs.length,
            };
          }

          // 11. Academic record by id (for update / verification)
          if (trimmed.includes('from public.student_academic_records where id = $1')) {
            const rId = params[0];
            const rec = dbTables.student_academic_records.find((r) => r.id === rId);
            return {
              rows: rec ? [rec] : [],
              rowCount: rec ? 1 : 0,
            };
          }

          // 12. Academic year check (closed check)
          if (trimmed.includes('from public.academic_years where id = $1')) {
            const yId = params[0];
            const yr = dbTables.academic_years.find((y) => y.id === yId);
            return {
              rows: yr ? [yr] : [],
              rowCount: yr ? 1 : 0,
            };
          }

          // 13. Update student academic record status
          if (trimmed.startsWith('update public.student_academic_records')) {
            const [status, nowIso, id] = params;
            const rec = dbTables.student_academic_records.find((r) => r.id === id);
            if (rec) {
              rec.status = status;
              rec.updated_at = nowIso;
              return {
                rows: [{ id: rec.id, student_id: rec.student_id, admission_number: rec.admission_number, status }],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }

          // 14. Insert audit logs
          if (trimmed.startsWith('insert into public.audit_logs')) {
            if (trimmed.includes("'STUDENT_STATUS_CHANGED'")) {
              dbTables.audit_logs.push({
                id: `audit-${dbTables.audit_logs.length + 1}`,
                actor_staff_id: params[0],
                action: 'STUDENT_STATUS_CHANGED',
                entity_type: 'student_academic_records',
                entity_id: params[1],
                outcome: 'SUCCESS',
                reason: params[2],
                before_snapshot: params[3],
                after_snapshot: params[4],
                created_at: new Date().toISOString(),
              });
            } else if (trimmed.includes("'SENSITIVE_PII_VIEWED'")) {
              dbTables.audit_logs.push({
                id: `audit-${dbTables.audit_logs.length + 1}`,
                actor_staff_id: params[0],
                action: 'SENSITIVE_PII_VIEWED',
                entity_type: 'student',
                entity_id: params[1],
                outcome: 'SUCCESS',
                reason: params[2] || 'Authorized PII viewed',
                created_at: new Date().toISOString(),
              });
            }
            return { rows: [], rowCount: 1 };
          }

          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      };
      return client;
    };

    const mockPool = {
      connect: vi.fn().mockImplementation(async () => createMockClient()),
      query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        const c = createMockClient();
        return c.query(sql, params);
      }),
      end: vi.fn().mockResolvedValue(undefined),
    };

    setPostgresPoolForTesting(mockPool as any);

    repo = new PostgresStudentRecordsRepository();
    service = new StudentRecordsService(repo);
  });

  afterEach(async () => {
    await closePostgresPool();
    setPersistenceMode('in-memory');
  });

  describe('1. Student Profile Lookup Through All Supported Identifiers (Task 2)', () => {
    it('retrieves student profile using academic-record ID (rec-2026-001)', async () => {
      const profile = await service.getStudentProfile('rec-2026-001', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
      expect(profile.demographics.firstName).toBe('Aarav');
      expect(profile.currentAcademicRecord.academicRecordId).toBe('rec-2026-001');
      expect(profile.currentAcademicRecord.status).toBe('active');
    });

    it('retrieves student profile using student ID (stud-001)', async () => {
      const profile = await service.getStudentProfile('stud-001', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
      expect(profile.demographics.lastName).toBe('Sharma');
      // Defaults to active/current academic year
      expect(profile.currentAcademicRecord.academicYearId).toBe(currentYearId);
    });

    it('retrieves student profile using admission number (ADM-2025-0001)', async () => {
      const profile = await service.getStudentProfile('ADM-2025-0001', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
      expect(profile.demographics.firstName).toBe('Aarav');
    });

    it('retrieves student profile using case-insensitive admission number (adm-2025-0001)', async () => {
      const profile = await service.getStudentProfile('adm-2025-0001', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
    });

    it('retrieves student profile using STS number (STS-2026-789)', async () => {
      const profile = await service.getStudentProfile('STS-2026-789', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
      expect(profile.demographics.stsNumber).toBe('STS-2026-789');
    });

    it('retrieves student profile using DISE number (DISE-29-001)', async () => {
      const profile = await service.getStudentProfile('DISE-29-001', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
      expect(profile.demographics.diseNumber).toBe('DISE-29-001');
    });

    it('retrieves student profile using application number (1/2026-27)', async () => {
      const profile = await service.getStudentProfile('1/2026-27', undefined, principalSession);
      expect(profile).toBeDefined();
      expect(profile.studentId).toBe('stud-001');
    });

    it('throws NotFoundError when identifier cannot be resolved to any student record', async () => {
      await expect(
        service.getStudentProfile('non-existent-id-999', undefined, principalSession)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('2. Complete Academic History Across Multiple Academic Years (Task 3)', () => {
    it('retrieves complete academic history across multiple academic years (not a placeholder)', async () => {
      const profile = await service.getStudentProfile('stud-001', undefined, principalSession);

      expect(profile.academicHistory).toBeDefined();
      expect(Array.isArray(profile.academicHistory)).toBe(true);
      expect(profile.academicHistory.length).toBe(2);

      // Chronological order: latest (2026-2027) first, followed by prior (2025-2026)
      expect(profile.academicHistory[0].academicYearId).toBe(currentYearId);
      expect(profile.academicHistory[0].gradeLevelName).toBe('Standard 2');
      expect(profile.academicHistory[0].status).toBe('active');

      expect(profile.academicHistory[1].academicYearId).toBe(priorYearId);
      expect(profile.academicHistory[1].gradeLevelName).toBe('Standard 1');
      expect(profile.academicHistory[1].status).toBe('admitted');
    });

    it('respects requestedAcademicYearId to select historical year as currentAcademicRecord', async () => {
      const profile = await service.getStudentProfile('stud-001', priorYearId, principalSession);

      // currentAcademicRecord should be the 2025-2026 prior year
      expect(profile.currentAcademicRecord.academicYearId).toBe(priorYearId);
      expect(profile.currentAcademicRecord.gradeLevelName).toBe('Standard 1');
      expect(profile.currentAcademicRecord.status).toBe('admitted');

      // academicHistory still retains all 2 years
      expect(profile.academicHistory.length).toBe(2);
    });
  });

  describe('3. Durable Status History Persistence Across Process Restarts (Task 4, 10)', () => {
    it('records status transition to PostgreSQL audit logs and survives re-instantiation', async () => {
      // Transition student status to transferred
      const updateResult = await service.markStudentStatus(
        'rec-2026-001',
        {
          academicRecordId: 'rec-2026-001',
          newStatus: 'transferred',
          exitDate: '2026-10-25',
          exitReason: 'Family relocating to Mumbai for job transfer',
        },
        principalSession
      );

      expect(updateResult.newStatus).toBe('transferred');
      expect(updateResult.previousStatus).toBe('active'); // Actual previous status, not hardcoded admitted!

      // Simulate complete process restart by instantiating new repository & service
      const restartedRepo = new PostgresStudentRecordsRepository();
      const restartedService = new StudentRecordsService(restartedRepo);

      // Retrieve profile via new instance
      const profile = await restartedService.getStudentProfile('stud-001', undefined, principalSession);
      expect(profile.currentAcademicRecord.status).toBe('transferred');

      // Status history must survive process restart from durable PostgreSQL records
      expect(profile.statusHistory).toBeDefined();
      expect(profile.statusHistory.length).toBe(1);
      expect(profile.statusHistory[0].newStatus).toBe('transferred');
      expect(profile.statusHistory[0].previousStatus).toBe('active');
      expect(profile.statusHistory[0].effectiveDate).toBe('2026-10-25');
      expect(profile.statusHistory[0].reason).toContain('Family relocating to Mumbai');
      expect(profile.statusHistory[0].changedByStaffName).toBe('Dr. Ramesh Kulkarni (Principal)');

      // Verify direct getStatusHistory also survives
      const directHistory = await restartedService.getStatusHistory('rec-2026-001', principalSession);
      expect(directHistory.length).toBe(1);
      expect(directHistory[0].reason).toContain('Family relocating to Mumbai');
    });

    it('returns actual previous status (active) when student was active', async () => {
      const res = await service.markStudentStatus(
        'rec-2026-001',
        {
          academicRecordId: 'rec-2026-001',
          newStatus: 'left',
          exitDate: '2026-11-01',
          exitReason: 'Parent employment change',
        },
        principalSession
      );

      // Task 8: Return actual previous and new status values
      expect(res.previousStatus).toBe('active');
      expect(res.newStatus).toBe('left');
    });
  });

  describe('4. Status Transition Workflow & Boundary Invariants (Task 6, 7, 8)', () => {
    it('denies status change when student is already left or transferred (state machine invariant)', async () => {
      // First, mark left
      await service.markStudentStatus(
        'rec-2026-001',
        {
          academicRecordId: 'rec-2026-001',
          newStatus: 'left',
          exitDate: '2026-11-01',
          exitReason: 'Course completion',
        },
        principalSession
      );

      // Second attempt must be rejected: status change only allowed from admitted or active
      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'transferred',
            exitDate: '2026-11-02',
            exitReason: 'Relocation',
          },
          principalSession
        )
      ).rejects.toThrow(BusinessRuleError);
    });

    it('denies status change in a closed academic year (SBR-05)', async () => {
      // rec-2025-001 belongs to priorYearId which is closed
      await expect(
        service.markStudentStatus(
          'rec-2025-001',
          {
            academicRecordId: 'rec-2025-001',
            newStatus: 'left',
            exitDate: '2025-12-15',
            exitReason: 'Withdrawn mid-year',
          },
          principalSession
        )
      ).rejects.toThrow(BusinessRuleError);
    });

    it('denies non-Principal roles from executing mark-left transition (US-32, R-06)', async () => {
      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'left',
            exitDate: '2026-11-01',
            exitReason: 'Relocation',
          },
          admissionOfficerSession
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'left',
            exitDate: '2026-11-01',
            exitReason: 'Relocation',
          },
          accountantSession
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'left',
            exitDate: '2026-11-01',
            exitReason: 'Relocation',
          },
          clerkSession
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('validates mandatory exit date and exit reason', async () => {
      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'left',
            exitDate: 'invalid-date',
            exitReason: 'Relocation',
          },
          principalSession
        )
      ).rejects.toThrow(ValidationError);

      await expect(
        service.markStudentStatus(
          'rec-2026-001',
          {
            academicRecordId: 'rec-2026-001',
            newStatus: 'left',
            exitDate: '2026-11-01',
            exitReason: 'ab', // < 3 chars
          },
          principalSession
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('5. Role-Based PII Authorization and Masking (Task 9, 11)', () => {
    it('provides masked & unmasked Aadhaar and sensitive demographic details to Principal and Admission Officer', async () => {
      // Principal view
      const principalView = await service.getStudentProfile('stud-001', undefined, principalSession);
      expect(principalView.sensitiveDetails).not.toBeNull();
      expect(principalView.sensitiveDetails?.aadhaarNumberMasked).toContain('5544');
      expect(principalView.sensitiveDetails?.aadhaarNumberUnmasked).toBe('998877665544');
      expect(principalView.sensitiveDetails?.casteCategory).toBe('General');
      expect(principalView.documents).not.toBeNull();
      expect(principalView.documents?.length).toBeGreaterThan(0);

      // Admission Officer view
      const admView = await service.getStudentProfile('stud-001', undefined, admissionOfficerSession);
      expect(admView.sensitiveDetails).not.toBeNull();
      expect(admView.sensitiveDetails?.aadhaarNumberMasked).toContain('5544');
      expect(admView.sensitiveDetails?.aadhaarNumberUnmasked).toBe('998877665544');
      expect(admView.documents).not.toBeNull();

      // Audit event recorded for sensitive PII view
      const piiAudits = dbTables.audit_logs.filter((a) => a.action === 'SENSITIVE_PII_VIEWED');
      expect(piiAudits.length).toBeGreaterThan(0);
    });

    it('does NOT expose sensitive details or documents to Accounts Officer (Task 11)', async () => {
      const accountantView = await service.getStudentProfile('stud-001', undefined, accountantSession);
      expect(accountantView.sensitiveDetails).toBeNull();
      expect(accountantView.documents).toBeNull();
    });

    it('does NOT expose sensitive details or documents to System Administrator (Task 11)', async () => {
      const sysAdminView = await service.getStudentProfile('stud-001', undefined, sysAdminSession);
      expect(sysAdminView.sensitiveDetails).toBeNull();
      expect(sysAdminView.documents).toBeNull();
    });

    it('does NOT expose sensitive details or documents to Clerk or Read-Only staff', async () => {
      const clerkView = await service.getStudentProfile('stud-001', undefined, clerkSession);
      expect(clerkView.sensitiveDetails).toBeNull();
      expect(clerkView.documents).toBeNull();
    });
  });

  describe('6. Handling Missing Related Data Explicitly Without Fabricated Defaults', () => {
    it('handles student with null optional demographics explicitly without fabricating defaults', async () => {
      // Insert a student with sparse details
      dbTables.students.push({
        id: 'stud-sparse',
        first_name: 'Rohit',
        last_name: 'Verma',
        dob: '2020-01-01',
        gender: 'male',
        nationality: null,
        mother_tongue: null,
        blood_group: null,
        religion: null,
        caste: null,
        subcaste: null,
        category: null,
        sts_number: null,
        dise_number: null,
        transport_opted_in: false,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        pincode: null,
      });

      dbTables.student_academic_records.push({
        id: 'rec-sparse-001',
        student_id: 'stud-sparse',
        academic_year_id: currentYearId,
        grade_level_id: std1GradeId,
        section_id: null,
        admission_number: 'ADM-2026-0999',
        status: 'admitted',
        admission_date: null,
        roll_number: null,
        transport_opted_in: false,
        notes: null,
        created_at: '2026-06-01T09:00:00.000Z',
      });

      const profile = await service.getStudentProfile('stud-sparse', undefined, principalSession);

      // Explicitly undefined/missing rather than fabricated 'Indian', 'Kannada', 'Bangalore', 'Karnataka', '560001'
      expect(profile.demographics.nationality).toBeUndefined();
      expect(profile.demographics.motherTongue).toBeUndefined();
      expect(profile.demographics.bloodGroup).toBeUndefined();
      expect(profile.demographics.religion).toBeUndefined();
      expect((profile.demographics as any).caste).toBeUndefined();
      expect(profile.demographics.city).toBeUndefined();
      expect(profile.demographics.state).toBeUndefined();
      expect(profile.demographics.pincode).toBeUndefined();
    });
  });

  describe('7. Related Profile Information: Documents, Fees, Receipts & Certificates (Task 5)', () => {
    it('populates related certificates, documents, fee summary, and receipts for authorized staff', async () => {
      const profile = await service.getStudentProfile('stud-001', undefined, principalSession);

      // Certificates
      expect(profile.certificates).toBeDefined();
      expect(profile.certificates.length).toBe(1);
      expect(profile.certificates[0].certificateType).toBe('TC');
      expect(profile.certificates[0].status).toBe('draft');

      // Documents (Principal is authorized)
      expect(profile.documents).toBeDefined();
      expect(profile.documents?.length).toBe(1);
      expect(profile.documents?.[0].documentTypeCode).toBe('BIRTH_CERTIFICATE');

      // Guardians
      expect(profile.guardians.length).toBe(1);
      expect(profile.guardians[0].fullName).toBe('Vikram Sharma');
      expect(profile.guardians[0].isPrimaryContact).toBe(true);

      // Demographics
      expect(profile.demographics.firstName).toBe('Aarav');
      expect(profile.demographics.dateOfBirth).toBe('2019-05-15');
    });
  });
});
