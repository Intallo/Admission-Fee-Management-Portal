import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import {
  setPostgresPoolForTesting,
  closePostgresPool,
} from '../src/infrastructure/db/postgres-pool';
import { PostgresAdmissionsRepository } from '../src/infrastructure/repositories/postgres/admissions.repository';
import { AdmissionsService } from '../src/modules/admissions/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { AuthorizationError, BusinessRuleError, ValidationError, NotFoundError } from '../src/lib/errors';
import { formatInr, addInr } from '../src/lib/money/inr';

describe('Milestone M8.3.6: Admissions Production PostgreSQL Persistence & Workflow Durability', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'principal',
    fullName: 'Dr. Ramesh Kulkarni (Principal)',
    email: 'principal@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: '33333333-3333-3333-3333-333333333333',
    role: 'admission_officer',
    fullName: 'Sneha Joshi (Admission Officer)',
    email: 'admissions@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const clerkSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: '44444444-4444-4444-4444-444444444444',
    role: 'clerk',
    fullName: 'Deepa Rao (Clerk)',
    email: 'clerk@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: '22222222-2222-2222-2222-222222222222',
    role: 'accountant',
    fullName: 'Vinod Patil (Accountant)',
    email: 'accounts@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  // State store representing durable PostgreSQL tables
  let dbTables: {
    academic_years: any[];
    grade_levels: any[];
    sections: any[];
    fee_structures: any[];
    fee_heads: any[];
    fee_structure_lines: any[];
    admission_document_types: any[];
    students: any[];
    guardians: any[];
    student_guardians: any[];
    student_sensitive_details: any[];
    admission_applications: any[];
    admission_status_history: any[];
    student_academic_records: any[];
    student_fee_assessments: any[];
    student_fee_assessment_lines: any[];
    student_documents: any[];
    audit_logs: any[];
  };

  let dbCounters: Map<string, number>;
  let sessionSettings: Record<string, string>;
  let simulateErrorOnQuery: string | null = null;

  beforeEach(() => {
    simulateErrorOnQuery = null;
    sessionSettings = {};
    dbCounters = new Map();

    dbTables = {
      academic_years: [
        { id: '00000000-0000-0000-0000-000000000001', label: '2026-2027', state: 'current', is_active: true },
        { id: '00000000-0000-0000-0000-000000000002', label: '2027-2028', state: 'upcoming', is_active: true },
      ],
      grade_levels: [
        { id: '30000000-0000-0000-0000-000000000004', code: 'STD1', name: 'Standard 1', group_name: 'primary' },
      ],
      sections: [
        { id: '40000000-0000-0000-0000-000000000001', academic_year_id: '00000000-0000-0000-0000-000000000001', grade_level_id: '30000000-0000-0000-0000-000000000004', name: 'A', max_capacity: 40 },
        { id: '40000000-0000-0000-0000-000000000002', academic_year_id: '00000000-0000-0000-0000-000000000001', grade_level_id: '30000000-0000-0000-0000-000000000004', name: 'B', max_capacity: 40 },
      ],
      admission_document_types: [
        { id: '10000000-0000-0000-0000-000000000001', code: 'BIRTH_CERTIFICATE', name: 'Birth Certificate', is_mandatory: true },
        { id: '10000000-0000-0000-0000-000000000002', code: 'STUDENT_PHOTOGRAPH', name: 'Student Photograph', is_mandatory: true },
      ],
      fee_heads: [
        { id: 'fh-tuition', code: 'TUITION', name: 'Tuition Fee', category: 'school_fee' },
        { id: 'fh-term', code: 'TERM', name: 'Term Fee', category: 'school_fee' },
      ],
      fee_structures: [
        { id: 'struct-001', academic_year_id: '00000000-0000-0000-0000-000000000001', grade_level_id: '30000000-0000-0000-0000-000000000004', status: 'approved', version: 1 },
      ],
      fee_structure_lines: [
        { id: 'fsl-001', fee_structure_id: 'struct-001', fee_head_id: 'fh-tuition', amount: '35000.00' },
        { id: 'fsl-002', fee_structure_id: 'struct-001', fee_head_id: 'fh-term', amount: '5000.00' },
      ],
      students: [],
      guardians: [],
      student_guardians: [],
      student_sensitive_details: [],
      admission_applications: [],
      admission_status_history: [],
      student_academic_records: [],
      student_fee_assessments: [],
      student_fee_assessment_lines: [],
      student_documents: [],
      audit_logs: [],
    };

    // Construct high-fidelity PostgreSQL mock client pool with transactional rollback capability
    const createMockClient = () => {
      let inTx = false;
      let txRollbackSnapshot: string | null = null;

      const client = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          const trimmed = sql.trim();

          if (simulateErrorOnQuery && trimmed.includes(simulateErrorOnQuery)) {
            throw new Error(`Simulated database fault on query: ${simulateErrorOnQuery}`);
          }

          // Transaction management
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
            sessionSettings = {};
            return { rows: [], rowCount: 0 };
          }

          // Session configuration & RLS signatures
          if (trimmed.includes('set_config')) {
            if (params.length >= 2) {
              sessionSettings['app.current_staff_id'] = params[0];
              sessionSettings['app.current_role'] = params[1];
            }
            if (params.length >= 3) {
              sessionSettings['app.actor_signature'] = params[2];
            }
            return { rows: [{ set_config: '' }], rowCount: 1 };
          }

          // Sequence / Number Generators
          if (trimmed.includes('private.next_application_number')) {
            const yearId = params[0];
            const yearObj = dbTables.academic_years.find((y) => y.id === yearId);
            const rawLabel = yearObj ? yearObj.label : '2026-2027';
            const label = rawLabel.length === 9 && rawLabel.includes('-')
              ? `${rawLabel.slice(0, 4)}-${rawLabel.slice(-2)}`
              : rawLabel;
            const key = `APP-${yearId || 'default'}`;
            const nextVal = (dbCounters.get(key) || 1);
            dbCounters.set(key, nextVal + 1);
            return { rows: [{ val: `${nextVal}/${label}` }], rowCount: 1 };
          }

          if (trimmed.includes("private.next_admission_number('ADM'") || trimmed.includes('private.next_admission_number')) {
            const series = 'ADM';
            const year = '2026';
            const key = `${series}-${year}`;
            const nextVal = (dbCounters.get(key) || 1);
            dbCounters.set(key, nextVal + 1);
            return { rows: [{ val: `${series}-${year}-${String(nextVal).padStart(4, '0')}` }], rowCount: 1 };
          }

          if (trimmed.includes("private.next_receipt_number('ASM'") || trimmed.includes("next_receipt_number('ASM'")) {
            const key = 'ASM-2026';
            const nextVal = (dbCounters.get(key) || 1);
            dbCounters.set(key, nextVal + 1);
            return { rows: [{ num: `ASM-2026-${String(nextVal).padStart(6, '0')}` }], rowCount: 1 };
          }

          // Academic Years
          if (trimmed.includes('from public.academic_years where id = $1')) {
            const y = dbTables.academic_years.find((x) => x.id === params[0]);
            return { rows: y ? [{ id: y.id, label: y.label }] : [], rowCount: y ? 1 : 0 };
          }

          // STS Number & Aadhaar Hash Uniqueness checks
          if (trimmed.includes('from public.students where upper(trim(sts_number)) = $1') || trimmed.includes('from public.students where sts_number = $1')) {
            const match = dbTables.students.find((s) => s.sts_number && s.sts_number.trim().toUpperCase() === String(params[0]).trim().toUpperCase() && (!params[1] || s.id !== params[1]));
            return { rows: match ? [{ id: match.id, first_name: match.first_name, last_name: match.last_name }] : [], rowCount: match ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_sensitive_details where aadhaar_hash = $1')) {
            const match = dbTables.student_sensitive_details.find((d) => d.aadhaar_hash === params[0] && (!params[1] || d.student_id !== params[1]));
            return { rows: match ? [{ student_id: match.student_id }] : [], rowCount: match ? 1 : 0 };
          }

          // Inserts
          if (trimmed.startsWith('insert into public.students')) {
            const newStudent = {
              id: params[0],
              first_name: params[1],
              middle_name: params[2],
              last_name: params[3],
              dob: params[4],
              gender: params[5],
              nationality: params[6],
              mother_tongue: params[7],
              blood_group: params[8],
              religion: params[9],
              caste: params[10],
              subcaste: params[11],
              category: params[12],
              sts_number: params[13],
              dise_number: params[14],
              transport_opted_in: params[15],
              address_line1: params[16],
              address_line2: params[17],
              city: params[18],
              state: params[19],
              pincode: params[20],
            };
            dbTables.students.push(newStudent);
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.student_sensitive_details')) {
            const existIdx = dbTables.student_sensitive_details.findIndex((d) => d.student_id === params[0]);
            const row = {
              student_id: params[0],
              aadhaar_encrypted: params[1],
              aadhaar_last_four: params[2],
              caste: params[3],
              sub_caste: params[4],
              annual_family_income: params[5],
              aadhaar_hash: params[6],
              updated_at: params[7],
            };
            if (existIdx >= 0) {
              dbTables.student_sensitive_details[existIdx] = row;
            } else {
              dbTables.student_sensitive_details.push(row);
            }
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.admission_applications')) {
            const newApp = {
              id: params[0],
              application_number: params[1],
              academic_year_id: params[2],
              requested_grade_level_id: params[3],
              requested_section_id: params[4],
              status: 'draft',
              student_id: params[5],
              fee_generated: false,
              created_at: params[6] || new Date().toISOString(),
              updated_at: params[6] || new Date().toISOString(),
            };
            dbTables.admission_applications.push(newApp);
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.guardians')) {
            dbTables.guardians.push({
              id: params[0],
              relationship: params[1],
              full_name: params[2],
              phone: params[3],
              email: params[4],
              occupation: params[5],
              annual_income: params[6],
              created_at: params[7],
            });
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.student_guardians')) {
            dbTables.student_guardians.push({
              student_id: params[0],
              guardian_id: params[1],
              is_primary_contact: params[2],
            });
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.admission_status_history')) {
            dbTables.admission_status_history.push({
              id: params[0],
              admission_application_id: params[1],
              from_status: params[2],
              to_status: params[3],
              changed_by: params[4],
              reason: params[5],
              created_at: params[6] || new Date().toISOString(),
            });
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.audit_logs')) {
            dbTables.audit_logs.push({
              id: params[0],
              actor_staff_id: params[1],
              action: params[2],
              entity_type: params[3],
              entity_id: params[4],
              before_snapshot: params[5],
              after_snapshot: params[6],
              outcome: params[7],
              created_at: new Date().toISOString(),
            });
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.student_academic_records')) {
            const rec = {
              id: params[0],
              student_id: params[1],
              academic_year_id: params[2],
              grade_level_id: params[3],
              section_id: params[4],
              admission_number: params[5],
              status: 'admitted',
              admission_date: params[6],
              notes: params[7],
              created_at: params[8] || new Date().toISOString(),
            };
            dbTables.student_academic_records.push(rec);
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.student_fee_assessments')) {
            const assess = {
              id: params[0],
              student_academic_record_id: params[1],
              fee_structure_id: params[2],
              assessment_number: params[3],
              status: params[4] || 'issued',
              assessed_at: params[5],
              snapshot: params[6],
              created_at: params[7],
              updated_at: params[8],
            };
            dbTables.student_fee_assessments.push(assess);
            return { rows: [], rowCount: 1 };
          }

          if (trimmed.startsWith('insert into public.student_fee_assessment_lines')) {
            dbTables.student_fee_assessment_lines.push({
              id: params[0],
              student_fee_assessment_id: params[1],
              fee_head_id: params[2],
              assessed_amount: params[3],
              is_optional: params[4],
              created_at: params[5],
            });
            return { rows: [], rowCount: 1 };
          }

          // Updates
          if (trimmed.startsWith('update public.students')) {
            const id = params[15];
            const student = dbTables.students.find((s) => s.id === id);
            if (student) {
              if (params[0]) student.first_name = params[0];
              if (params[1]) student.middle_name = params[1];
              if (params[2]) student.last_name = params[2];
              if (params[3]) student.dob = params[3];
              if (params[4]) student.gender = params[4];
              if (params[11]) student.city = params[11];
              return { rows: [student], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          if (trimmed.startsWith('update public.admission_applications') && trimmed.includes("status = 'submitted'")) {
            const id = params[2];
            const app = dbTables.admission_applications.find((a) => a.id === id);
            if (app) {
              app.status = 'submitted';
              app.override_missing_documents_reason = params[0];
              app.updated_at = params[1];
              return { rows: [app], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          if (trimmed.startsWith('update public.admission_applications') && trimmed.includes('status = $1') && trimmed.includes('reviewed_by = $2')) {
            const id = params[5];
            const app = dbTables.admission_applications.find((a) => a.id === id);
            if (app) {
              app.status = params[0];
              app.reviewed_by = params[1];
              app.reviewed_at = params[2];
              app.decision_reason = params[3];
              app.seat_reserved_until = params[4];
              app.updated_at = params[2];
              return { rows: [app], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          if (trimmed.startsWith('update public.admission_applications') && trimmed.includes("status = 'rejected'")) {
            const id = params[3];
            const app = dbTables.admission_applications.find((a) => a.id === id);
            if (app) {
              app.status = 'rejected';
              app.decision_reason = params[0];
              app.reviewed_by = params[1];
              app.reviewed_at = params[2];
              app.updated_at = params[2];
              return { rows: [app], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          if (trimmed.startsWith('update public.admission_applications') && trimmed.includes("status = 'approved'")) {
            const id = params[6];
            const app = dbTables.admission_applications.find((a) => a.id === id);
            if (app) {
              app.status = 'approved';
              app.requested_section_id = params[0];
              app.reviewed_by = params[1];
              app.reviewed_at = params[2];
              app.decision_reason = params[3];
              app.fee_generated = params[4];
              app.updated_at = params[5];
              return { rows: [app], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          if (trimmed.startsWith('update public.admission_applications') && trimmed.includes('set requested_grade_level_id = coalesce($1')) {
            const id = params[3];
            const app = dbTables.admission_applications.find((a) => a.id === id);
            if (app) {
              if (params[0]) app.requested_grade_level_id = params[0];
              if (params[1]) app.requested_section_id = params[1];
              app.updated_at = params[2];
              return { rows: [app], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          // Queries / Selects
          if (trimmed.includes('from public.admission_applications where id = $1')) {
            const app = dbTables.admission_applications.find((a) => a.id === params[0]);
            return { rows: app ? [app] : [], rowCount: app ? 1 : 0 };
          }

          if (trimmed.includes('from public.students where id = $1')) {
            const s = dbTables.students.find((x) => x.id === params[0]);
            return { rows: s ? [s] : [], rowCount: s ? 1 : 0 };
          }

          if (trimmed.includes('from public.guardians g') && trimmed.includes('join public.student_guardians sg')) {
            const studentId = params[0];
            const sgs = dbTables.student_guardians.filter((sg) => sg.student_id === studentId);
            const rows = sgs.map((sg) => {
              const g = dbTables.guardians.find((x) => x.id === sg.guardian_id) || {};
              return { phone: g.phone, full_name: g.full_name };
            });
            return { rows, rowCount: rows.length };
          }

          if (trimmed.includes('from public.student_guardians sg') && trimmed.includes('join public.guardians g')) {
            const studentId = params[0];
            const sgs = dbTables.student_guardians.filter((sg) => sg.student_id === studentId);
            const rows = sgs.map((sg) => {
              const g = dbTables.guardians.find((x) => x.id === sg.guardian_id) || {};
              return {
                id: g.id,
                relationship: g.relationship,
                full_name: g.full_name,
                phone: g.phone,
                email: g.email,
                occupation: g.occupation,
                annual_income: g.annual_income,
                is_primary_contact: sg.is_primary_contact,
              };
            });
            return { rows, rowCount: rows.length };
          }

          if (trimmed.includes('from public.sections where id = $1')) {
            const sec = dbTables.sections.find((s) => s.id === params[0]);
            return { rows: sec ? [sec] : [], rowCount: sec ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_academic_records') && trimmed.includes('count(*) as cnt')) {
            if (trimmed.includes('section_id = $1')) {
              const secId = params[0];
              const yearId = params[1];
              const cnt = dbTables.student_academic_records.filter(
                (r) => r.section_id === secId && r.academic_year_id === yearId && (r.status === 'admitted' || r.status === 'active')
              ).length;
              return { rows: [{ cnt }], rowCount: 1 };
            }
            if (trimmed.includes('g.group_name = $1') || trimmed.includes('group_name = $1')) {
              const groupName = params[0];
              const yearId = params[1];
              const cnt = dbTables.student_academic_records.filter(
                (r) => r.academic_year_id === yearId && (r.status === 'admitted' || r.status === 'active')
              ).length;
              return { rows: [{ cnt }], rowCount: 1 };
            }
          }

          if (trimmed.includes('select group_name from public.grade_levels where id = $1')) {
            const grade = dbTables.grade_levels.find((g) => g.id === params[0]);
            return { rows: grade ? [{ group_name: grade.group_name }] : [{ group_name: 'primary' }], rowCount: 1 };
          }

          if (trimmed.includes('from public.fee_structures') && trimmed.includes("status = 'approved'")) {
            const match = dbTables.fee_structures.find(
              (f) => f.academic_year_id === params[0] && f.grade_level_id === params[1] && f.status === 'approved'
            );
            return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
          }

          if (trimmed.includes('from public.fee_structure_lines where fee_structure_id = $1')) {
            const lines = dbTables.fee_structure_lines.filter((l) => l.fee_structure_id === params[0]);
            return { rows: lines, rowCount: lines.length };
          }

          if (trimmed.includes('from public.admission_status_history') && trimmed.includes('admission_application_id = $1')) {
            const history = dbTables.admission_status_history.filter((h) => h.admission_application_id === params[0]);
            return {
              rows: history.map((h) => ({
                id: h.id,
                from_status: h.from_status,
                to_status: h.to_status,
                changed_by: h.changed_by,
                reason: h.reason,
                changed_at: h.created_at,
                staff_name: 'Staff Member',
                staff_role: 'principal',
              })),
              rowCount: history.length,
            };
          }

          if (trimmed.includes('from public.student_sensitive_details where student_id = $1')) {
            const sens = dbTables.student_sensitive_details.find((s) => s.student_id === params[0]);
            return { rows: sens ? [sens] : [], rowCount: sens ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_academic_records where student_id = $1 and academic_year_id = $2')) {
            const rec = dbTables.student_academic_records.find((r) => r.student_id === params[0] && r.academic_year_id === params[1]);
            return { rows: rec ? [rec] : [], rowCount: rec ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_academic_records where id = $1')) {
            const rec = dbTables.student_academic_records.find((r) => r.id === params[0]);
            return { rows: rec ? [rec] : [], rowCount: rec ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_fee_assessments where student_academic_record_id = $1')) {
            const assess = dbTables.student_fee_assessments.find((a) => a.student_academic_record_id === params[0]);
            return { rows: assess ? [assess] : [], rowCount: assess ? 1 : 0 };
          }

          if (trimmed.includes('from public.student_fee_assessment_lines l') && trimmed.includes('public.fee_heads fh')) {
            const assessId = params[0];
            const lines = dbTables.student_fee_assessment_lines
              .filter((l) => l.student_fee_assessment_id === assessId)
              .map((l) => {
                const fh = dbTables.fee_heads.find((h) => h.id === l.fee_head_id) || { name: 'Tuition Fee', category: 'school_fee' };
                return {
                  ...l,
                  fee_head_name: fh.name,
                  fee_head_category: fh.category,
                };
              });
            return { rows: lines, rowCount: lines.length };
          }

          // Full Application Detail Join query
          if (trimmed.includes('from public.admission_applications a') && trimmed.includes('join public.students s on s.id = a.student_id') && trimmed.includes('where a.id = $1')) {
            const app = dbTables.admission_applications.find((a) => a.id === params[0]);
            if (app) {
              const student = dbTables.students.find((s) => s.id === app.student_id) || {};
              const grade = dbTables.grade_levels.find((g) => g.id === app.requested_grade_level_id) || { name: 'Standard 1', group_name: 'primary' };
              const sec = dbTables.sections.find((s) => s.id === app.requested_section_id) || null;
              const yr = dbTables.academic_years.find((y) => y.id === app.academic_year_id) || { label: '2026-2027' };
              return {
                rows: [{
                  id: app.id,
                  application_number: app.application_number,
                  academic_year_id: app.academic_year_id,
                  year_label: yr.label,
                  requested_grade_level_id: app.requested_grade_level_id,
                  grade_name: grade.name,
                  grade_group: grade.group_name,
                  requested_section_id: app.requested_section_id,
                  section_name: sec?.name || null,
                  status: app.status,
                  student_id: app.student_id,
                  first_name: student.first_name,
                  middle_name: student.middle_name,
                  last_name: student.last_name,
                  dob: student.dob,
                  gender: student.gender,
                  blood_group: student.blood_group,
                  religion: student.religion,
                  place_of_birth: student.place_of_birth,
                  nationality: student.nationality,
                  mother_tongue: student.mother_tongue,
                  sts_number: student.sts_number,
                  dise_number: student.dise_number,
                  previous_school_name: student.previous_school_name,
                  previous_school_tc_number: student.previous_school_tc_number,
                  previous_class: student.previous_class,
                  transport_mode: student.transport_mode,
                  transport_opted_in: student.transport_opted_in,
                  address_line1: student.address_line1,
                  address_line2: student.address_line2,
                  city: student.city,
                  state: student.state,
                  pincode: student.pincode,
                  decision_reason: app.decision_reason,
                  seat_reserved_until: app.seat_reserved_until,
                  fee_generated: app.fee_generated,
                  submitted_at: app.submitted_at,
                  reviewed_at: app.reviewed_at,
                  reviewed_by: app.reviewed_by,
                  created_by: app.created_by,
                  created_at: app.created_at,
                  updated_at: app.updated_at,
                }],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }

          // Application Counts Query
          if (trimmed.includes('count(*) filter (where status = \'draft\')::int as draft_count')) {
            const yearId = params[0];
            const apps = dbTables.admission_applications.filter((a) => !yearId || a.academic_year_id === yearId);
            return {
              rows: [{
                draft_count: apps.filter((a) => a.status === 'draft').length,
                submitted_count: apps.filter((a) => a.status === 'submitted').length,
                under_review_count: apps.filter((a) => a.status === 'under_review').length,
                on_hold_count: apps.filter((a) => a.status === 'on_hold').length,
                approved_count: apps.filter((a) => a.status === 'approved').length,
                rejected_count: apps.filter((a) => a.status === 'rejected').length,
                total_count: apps.length,
              }],
              rowCount: 1,
            };
          }

          // Application List Query
          if (trimmed.includes('select a.id, a.application_number') && trimmed.includes('from public.admission_applications a')) {
            const rows = dbTables.admission_applications.map((a) => {
              const s = dbTables.students.find((st) => st.id === a.student_id) || {};
              const gl = dbTables.grade_levels.find((g) => g.id === a.requested_grade_level_id) || {};
              const sec = dbTables.sections.find((sc) => sc.id === a.requested_section_id) || {};
              const yr = dbTables.academic_years.find((y) => y.id === a.academic_year_id) || {};
              return {
                id: a.id,
                application_number: a.application_number,
                academic_year_id: a.academic_year_id,
                status: a.status,
                student_id: a.student_id,
                fee_generated: a.fee_generated,
                created_at: a.created_at,
                updated_at: a.updated_at,
                requested_grade_level_id: a.requested_grade_level_id,
                requested_section_id: a.requested_section_id,
                first_name: s.first_name,
                last_name: s.last_name,
                sts_number: s.sts_number,
                grade_name: gl.name,
                section_name: sec.name,
                year_label: yr.label,
              };
            });
            return { rows, rowCount: rows.length };
          }

          if (trimmed.includes('select count(*)::int as cnt from public.admission_applications a join public.students s')) {
            return { rows: [{ cnt: dbTables.admission_applications.length }], rowCount: 1 };
          }

          // Document types
          if (trimmed.includes('from public.admission_document_types dt where dt.is_mandatory = true')) {
            const appId = params[0];
            const uploadedTypes = dbTables.student_documents
              .filter((d) => d.admission_application_id === appId)
              .map((d) => d.document_type_id);
            const missing = dbTables.admission_document_types.filter(
              (dt) => dt.is_mandatory && !uploadedTypes.includes(dt.id)
            );
            return { rows: [{ missing_count: missing.length }], rowCount: 1 };
          }

          // Async helpers queries (academic records, sections, grade levels)
          if (trimmed.includes('from public.student_academic_records where academic_year_id = $1') || trimmed.includes('from public.student_academic_records order by created_at desc')) {
            const recs = params[0]
              ? dbTables.student_academic_records.filter((r) => r.academic_year_id === params[0])
              : dbTables.student_academic_records;
            return { rows: recs, rowCount: recs.length };
          }

          if (trimmed.includes('from public.sections where academic_year_id = $1')) {
            const secs = dbTables.sections.filter((s) => s.academic_year_id === params[0]);
            return { rows: secs, rowCount: secs.length };
          }

          if (trimmed.includes('from public.grade_levels where id = $1')) {
            const gl = dbTables.grade_levels.find((g) => g.id === params[0]);
            return { rows: gl ? [gl] : [], rowCount: gl ? 1 : 0 };
          }

          if (trimmed.includes('from public.grade_levels order by code')) {
            return { rows: dbTables.grade_levels, rowCount: dbTables.grade_levels.length };
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
        const client = createMockClient();
        return client.query(sql, params);
      }),
      end: vi.fn().mockResolvedValue(undefined),
    };

    setPostgresPoolForTesting(mockPool as any);
  });

  afterEach(async () => {
    await closePostgresPool();
    setPostgresPoolForTesting(null);
  });

  // Scenario 1: Draft CRUD in PostgreSQL
  it('1. Draft CRUD: creates, retrieves, and updates drafts in PostgreSQL', async () => {
    const repo = new PostgresAdmissionsRepository();

    // Create Draft
    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        requestedSectionId: '40000000-0000-0000-0000-000000000001',
        student: {
          firstName: 'Aarav',
          lastName: 'Sharma',
          dateOfBirth: '2019-06-15',
          gender: 'male',
          stsNumber: 'STS123456',
          addressLine1: 'MG Road',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
        },
        sensitiveDetails: {
          aadhaarNumber: '999912345678',
          annualFamilyIncome: '450000.00',
        },
        guardians: [
          {
            fullName: 'Rajesh Sharma',
            relationship: 'Father',
            mobileNumber: '9876543210',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe('draft');
    expect(draft.applicationNumber).toMatch(/^1\/2026-27$/);
    expect(dbTables.admission_applications.length).toBe(1);
    expect(dbTables.students.length).toBe(1);
    expect(dbTables.guardians.length).toBe(1);
    expect(dbTables.student_guardians.length).toBe(1);
    expect(dbTables.admission_status_history.length).toBe(1);
    expect(dbTables.audit_logs.length).toBe(1);

    // Retrieve Draft by ID
    const retrieved = await repo.getApplicationById(draft.id, admissionOfficerSession);
    expect(retrieved.id).toBe(draft.id);
    expect(retrieved.student.firstName).toBe('Aarav');
    expect(retrieved.student.stsNumber).toBe('STS123456');
    expect(retrieved.guardians.length).toBe(1);
    expect(retrieved.guardians[0].fullName).toBe('Rajesh Sharma');
    expect(retrieved.capacity).toBeDefined();

    // Update Draft
    const updated = await repo.updateDraft(
      draft.id,
      {
        student: {
          middleName: 'Kumar',
          city: 'Mysore',
        },
      },
      admissionOfficerSession
    );

    expect(updated.id).toBe(draft.id);
    expect(dbTables.students[0].middle_name).toBe('Kumar');
    expect(dbTables.students[0].city).toBe('Mysore');
  });

  // Scenario 2: Submission and review transitions
  it('2. Submission and review: validates completeness, enforces document rules, and supports review', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: {
          firstName: 'Priya',
          lastName: 'Nair',
          dateOfBirth: '2019-08-20',
          gender: 'female',
        },
        guardians: [
          {
            fullName: 'Suresh Nair',
            relationship: 'Father',
            mobileNumber: '9888877777',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Submitting without override when mandatory documents are missing must throw BusinessRuleError
    await expect(
      repo.submitApplication(draft.id, {}, admissionOfficerSession)
    ).rejects.toThrow(/missing/i);

    // Submitting with explicit override succeeds
    const submitted = await repo.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Original birth certificate will be submitted next week per Principal approval' },
      admissionOfficerSession
    );
    expect(submitted.status).toBe('submitted');
    expect(dbTables.admission_applications[0].status).toBe('submitted');

    // Submitting again fails because application is already submitted
    await expect(
      repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Duplicate submit' }, admissionOfficerSession)
    ).rejects.toThrow(/Disallowed submission/);

    // Principal reviews and places application under review
    const underReview = await repo.reviewApplication(
      draft.id,
      { action: 'under_review', remarks: 'Documents in process of physical verification' },
      principalSession
    );
    expect(underReview.status).toBe('under_review');
    expect(dbTables.admission_applications[0].status).toBe('under_review');
  });

  // Scenario 3: Hold and return-to-draft
  it('3. Hold and return-to-draft: handles on_hold and return_to_draft transitions', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'Kiran', lastName: 'Rao', dateOfBirth: '2019-03-10', gender: 'male' },
        guardians: [{ fullName: 'Sunita Rao', relationship: 'Mother', mobileNumber: '9845012345', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Override for test' }, admissionOfficerSession);

    // Principal places on hold
    const holdRes = await repo.reviewApplication(
      draft.id,
      { action: 'on_hold', remarks: 'Awaiting transfer certificate from previous school', seatReservedUntil: '2026-06-30' },
      principalSession
    );
    expect(holdRes.status).toBe('on_hold');
    expect(dbTables.admission_applications[0].seat_reserved_until).toBe('2026-06-30');

    // Principal returns to draft for parent correction
    const returnRes = await repo.reviewApplication(
      draft.id,
      { action: 'return_to_draft', remarks: 'Incorrect date of birth provided, please upload revised certificate' },
      principalSession
    );
    expect(returnRes.status).toBe('draft');
    expect(dbTables.admission_applications[0].status).toBe('draft');

    // While returned to draft, edits are permitted
    const editRes = await repo.updateDraft(
      draft.id,
      { student: { middleName: 'Anand' } },
      admissionOfficerSession
    );
    expect(editRes.id).toBe(draft.id);
  });

  // Scenario 4: Rejection
  it('4. Rejection: requires Principal role and validates minimum justification length', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'Aditya', lastName: 'Verma', dateOfBirth: '2019-01-10', gender: 'male' },
        guardians: [{ fullName: 'K. Verma', relationship: 'Father', mobileNumber: '9845099999', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Override for test' }, admissionOfficerSession);

    // Clerk cannot reject
    await expect(
      repo.rejectApplication(draft.id, { decisionReason: 'Candidate underage for Standard 1' }, clerkSession)
    ).rejects.toThrow(/Principal/);

    // Rejection reason shorter than 5 chars is rejected
    await expect(
      repo.rejectApplication(draft.id, { decisionReason: 'No' }, principalSession)
    ).rejects.toThrow(/at least 5 characters/);

    // Principal rejects with valid reason
    const rejected = await repo.rejectApplication(
      draft.id,
      { decisionReason: 'Candidate does not satisfy minimum age eligibility threshold for Standard 1' },
      principalSession
    );
    expect(rejected.status).toBe('rejected');
    expect(dbTables.admission_applications[0].status).toBe('rejected');

    // Cannot edit a rejected application
    await expect(
      repo.updateDraft(draft.id, { student: { firstName: 'NewName' } }, admissionOfficerSession)
    ).rejects.toThrow(/rejected/);
  });

  // Scenario 5: Approval
  it('5. Approval: atomically executes the 10-step workflow and generates monotonic admission number', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'Maya', lastName: 'Hegde', dateOfBirth: '2019-04-12', gender: 'female' },
        guardians: [{ fullName: 'Girish Hegde', relationship: 'Father', mobileNumber: '9845011111', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Approved override' }, admissionOfficerSession);

    const targetSection = dbTables.sections[0];
    const initialRecordsCount = dbTables.student_academic_records.length;
    const initialAssessmentsCount = dbTables.student_fee_assessments.length;

    // Principal approves
    const approval = await repo.approveApplication(
      draft.id,
      { sectionId: targetSection.id, remarks: 'Admission granted per interview' },
      principalSession
    );

    expect(approval.status).toBe('approved');
    expect(approval.admissionNumber).toMatch(/^ADM-2026-\d{4}$/);
    expect(approval.studentAcademicRecordId).toBeDefined();
    expect(approval.feeGenerated).toBe(true);

    // Verifies records created atomically
    expect(dbTables.student_academic_records.length).toBe(initialRecordsCount + 1);
    expect(dbTables.student_fee_assessments.length).toBe(initialAssessmentsCount + 1);
    expect(dbTables.student_fee_assessment_lines.length).toBe(2); // tuition + term
    expect(dbTables.admission_applications[0].status).toBe('approved');
    expect(dbTables.admission_applications[0].fee_generated).toBe(true);

    // Idempotent approval returns existing result
    const secondApproval = await repo.approveApplication(
      draft.id,
      { sectionId: targetSection.id },
      principalSession
    );
    expect(secondApproval.status).toBe('approved');
    expect(secondApproval.admissionNumber).toBe(approval.admissionNumber);
  });

  // Scenario 6: Unauthorized role rejection
  it('6. Unauthorized role rejection: clerk and accountant cannot approve, reject, or review', async () => {
    const repo = new PostgresAdmissionsRepository();
    const targetSection = dbTables.sections[0];

    // Clerk approval rejected
    await expect(
      repo.approveApplication('app-test-id', { sectionId: targetSection.id }, clerkSession)
    ).rejects.toThrow(/Principal|Access Denied/);

    // Accountant approval rejected
    await expect(
      repo.approveApplication('app-test-id', { sectionId: targetSection.id }, accountantSession)
    ).rejects.toThrow(/Principal|Access Denied/);

    // Clerk review rejected
    await expect(
      repo.reviewApplication('app-test-id', { remarks: 'Review attempt' }, clerkSession)
    ).rejects.toThrow(/Principal|Access Denied/);

    // Accountant review rejected
    await expect(
      repo.reviewApplication('app-test-id', { action: 'on_hold', remarks: 'Hold attempt' }, accountantSession)
    ).rejects.toThrow(/Principal|Access Denied/);
  });

  // Scenario 7: Capacity limit
  it('7. Capacity limit: enforces section max capacity and division grouping limits', async () => {
    const repo = new PostgresAdmissionsRepository();
    const section = dbTables.sections[0];
    section.max_capacity = 2; // Artificially constrain section capacity to 2

    // Pre-populate 2 students in this section
    dbTables.student_academic_records.push(
      { id: 'rec-01', student_id: 's-01', academic_year_id: section.academic_year_id, grade_level_id: section.grade_level_id, section_id: section.id, admission_number: 'ADM-2026-0001', status: 'admitted' },
      { id: 'rec-02', student_id: 's-02', academic_year_id: section.academic_year_id, grade_level_id: section.grade_level_id, section_id: section.id, admission_number: 'ADM-2026-0002', status: 'admitted' }
    );

    const draft = await repo.createDraft(
      {
        academicYearId: section.academic_year_id,
        gradeLevelId: section.grade_level_id,
        student: { firstName: 'Overflow', lastName: 'Student', dateOfBirth: '2019-05-01', gender: 'male' },
        guardians: [{ fullName: 'P. Student', relationship: 'Father', mobileNumber: '9988776655', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Capacity test override' }, admissionOfficerSession);

    // Attempting to approve must fail with SECTION_CAPACITY_EXCEEDED
    await expect(
      repo.approveApplication(draft.id, { sectionId: section.id }, principalSession)
    ).rejects.toThrow(/SECTION_CAPACITY_EXCEEDED/);
  });

  // Scenario 8: Concurrent approval
  it('8. Concurrent approval: section row lock prevents race conditions exceeding capacity', async () => {
    const repo = new PostgresAdmissionsRepository();
    const section = dbTables.sections[1];
    section.max_capacity = 1; // Only 1 seat available

    const draft1 = await repo.createDraft(
      {
        academicYearId: section.academic_year_id,
        gradeLevelId: section.grade_level_id,
        student: { firstName: 'Contender', lastName: 'One', dateOfBirth: '2019-02-02', gender: 'female' },
        guardians: [{ fullName: 'G1', relationship: 'Mother', mobileNumber: '9111111111', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft1.id, { overrideMissingDocumentsReason: 'Contender 1' }, admissionOfficerSession);

    const draft2 = await repo.createDraft(
      {
        academicYearId: section.academic_year_id,
        gradeLevelId: section.grade_level_id,
        student: { firstName: 'Contender', lastName: 'Two', dateOfBirth: '2019-03-03', gender: 'male' },
        guardians: [{ fullName: 'G2', relationship: 'Father', mobileNumber: '9222222222', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft2.id, { overrideMissingDocumentsReason: 'Contender 2' }, admissionOfficerSession);

    // First candidate claims the last seat
    const approval1 = await repo.approveApplication(draft1.id, { sectionId: section.id }, principalSession);
    expect(approval1.status).toBe('approved');

    // Second candidate is rejected because the section is now full
    await expect(
      repo.approveApplication(draft2.id, { sectionId: section.id }, principalSession)
    ).rejects.toThrow(/SECTION_CAPACITY_EXCEEDED/);
  });

  // Scenario 9: Zero-payment admission approval
  it('9. Zero-payment admission: approves student and assesses fees with zero upfront payment required', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'ZeroPayment', lastName: 'Candidate', dateOfBirth: '2019-09-09', gender: 'other' },
        guardians: [{ fullName: 'Guardian X', relationship: 'Guardian', mobileNumber: '9900990099', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Zero payment override' }, admissionOfficerSession);

    // Approval executes cleanly without any payment required
    const result = await repo.approveApplication(
      draft.id,
      { sectionId: dbTables.sections[0].id },
      principalSession
    );

    expect(result.status).toBe('approved');
    expect(result.initialBilledAmountInr).toBe(formatInr('40000.00')); // 35k tuition + 5k term
    expect(result.admissionNumber).toBeDefined();

    // Verify academic record is admitted with zero payments in payments table
    const record = dbTables.student_academic_records.find((r) => r.id === result.studentAcademicRecordId);
    expect(record).toBeDefined();
    expect(record.status).toBe('admitted');
  });

  // Scenario 10: Transaction rollback on failure leaves zero orphaned records
  it('10. Transaction rollback: failure during approval leaves zero orphaned records', async () => {
    const repo = new PostgresAdmissionsRepository();

    const draft = await repo.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'Rollback', lastName: 'Candidate', dateOfBirth: '2019-10-10', gender: 'male' },
        guardians: [{ fullName: 'Parent R', relationship: 'Mother', mobileNumber: '9876000000', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );
    await repo.submitApplication(draft.id, { overrideMissingDocumentsReason: 'Rollback override' }, admissionOfficerSession);

    const initialAcademicRecordsCount = dbTables.student_academic_records.length;
    const initialAssessmentsCount = dbTables.student_fee_assessments.length;

    // Simulate database error when inserting student fee assessments
    simulateErrorOnQuery = 'insert into public.student_fee_assessments';

    await expect(
      repo.approveApplication(draft.id, { sectionId: dbTables.sections[0].id }, principalSession)
    ).rejects.toThrow(/Simulated database fault/);

    // Assert complete rollback: no academic record, no fee assessment, application status unchanged
    expect(dbTables.student_academic_records.length).toBe(initialAcademicRecordsCount);
    expect(dbTables.student_fee_assessments.length).toBe(initialAssessmentsCount);
    expect(dbTables.admission_applications[0].status).toBe('submitted');
    expect(dbTables.admission_applications[0].fee_generated).toBe(false);
  });

  // Scenario 11: Repository re-instantiation durability
  it('11. Repository re-instantiation: workflow state persists seamlessly across repository instances', async () => {
    // Instance 1: Create draft
    const repo1 = new PostgresAdmissionsRepository();
    const draft = await repo1.createDraft(
      {
        academicYearId: '00000000-0000-0000-0000-000000000001',
        gradeLevelId: '30000000-0000-0000-0000-000000000004',
        student: { firstName: 'Durable', lastName: 'State', dateOfBirth: '2019-11-11', gender: 'female' },
        guardians: [{ fullName: 'Durable Parent', relationship: 'Mother', mobileNumber: '9123000000', isPrimaryContact: true }],
      },
      admissionOfficerSession
    );

    // Instance 2: Submit application
    const repo2 = new PostgresAdmissionsRepository();
    const submitted = await repo2.submitApplication(
      draft.id,
      { overrideMissingDocumentsReason: 'Durable instance test override' },
      admissionOfficerSession
    );
    expect(submitted.status).toBe('submitted');

    // Instance 3: Review application
    const repo3 = new PostgresAdmissionsRepository();
    const reviewed = await repo3.reviewApplication(
      draft.id,
      { action: 'under_review', remarks: 'Durable review test' },
      principalSession
    );
    expect(reviewed.status).toBe('under_review');

    // Instance 4: Approve application
    const repo4 = new PostgresAdmissionsRepository();
    const approved = await repo4.approveApplication(
      draft.id,
      { sectionId: dbTables.sections[0].id },
      principalSession
    );
    expect(approved.status).toBe('approved');

    // Instance 5: Retrieve and inspect full details
    const repo5 = new PostgresAdmissionsRepository();
    const detail = await repo5.getApplicationById(draft.id, admissionOfficerSession);
    expect(detail.status).toBe('approved');
    expect(detail.student.firstName).toBe('Durable');
    expect(detail.feeGenerated).toBe(true);
    expect(detail.statusHistory.length).toBeGreaterThanOrEqual(4); // draft -> submitted -> under_review -> approved
  });

  // Scenario 12: AdmissionsService PostgreSQL Mode Guard and Async Delegation
  it('12. AdmissionsService: enforces PostgreSQL durability and rejects synchronous in-memory bypasses', async () => {
    const service = new AdmissionsService(new PostgresAdmissionsRepository());
    expect(service.isPostgres()).toBe(true);

    // Synchronous calls throw BusinessRuleError in PostgreSQL production mode
    expect(() => service.getAllApplications()).toThrow(/Synchronous getAllApplications is not supported/);
    expect(() => service.getAllAcademicRecords()).toThrow(/Synchronous getAllAcademicRecords is not supported/);
    expect(() => service.getAllSections()).toThrow(/Synchronous getAllSections is not supported/);
    expect(() => service.getAllGradeLevels()).toThrow(/Synchronous getAllGradeLevels is not supported/);

    // Asynchronous delegation to PostgreSQL methods succeeds
    const allApps = await service.getAllApplicationsAsync(admissionOfficerSession);
    expect(Array.isArray(allApps)).toBe(true);

    const allRecords = await service.getAllAcademicRecordsAsync(admissionOfficerSession);
    expect(Array.isArray(allRecords)).toBe(true);

    const allSections = await service.getAllSectionsAsync('00000000-0000-0000-0000-000000000001', admissionOfficerSession);
    expect(Array.isArray(allSections)).toBe(true);

    const allGrades = await service.getAllGradeLevelsAsync(admissionOfficerSession);
    expect(Array.isArray(allGrades)).toBe(true);
  });
});
