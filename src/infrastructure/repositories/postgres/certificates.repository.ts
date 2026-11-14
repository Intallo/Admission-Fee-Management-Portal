import { ICertificatesRepository } from '../interfaces';
import { withTransaction } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  CertificateKind,
  CertificateReviewStatus,
  CertificateState,
  StudentCertificateDTO,
} from '../../../modules/certificates-lctc/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../../lib/errors';
import { randomUUID } from 'crypto';
import { logger } from '../../../lib/logger';
import { CertificateNumber, toDecimalInrString } from '../../../modules/shared/types';
import { formatInr } from '../../../lib/money/inr';

export class PostgresCertificatesRepository implements ICertificatesRepository {
  async getNextCertificateNumber(
    prefix?: string,
    academicYearIdOrSession?: string | AuthenticatedUserSession,
    sessionOrClient?: AuthenticatedUserSession | PoolClient,
    existingClient?: PoolClient
  ): Promise<string> {
    let academicYearId: string | undefined;
    let session: AuthenticatedUserSession | undefined;
    let clientToUse: PoolClient | undefined;

    if (typeof academicYearIdOrSession === 'string') {
      academicYearId = academicYearIdOrSession;
      session = sessionOrClient as AuthenticatedUserSession | undefined;
      clientToUse = existingClient;
    } else {
      session = academicYearIdOrSession as AuthenticatedUserSession | undefined;
      clientToUse = sessionOrClient as PoolClient | undefined;
    }

    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for certificate operations.');
    }
    const runInTx = async (client: any) => {
      const numRes = await client.query(
        `select private.next_certificate_number($1, $2) as num`,
        [prefix || 'TC', academicYearId || null]
      );
      return numRes.rows[0].num;
    };

    if (clientToUse) {
      return runInTx(clientToUse);
    }
    return withTransaction(session, runInTx);
  }

  async prepopulateCertificate(
    studentAcademicRecordId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for certificate operations.');
    }
    const runInTx = async (client: any) => {
      // 1. Check existing certificate
      const existRes = await client.query(
        `select * from public.student_year_certificates where student_academic_record_id = $1`,
        [studentAcademicRecordId]
      );

      if ((existRes.rowCount ?? 0) > 0) {
        return this.mapCertificateRow(existRes.rows[0], client);
      }

      // 2. Fetch student academic record details
      const recRes = await client.query(
        `select r.id, r.student_id, r.academic_year_id, r.admission_number, r.admission_date,
                r.grade_level_id, r.section_id,
                s.first_name, s.last_name, s.dob, s.gender, s.nationality, s.mother_tongue,
                s.sts_number, s.dise_number, s.caste, s.subcaste, s.transport_opted_in,
                g.name as grade_name, sec.name as section_name, y.start_date, y.end_date, y.label as year_label
         from public.student_academic_records r
         join public.students s on s.id = r.student_id
         join public.grade_levels g on g.id = r.grade_level_id
         join public.academic_years y on y.id = r.academic_year_id
         left join public.sections sec on sec.id = r.section_id
         where r.id = $1`,
        [studentAcademicRecordId]
      );

      if (recRes.rowCount === 0) {
        throw new NotFoundError(`Student academic record "${studentAcademicRecordId}" not found.`);
      }

      const rec = recRes.rows[0];

      // 3. Check dues status
      const duesRes = await client.query(
        `select coalesce(sum(l.assessed_amount), 0) as total_assessed,
                coalesce((select sum(pa.amount)
                          from public.payment_allocations pa
                          join public.student_fee_assessment_lines sl on sl.id = pa.student_fee_assessment_line_id
                          where sl.student_fee_assessment_id = a.id), 0) as total_paid
         from public.student_fee_assessments a
         join public.student_fee_assessment_lines l on l.student_fee_assessment_id = a.id
         where a.student_academic_record_id = $1
         group by a.id`,
        [studentAcademicRecordId]
      );

      let duesPending = false;
      if ((duesRes.rowCount ?? 0) > 0) {
        const row = duesRes.rows[0];
        const assessed = formatInr(row.total_assessed);
        const paid = formatInr(row.total_paid);
        if (Number(assessed) > Number(paid)) {
          duesPending = true;
        }
      }

      const certId = randomUUID();
      const nowIso = new Date().toISOString();

      await client.query(
        `insert into public.student_year_certificates (
           id, student_academic_record_id, certificate_kind, review_status, status,
           reprint_count, conduct, progress, created_at, updated_at
         ) values ($1, $2, 'transfer_certificate', 'pending', 'draft', 0, 'Good', 'Satisfactory', $3, $4)`,
        [certId, studentAcademicRecordId, nowIso, nowIso]
      );

      const created = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certId]
      );

      return this.mapCertificateRow(created.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getCertificateById(
    certificateId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO | undefined> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for certificate operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certificateId]
      );
      if (res.rowCount === 0) return undefined;
      return this.mapCertificateRow(res.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getCertificateByStudentRecordId(
    studentRecordId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO | undefined> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for certificate operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(
        `select * from public.student_year_certificates where student_academic_record_id = $1`,
        [studentRecordId]
      );
      if (res.rowCount === 0) return undefined;
      return this.mapCertificateRow(res.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async reviewCertificate(
    certificateId: string,
    payload: {
      action: 'forward_for_approval' | 'save_draft' | 'reject';
      verificationChecklist?: {
        duesCleared?: boolean;
        libraryCleared?: boolean;
        sportsCleared?: boolean;
      };
      duesOverrideReason?: string;
      reasonForLeaving?: string;
      conduct?: string;
      progress?: string;
      remarks?: string;
    },
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO> {
    const runInTx = async (client: PoolClient) => {
      if (!['clerk', 'admission_officer', 'principal'].includes(session.role)) {
        throw new AuthorizationError('Access Denied: Only Clerks or Admission Officers can review certificates.');
      }

      const certRes = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certificateId]
      );

      if (certRes.rowCount === 0) {
        throw new NotFoundError(`Certificate with ID "${certificateId}" not found.`);
      }

      const cert = certRes.rows[0];
      if (cert.status === 'issued') {
        throw new ConflictError('Cannot review a certificate that has already been issued.');
      }

      const nowIso = new Date().toISOString();
      const reviewStatus = payload.action === 'forward_for_approval'
        ? 'reviewed'
        : payload.action === 'reject'
        ? 'returned'
        : 'pending';

      await client.query(
        `update public.student_year_certificates
         set review_status = $1, reviewed_by = $2, reviewed_at = $3,
             conduct = coalesce($4, conduct),
             progress = coalesce($5, progress),
             reason_for_leaving = coalesce($6, reason_for_leaving),
             dues_override_reason = coalesce($7, dues_override_reason),
             updated_at = $8
         where id = $9`,
        [
          reviewStatus,
          session.staffId,
          nowIso,
          payload.conduct || null,
          payload.progress || null,
          payload.reasonForLeaving || null,
          payload.duesOverrideReason || null,
          nowIso,
          certificateId,
        ]
      );

      const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
      return this.mapCertificateRow(updated.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async issueCertificate(
    certificateId: string,
    payload: {
      action: 'approve_and_issue' | 'reject';
      decisionReason?: string;
      duesOverrideReason?: string;
    },
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO> {
    const runInTx = async (client: PoolClient) => {
      if (session.role !== 'principal') {
        throw new AuthorizationError('Access Denied: Only the Principal holds authority to approve and issue certificates.');
      }

      const certRes = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certificateId]
      );

      if (certRes.rowCount === 0) {
        throw new NotFoundError(`Certificate with ID "${certificateId}" not found.`);
      }

      const cert = certRes.rows[0];
      if (cert.status === 'issued') {
        throw new ConflictError('Certificate has already been formally issued and cannot be re-issued.');
      }

      const nowIso = new Date().toISOString();

      if (payload.action === 'reject') {
        await client.query(
          `update public.student_year_certificates
           set status = 'cancelled', updated_at = $1
           where id = $2`,
          [nowIso, certificateId]
        );
        const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
        return this.mapCertificateRow(updated.rows[0], client);
      }

      // 1. Fetch full student record to build snapshot and extract academic_year_id
      const recRes = await client.query(
        `select r.id, r.admission_number, r.admission_date, r.academic_year_id,
                s.first_name, s.last_name, s.dob, s.gender, s.nationality, s.mother_tongue,
                s.caste, s.sts_number, s.dise_number,
                g.name as grade_name, sec.name as section_name, y.label as year_label
         from public.student_academic_records r
         join public.students s on s.id = r.student_id
         join public.grade_levels g on g.id = r.grade_level_id
         join public.academic_years y on y.id = r.academic_year_id
         left join public.sections sec on sec.id = r.section_id
         where r.id = $1`,
        [cert.student_academic_record_id]
      );
      const rec = recRes.rows[0];

      // 2. Allocate Monotonic TC Number: TC-YYYY-NNNN (4 digits) scoped to academic year
      const numRes = await client.query(
        `select private.next_certificate_number('TC', $1) as num`,
        [rec.academic_year_id]
      );
      const tcNumber = numRes.rows[0].num as CertificateNumber;

      const snapshot = {
        certificateNumber: tcNumber,
        studentName: `${rec.first_name} ${rec.last_name}`,
        admissionNumber: rec.admission_number,
        dob: rec.dob,
        grade: rec.grade_name,
        section: rec.section_name || 'A',
        academicYear: rec.year_label,
        conduct: cert.conduct || 'Good',
        progress: cert.progress || 'Satisfactory',
        reasonForLeaving: cert.reason_for_leaving || 'Completed Grade',
        issuedAt: nowIso,
        approvedBy: session.staffId,
      };

      // 3. Update certificate state
      await client.query(
        `update public.student_year_certificates
         set certificate_number = $1, status = 'issued', approved_by = $2, issued_at = $3, updated_at = $4
         where id = $5`,
        [tcNumber, session.staffId, nowIso, nowIso, certificateId]
      );

      // 4. Save immutable version snapshot into public.certificate_versions
      const versionId = randomUUID();
      await client.query(
        `insert into public.certificate_versions (
           id, student_year_certificate_id, version_number, snapshot_data, issued_at, issued_by, created_at
         ) values ($1, $2, 1, $3, $4, $5, $6)`,
        [versionId, certificateId, JSON.stringify(snapshot), nowIso, session.staffId, nowIso]
      );

      // 5. Append audit event to public.audit_logs
      await client.query(
        `insert into public.audit_logs (
           actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at
         ) values ($1, 'CERTIFICATE_ISSUED', 'student_year_certificates', $2, 'SUCCESS', $3, $4)`,
        [session.staffId, certificateId, `Issued TC ${tcNumber}`, nowIso]
      );

      const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
      return this.mapCertificateRow(updated.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async reprintCertificate(
    certificateId: string,
    reason: string,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO> {
    const runInTx = async (client: PoolClient) => {
      if (!['clerk', 'principal', 'admission_officer'].includes(session.role)) {
        throw new AuthorizationError('Access Denied: Unauthorized role for certificate reprint.');
      }

      const certRes = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certificateId]
      );

      if (certRes.rowCount === 0) {
        throw new NotFoundError(`Certificate with ID "${certificateId}" not found.`);
      }

      const cert = certRes.rows[0];
      const newCount = (cert.reprint_count || 0) + 1;
      const nowIso = new Date().toISOString();

      await client.query(
        `update public.student_year_certificates
         set reprint_count = $1, last_reprinted_at = $2, updated_at = $2
         where id = $3`,
        [newCount, nowIso, certificateId]
      );

      // Append audit event
      await client.query(
        `insert into public.audit_logs (actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at)
         values ($1, 'CERTIFICATE_REPRINTED', 'student_year_certificates', $2, 'SUCCESS', $3, $4)`,
        [session.staffId, certificateId, `Reprint #${newCount} reason: ${reason}`, nowIso]
      );

      const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
      return this.mapCertificateRow(updated.rows[0], client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async listCertificates(
    filter?: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<StudentCertificateDTO[]> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for certificate operations.');
    }
    const runInTx = async (client: any) => {
      let sql = `select * from public.student_year_certificates order by created_at desc`;
      const res = await client.query(sql);
      const list: StudentCertificateDTO[] = [];
      for (const row of res.rows) {
        list.push(await this.mapCertificateRow(row, client));
      }
      return list;
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  private async mapCertificateRow(row: any, client: any): Promise<StudentCertificateDTO> {
    const recRes = await client.query(
      `select r.id, r.student_id, r.academic_year_id, r.admission_number, r.admission_date,
              r.grade_level_id, r.section_id,
              s.first_name, s.last_name, s.dob, s.gender, s.nationality, s.mother_tongue,
              s.caste, s.sts_number, s.dise_number,
              g.name as grade_name, sec.name as section_name, y.label as year_label
       from public.student_academic_records r
       join public.students s on s.id = r.student_id
       join public.grade_levels g on g.id = r.grade_level_id
       join public.academic_years y on y.id = r.academic_year_id
       left join public.sections sec on sec.id = r.section_id
       where r.id = $1`,
      [row.student_academic_record_id]
    );

    const rec = recRes.rows[0];

    return {
      id: row.id,
      studentAcademicRecordId: row.student_academic_record_id,
      studentId: rec.student_id,
      studentName: `${rec.first_name} ${rec.last_name}`,
      admissionNumber: rec.admission_number,
      gradeLevelId: rec.grade_level_id || '00000000-0000-0000-0000-000000000001',
      gradeLevelName: rec.grade_name || 'Standard 1',
      sectionId: rec.section_id || '00000000-0000-0000-0000-000000000001',
      sectionName: rec.section_name || 'A',
      academicYearId: rec.academic_year_id,
      academicYearLabel: rec.year_label,
      certificateType: (row.certificate_kind as any) || 'TC',
      certificateNumber: row.certificate_number || null,
      status: row.status as CertificateState,
      reviewStatus: (row.review_status || 'pending') as CertificateReviewStatus,
      reviewedBy: row.reviewed_by || null,
      reviewedByName: null,
      reviewedAt: row.reviewed_at || null,
      reviewRemarks: null,
      conduct: row.conduct || 'Good',
      progress: row.progress || 'Satisfactory',
      reasonForLeaving: row.reason_for_leaving || 'Completed Grade',
      dateOfLeaving: row.date_of_leaving || (row.created_at || '').slice(0, 10),
      intendedSchool: null,
      unpaidBalanceInr: toDecimalInrString('0.00'),
      duesOverrideReason: row.dues_override_reason || null,
      generatedBy: row.generated_by || null,
      approvedBy: row.approved_by || null,
      approvedByName: null,
      issuedAt: row.issued_at || null,
      versions: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
