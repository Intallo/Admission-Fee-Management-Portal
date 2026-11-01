import { IStudentRecordsRepository } from '../interfaces';
import { withTransaction } from '../../db/postgres-pool';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  StudentProfileDTO,
  StudentSearchFilterDTO,
  StudentSearchItemDTO,
  StudentStatusHistoryItemDTO,
} from '../../../modules/student-records/types';
import { AuthorizationError, NotFoundError } from '../../../lib/errors';
import { decryptSensitiveField, isAuthorizedForSensitivePii, maskAadhaar } from '../../../lib/crypto/pii';
import { randomUUID } from 'crypto';

export class PostgresStudentRecordsRepository implements IStudentRecordsRepository {
  async searchStudents(
    filter: StudentSearchFilterDTO,
    session: AuthenticatedUserSession
  ): Promise<{ data: StudentSearchItemDTO[]; total: number }> {
    return withTransaction(session, async (client) => {
      let querySql = `
        select r.id as record_id, r.admission_number, r.status, r.admission_date,
               r.academic_year_id, y.label as academic_year_label,
               g.id as grade_level_id, g.name as grade_level_name,
               sec.id as section_id, sec.name as section_name,
               s.id as student_id, s.first_name, s.last_name, s.gender, s.dob,
               s.sts_number, s.dise_number, s.caste, s.transport_opted_in,
               g_prim.full_name as guardian_name, g_prim.phone as guardian_phone
        from public.student_academic_records r
        join public.students s on s.id = r.student_id
        join public.academic_years y on y.id = r.academic_year_id
        join public.grade_levels g on g.id = r.grade_level_id
        left join public.sections sec on sec.id = r.section_id
        left join lateral (
          select gd.full_name, gd.phone
          from public.student_guardians sg
          join public.guardians gd on gd.id = sg.guardian_id
          where sg.student_id = s.id
          order by sg.is_primary_contact desc
          limit 1
        ) g_prim on true
        where 1=1
      `;
      const params: any[] = [];
      let idx = 1;

      if (filter.academicYearId && filter.academicYearId !== 'all') {
        querySql += ` and r.academic_year_id = $${idx++}`;
        params.push(filter.academicYearId);
      }
      if (filter.gradeLevelId) {
        querySql += ` and r.grade_level_id = $${idx++}`;
        params.push(filter.gradeLevelId);
      }
      if (filter.sectionId) {
        querySql += ` and r.section_id = $${idx++}`;
        params.push(filter.sectionId);
      }
      if (filter.status && filter.status !== 'all') {
        querySql += ` and r.status = $${idx++}`;
        params.push(filter.status);
      }
      if (filter.search) {
        const q = `%${filter.search.trim().toLowerCase()}%`;
        querySql += ` and (
          lower(s.first_name || ' ' || s.last_name) like $${idx} or
          lower(r.admission_number) like $${idx} or
          lower(coalesce(s.sts_number, '')) like $${idx} or
          lower(coalesce(s.dise_number, '')) like $${idx}
        )`;
        params.push(q);
        idx++;
      }

      querySql += ` order by s.first_name asc, s.last_name asc`;

      const res = await client.query(querySql, params);

      const items: StudentSearchItemDTO[] = res.rows.map((row: any) => ({
        id: row.student_id,
        studentAcademicRecordId: row.record_id,
        academicYearId: row.academic_year_id,
        academicYearLabel: row.academic_year_label,
        admissionNumber: row.admission_number,
        stsNumber: row.sts_number || null,
        diseNumber: row.dise_number || null,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        gender: row.gender || 'not_specified',
        dateOfBirth: row.dob || '',
        gradeLevelId: row.grade_level_id,
        gradeLevelName: row.grade_level_name,
        sectionId: row.section_id || null,
        sectionName: row.section_name || 'A',
        status: row.status,
        primaryGuardianName: row.guardian_name || 'N/A',
        primaryGuardianMobile: row.guardian_phone || '',
        transportOptedIn: row.transport_opted_in ?? false,
      }));

      const limit = filter.limit || 20;
      const offset = filter.offset || 0;
      const paginated = items.slice(offset, offset + limit);

      return {
        data: paginated,
        total: items.length,
      };
    });
  }

  async getStudentProfile(recordId: string, session: AuthenticatedUserSession): Promise<StudentProfileDTO> {
    return withTransaction(session, async (client) => {
      const recRes = await client.query(
        `select r.id as record_id, r.admission_number, r.status, r.admission_date,
                r.academic_year_id, y.label as academic_year_label,
                g.id as grade_level_id, g.name as grade_level_name,
                sec.id as section_id, sec.name as section_name,
                s.id as student_id, s.first_name, s.middle_name, s.last_name, s.dob, s.gender,
                s.nationality, s.mother_tongue, s.blood_group, s.religion, s.caste, s.subcaste,
                s.category, s.sts_number, s.dise_number, s.transport_opted_in,
                s.address_line1, s.address_line2, s.city, s.state, s.pincode
         from public.student_academic_records r
         join public.students s on s.id = r.student_id
         join public.academic_years y on y.id = r.academic_year_id
         join public.grade_levels g on g.id = r.grade_level_id
         left join public.sections sec on sec.id = r.section_id
         where r.id = $1`,
        [recordId]
      );

      if (recRes.rowCount === 0) {
        throw new NotFoundError(`Student academic record with ID "${recordId}" not found.`);
      }

      const row = recRes.rows[0];

      // Sensitive PII handling per DPDP Act
      let sensitiveDetails = undefined;
      const canAccessPii = isAuthorizedForSensitivePii(session.role);

      if (canAccessPii) {
        const piiRes = await client.query(
          `select aadhaar_number_encrypted, aadhaar_last_four, bank_account_number_encrypted,
                  bank_name, bank_ifsc, is_bpl_card_holder, bpl_card_number,
                  caste_certificate_number, income_certificate_number
           from public.student_sensitive_details
           where student_id = $1`,
          [row.student_id]
        );

        if ((piiRes.rowCount ?? 0) > 0) {
          const p = piiRes.rows[0];
          let unmaskedAadhaar: string | undefined;
          try {
            if (p.aadhaar_number_encrypted) {
              unmaskedAadhaar = decryptSensitiveField(p.aadhaar_number_encrypted);
            }
          } catch {
            // keep undefined
          }

          const lastFour = p.aadhaar_last_four || (unmaskedAadhaar ? unmaskedAadhaar.slice(-4) : '0000');
          sensitiveDetails = {
            studentId: row.student_id,
            aadhaarNumberMasked: maskAadhaar(lastFour),
            aadhaarNumberUnmasked: unmaskedAadhaar,
            householdIncomeInr: null,
            casteCategory: row.category || null,
            subCaste: row.subcaste || null,
            religion: row.religion || null,
            motherTongue: row.mother_tongue || null,
          };
        }
      }

      // Fetch guardians
      const guardRes = await client.query(
        `select gd.id, gd.relationship, gd.full_name, gd.phone, gd.email, gd.occupation, gd.annual_income,
                sg.is_primary_contact
         from public.student_guardians sg
         join public.guardians gd on gd.id = sg.guardian_id
         where sg.student_id = $1
         order by sg.is_primary_contact desc`,
        [row.student_id]
      );

      const guardians = guardRes.rows.map((g: any) => ({
        id: g.id,
        relationship: g.relationship,
        fullName: g.full_name,
        mobileNumber: g.phone || '',
        phone: g.phone,
        email: g.email || undefined,
        occupation: g.occupation || undefined,
        annualIncome: g.annual_income || undefined,
        isPrimaryContact: g.is_primary_contact,
      }));

      return {
        studentId: row.student_id,
        demographics: {
          firstName: row.first_name,
          middleName: row.middle_name || undefined,
          lastName: row.last_name,
          dateOfBirth: row.dob,
          gender: row.gender,
          nationality: row.nationality || 'Indian',
          motherTongue: row.mother_tongue || 'Kannada',
          bloodGroup: row.blood_group || undefined,
          religion: row.religion || undefined,
          caste: row.caste || undefined,
          subCaste: row.subcaste || undefined,
          category: row.category || undefined,
          stsNumber: row.sts_number || undefined,
          diseNumber: row.dise_number || undefined,
          transportOptedIn: row.transport_opted_in ?? false,
          addressLine1: row.address_line1 || '',
          addressLine2: row.address_line2 || undefined,
          city: row.city || 'Bangalore',
          state: row.state || 'Karnataka',
          pincode: row.pincode || '560001',
        },
        guardians,
        currentAcademicRecord: {
          academicRecordId: row.record_id,
          academicYearId: row.academic_year_id,
          academicYearLabel: row.academic_year_label,
          gradeLevelName: row.grade_level_name,
          sectionName: row.section_name || 'A',
          admissionNumber: row.admission_number,
          admissionDate: row.admission_date,
          status: row.status,
          rollNumber: null,
          transportOptedIn: row.transport_opted_in ?? false,
          notes: null,
        },
        academicHistory: [],
        statusHistory: [],
        sensitiveDetails: sensitiveDetails || null,
        documents: [],
        feeSummary: null,
        receipts: null,
        certificates: [],
      };
    });
  }

  async updateStudentStatus(
    recordId: string,
    status: any,
    reason: string,
    session: AuthenticatedUserSession
  ): Promise<any> {
    return withTransaction(session, async (client) => {
      const nowIso = new Date().toISOString();
      const res = await client.query(
        `update public.student_academic_records
         set status = $1, updated_at = $2
         where id = $3
         returning id, student_id, admission_number, status`,
        [status, nowIso, recordId]
      );

      if (res.rowCount === 0) {
        throw new NotFoundError(`Student academic record "${recordId}" not found.`);
      }

      // Record in audit logs
      await client.query(
        `insert into public.audit_logs (action, actor_staff_id, entity_type, entity_id, outcome, reason)
         values ('STUDENT_STATUS_CHANGED', $1, 'student_academic_records', $2, 'SUCCESS', $3)`,
        [session.staffId, recordId, reason]
      );

      return res.rows[0];
    });
  }

  async getStatusHistory(recordId: string, session?: AuthenticatedUserSession): Promise<any[]> {
    if (!session) return [];
    return withTransaction(session, async (client) => {
      const res = await client.query(
        `select action, actor_staff_id, outcome, reason, created_at
         from public.audit_logs
         where entity_id = $1 and action = 'STUDENT_STATUS_CHANGED'
         order by created_at desc`,
        [recordId]
      );
      return res.rows;
    });
  }
}
