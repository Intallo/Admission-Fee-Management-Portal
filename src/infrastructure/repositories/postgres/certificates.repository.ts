import { ICertificatesRepository } from '../interfaces';
import { withTransaction, query } from '../../db/postgres-pool';
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

export class PostgresCertificatesRepository implements ICertificatesRepository {
  async prepopulateCertificate(
    studentAcademicRecordId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    return withTransaction(session, async (client) => {
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
                coalesce(sum(pa.amount), 0) as total_paid
         from public.student_fee_assessments a
         join public.student_fee_assessment_lines l on l.student_fee_assessment_id = a.id
         left join public.payment_allocations pa on pa.student_fee_assessment_line_id = l.id
         where a.student_academic_record_id = $1`,
        [studentAcademicRecordId]
      );

      const totalAssessed = Number(duesRes.rows[0]?.total_assessed || 0);
      const totalPaid = Number(duesRes.rows[0]?.total_paid || 0);
      const duesCleared = totalPaid >= totalAssessed;
      const duesRemaining = Math.max(0, totalAssessed - totalPaid).toFixed(2);

      const certId = randomUUID();
      const nowIso = new Date().toISOString();

      await client.query(
        `insert into public.student_year_certificates (
           id, student_academic_record_id, certificate_type, status,
           review_status, conduct, progress, reason_for_leaving, date_of_leaving,
           dues_cleared, created_at, updated_at
         ) values ($1, $2, 'TC', 'draft', 'pending', 'Good', 'Satisfactory', 'Course Completed', $3, $4, $5, $6)`,
        [certId, studentAcademicRecordId, nowIso.slice(0, 10), duesCleared, nowIso, nowIso]
      );

      const newCert = await client.query(
        `select * from public.student_year_certificates where id = $1`,
        [certId]
      );

      return this.mapCertificateRow(newCert.rows[0], client);
    });
  }

  async getCertificateById(
    certificateId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO | undefined> {
    const res = await query(
      `select * from public.student_year_certificates where id = $1`,
      [certificateId],
      session
    );
    if (res.rowCount === 0) return undefined;
    return this.mapCertificateRow(res.rows[0]);
  }

  async getCertificateByStudentRecordId(
    studentRecordId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO | undefined> {
    const res = await query(
      `select * from public.student_year_certificates where student_academic_record_id = $1`,
      [studentRecordId],
      session
    );
    if (res.rowCount === 0) return undefined;
    return this.mapCertificateRow(res.rows[0]);
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
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    return withTransaction(session, async (client) => {
      if (!['clerk', 'admission_officer'].includes(session.role)) {
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
    });
  }

  async issueCertificate(
    certificateId: string,
    payload: {
      action: 'approve_and_issue' | 'reject';
      decisionReason?: string;
      duesOverrideReason?: string;
    },
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    return withTransaction(session, async (client) => {
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

      // Allocate Monotonic TC Number: TC-YYYY-NNNN
      const numRes = await client.query(`select private.next_receipt_number('TC') as num`);
      const tcNumber = numRes.rows[0].num as CertificateNumber;

      await client.query(
        `update public.student_year_certificates
         set certificate_number = $1, status = 'issued', approved_by = $2, issued_at = $3, updated_at = $4
         where id = $5`,
        [tcNumber, session.staffId, nowIso, nowIso, certificateId]
      );

      const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
      return this.mapCertificateRow(updated.rows[0], client);
    });
  }

  async reprintCertificate(
    certificateId: string,
    reason: string,
    session: AuthenticatedUserSession
  ): Promise<StudentCertificateDTO> {
    return withTransaction(session, async (client) => {
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
         set reprint_count = $1, last_reprinted_at = $2, updated_at = $3
         where id = $4`,
        [newCount, nowIso, nowIso, certificateId]
      );

      const updated = await client.query(`select * from public.student_year_certificates where id = $1`, [certificateId]);
      return this.mapCertificateRow(updated.rows[0], client);
    });
  }

  private async mapCertificateRow(row: any, client?: any): Promise<StudentCertificateDTO> {
    const q = client ? client.query.bind(client) : query;
    const recRes = await q(
      `select r.student_id, r.academic_year_id, r.admission_number, r.admission_date,
              r.grade_level_id, r.section_id,
              s.first_name, s.last_name, s.dob, s.nationality, s.caste, s.subcaste,
              g.name as grade_name, sec.name as section_name, y.label as year_label
       from public.student_academic_records r
       join public.students s on s.id = r.student_id
       join public.grade_levels g on g.id = r.grade_level_id
       join public.academic_years y on y.id = r.academic_year_id
       left join public.sections sec on sec.id = r.section_id
       where r.id = $1`,
      [row.student_academic_record_id]
    );

    const rec = recRes.rows[0] || {};

    return {
      id: row.id,
      studentAcademicRecordId: row.student_academic_record_id,
      studentId: rec.student_id,
      studentName: `${rec.first_name || ''} ${rec.last_name || ''}`.trim(),
      admissionNumber: rec.admission_number,
      gradeLevelId: rec.grade_level_id,
      gradeLevelName: rec.grade_name || 'N/A',
      sectionId: rec.section_id,
      sectionName: rec.section_name || 'Unassigned',
      academicYearId: row.academic_year_id || rec.academic_year_id,
      academicYearLabel: rec.year_label || '2026-2027',
      certificateType: (row.certificate_type || 'TC') as CertificateKind,
      certificateNumber: row.certificate_number as CertificateNumber | null,
      status: (row.status || 'draft') as CertificateState,
      reviewStatus: (row.review_status || 'pending') as CertificateReviewStatus,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      conduct: row.conduct || 'Good',
      progress: row.progress || 'Satisfactory',
      reasonForLeaving: row.reason_for_leaving || 'Course Completed',
      dateOfLeaving: row.date_of_leaving || new Date().toISOString().slice(0, 10),
      unpaidBalanceInr: toDecimalInrString('0.00'),
      duesOverrideReason: row.dues_override_reason,
      generatedBy: row.generated_by,
      approvedBy: row.approved_by,
      issuedAt: row.issued_at,
      versions: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
