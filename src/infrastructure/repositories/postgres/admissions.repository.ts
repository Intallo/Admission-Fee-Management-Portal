import { IAdmissionsRepository } from '../interfaces';
import { withTransaction, query } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  AdmissionApplicationDetailDTO,
  AdmissionApplicationStatus,
  AdmissionApplicationSummaryDTO,
  ApplicationListFilterDTO,
  ApplicationListResponseDTO,
  ApproveAdmissionResultDTO,
  CreateAdmissionDraftDTO,
  SectionCapacityDTO,
  UpdateAdmissionDraftDTO,
} from '../../../modules/admissions/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../lib/errors';
import { randomUUID } from 'crypto';
import { computeAadhaarHash, maskAadhaar, maskBankAccount } from '../../../lib/crypto/pii';
import { addInr, formatInr } from '../../../lib/money/inr';
import { logger } from '../../../lib/logger';

export class PostgresAdmissionsRepository implements IAdmissionsRepository {
  private formatAcademicYearShort(label: string): string {
    const match = label.match(/^(\d{4})-(\d{4})$/);
    if (match) {
      return `${match[1]}-${match[2].slice(2)}`;
    }
    return label;
  }

  async getNextApplicationNumber(
    academicYearId: string,
    yearLabel: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<string> {
    const sql = `select private.next_application_number($1) as val`;
    const res = existingClient
      ? await existingClient.query(sql, [academicYearId])
      : await query(sql, [academicYearId], session);

    return res.rows[0].val;
  }

  async getNextAdmissionNumber(
    academicYearId: string,
    yearLabel: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<string> {
    const sql = `select private.next_admission_number('ADM', $1) as val`;
    const res = existingClient
      ? await existingClient.query(sql, [academicYearId])
      : await query(sql, [academicYearId], session);
    return res.rows[0].val;
  }

  async createDraft(
    payload: any,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      // Fetch academic year
      const yearRes = await client.query(
        `select id, label from public.academic_years where id = $1`,
        [payload.academicYearId]
      );
      if (yearRes.rowCount === 0) {
        throw new NotFoundError(`Academic year with ID "${payload.academicYearId}" not found.`);
      }
      const yearLabel = yearRes.rows[0].label;

      const applicationNumber = await this.getNextApplicationNumber(
        payload.academicYearId,
        yearLabel,
        session,
        client
      );

      // Create student record
      const studentId = randomUUID();
      const nowIso = new Date().toISOString();

      await client.query(
        `insert into public.students (
           id, first_name, middle_name, last_name, dob, gender, nationality,
           mother_tongue, blood_group, religion, caste, subcaste, category,
           sts_number, dise_number, transport_opted_in, address_line1,
           address_line2, city, state, pincode, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)`,
        [
          studentId,
          payload.student.firstName,
          payload.student.middleName || null,
          payload.student.lastName,
          payload.student.dob,
          payload.student.gender,
          payload.student.nationality || 'Indian',
          payload.student.motherTongue || 'Kannada',
          payload.student.bloodGroup || null,
          payload.student.religion || null,
          payload.student.caste || null,
          payload.student.subcaste || null,
          payload.student.category || null,
          payload.student.stsNumber || null,
          payload.student.diseNumber || null,
          payload.student.transportOptedIn ?? false,
          payload.student.addressLine1 || '',
          payload.student.addressLine2 || null,
          payload.student.city || 'Bangalore',
          payload.student.state || 'Karnataka',
          payload.student.pincode || '560001',
          nowIso,
        ]
      );

      // Create application record
      const applicationId = randomUUID();
      await client.query(
        `insert into public.admission_applications (
           id, application_number, academic_year_id, requested_grade_level_id,
           requested_section_id, status, student_id, fee_generated, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, 'draft', $6, false, $7, $7)`,
        [
          applicationId,
          applicationNumber,
          payload.academicYearId,
          payload.gradeLevelId,
          payload.sectionId || null,
          studentId,
          nowIso,
        ]
      );

      // Create guardians if provided
      if (payload.guardians && Array.isArray(payload.guardians)) {
        for (const g of payload.guardians) {
          const guardianId = randomUUID();
          await client.query(
            `insert into public.guardians (
               id, relationship, full_name, phone, email, occupation, annual_income, created_at, updated_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [
              guardianId,
              g.relationship || g.relation || 'guardian',
              g.fullName || g.name || 'Guardian',
              g.phone || '9876543210',
              g.email || null,
              g.occupation || null,
              g.annualIncome || null,
              nowIso,
            ]
          );

          await client.query(
            `insert into public.student_guardians (student_id, guardian_id, is_primary_contact)
             values ($1, $2, $3)`,
            [studentId, guardianId, g.isPrimaryContact ?? g.isPrimary ?? false]
          );
        }
      }

      // Record status history
      const historyId = randomUUID();
      await client.query(
        `insert into public.admission_status_history (
           id, admission_application_id, from_status, to_status, changed_by, reason, created_at
         ) values ($1, $2, null, 'draft', $3, 'Application draft created.', $4)`,
        [historyId, applicationId, session.staffId, nowIso]
      );

      // Audit log
      await client.query(
        `insert into public.audit_logs (
           id, actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at
         ) values ($1, $2, 'ADMISSION_DRAFT_CREATED', 'admission_applications', $3, 'SUCCESS', $4, $5)`,
        [randomUUID(), session.staffId, applicationId, `Created draft application ${applicationNumber}`, nowIso]
      );

      return this.getApplicationById(applicationId, session, client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async updateDraft(
    applicationId: string,
    payload: any,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      const appRes = await client.query(
        `select * from public.admission_applications where id = $1`,
        [applicationId]
      );
      if (appRes.rowCount === 0) {
        throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
      }
      const app = appRes.rows[0];
      if (app.status !== 'draft') {
        throw new BusinessRuleError(`Cannot update application in status "${app.status}". Only draft applications can be edited.`);
      }

      const nowIso = new Date().toISOString();

      // Update requested grade/section if provided
      await client.query(
        `update public.admission_applications
         set requested_grade_level_id = coalesce($1, requested_grade_level_id),
             requested_section_id = coalesce($2, requested_section_id),
             updated_at = $3
         where id = $4`,
        [payload.gradeLevelId || null, payload.sectionId || null, nowIso, applicationId]
      );

      // Update student demographics
      if (payload.student) {
        await client.query(
          `update public.students
           set first_name = coalesce($1, first_name),
               last_name = coalesce($2, last_name),
               dob = coalesce($3, dob),
               gender = coalesce($4, gender),
               nationality = coalesce($5, nationality),
               mother_tongue = coalesce($6, mother_tongue),
               transport_opted_in = coalesce($7, transport_opted_in),
               updated_at = $8
           where id = $9`,
          [
            payload.student.firstName || null,
            payload.student.lastName || null,
            payload.student.dob || null,
            payload.student.gender || null,
            payload.student.nationality || null,
            payload.student.motherTongue || null,
            payload.student.transportOptedIn ?? null,
            nowIso,
            app.student_id,
          ]
        );
      }

      const updated = await this.getApplicationById(applicationId, session, client);
      return updated!;
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async submitApplication(
    applicationId: string,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      const nowIso = new Date().toISOString();
      await client.query(
        `update public.admission_applications set status = 'submitted', updated_at = $1 where id = $2`,
        [nowIso, applicationId]
      );
      await client.query(
        `insert into public.admission_status_history (id, admission_application_id, from_status, to_status, changed_by, reason, created_at)
         values ($1, $2, 'draft', 'submitted', $3, 'Submitted application.', $4)`,
        [randomUUID(), applicationId, session.staffId, nowIso]
      );
      return this.getApplicationById(applicationId, session, client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async reviewApplication(
    applicationId: string,
    payload: any,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      const curr = await client.query('select status from public.admission_applications where id = $1', [applicationId]);
      if (curr.rowCount === 0) throw new NotFoundError(`Admission application "${applicationId}" not found.`);
      const fromStatus = curr.rows[0].status;

      let toStatus = 'under_review';
      if (payload.action === 'hold' || payload.action === 'on_hold') {
        toStatus = 'on_hold';
      } else if (payload.action === 'return_to_draft') {
        toStatus = 'draft';
      }

      const nowIso = new Date().toISOString();
      await client.query(
        `update public.admission_applications set status = $1, reviewed_by = $2, reviewed_at = $3, updated_at = $3 where id = $4`,
        [toStatus, session.staffId, nowIso, applicationId]
      );
      await client.query(
        `insert into public.admission_status_history (id, admission_application_id, from_status, to_status, changed_by, reason, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), applicationId, fromStatus, toStatus, session.staffId, payload.remarks || 'Reviewed application.', nowIso]
      );
      return this.getApplicationById(applicationId, session, client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async rejectApplication(
    applicationId: string,
    payload: any,
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      if (session.role !== 'principal') {
        throw new AuthorizationError('Only Principal can reject an admission application.');
      }
      const curr = await client.query('select status from public.admission_applications where id = $1', [applicationId]);
      if (curr.rowCount === 0) throw new NotFoundError(`Admission application "${applicationId}" not found.`);
      const fromStatus = curr.rows[0].status;

      const nowIso = new Date().toISOString();
      await client.query(
        `update public.admission_applications set status = 'rejected', decision_reason = $1, reviewed_by = $2, reviewed_at = $3, updated_at = $3 where id = $4`,
        [payload.decisionReason || 'Rejected by Principal.', session.staffId, nowIso, applicationId]
      );
      await client.query(
        `insert into public.admission_status_history (id, admission_application_id, from_status, to_status, changed_by, reason, created_at)
         values ($1, $2, $3, 'rejected', $4, $5, $6)`,
        [randomUUID(), applicationId, fromStatus, session.staffId, payload.decisionReason || 'Rejected by Principal.', nowIso]
      );
      return this.getApplicationById(applicationId, session, client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getApplicationById(
    applicationId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const queryFn = existingClient
      ? (text: string, params: any[]) => existingClient.query(text, params)
      : (text: string, params: any[]) => query(text, params, session);

    const res = await queryFn(
      `select a.*, s.first_name, s.last_name, s.dob, s.gender, s.nationality, s.mother_tongue,
              s.blood_group, s.sts_number, s.dise_number, s.caste, s.subcaste, s.transport_opted_in
       from public.admission_applications a
       join public.students s on s.id = a.student_id
       where a.id = $1`,
      [applicationId]
    );

    if (res.rowCount === 0) return undefined;
    const r = res.rows[0];

    // Fetch guardians
    const guardRes = await queryFn(
      `select g.*, sg.is_primary_contact from public.student_guardians sg
       join public.guardians g on g.id = sg.guardian_id
       where sg.student_id = $1`,
      [r.student_id]
    );

    // Fetch history
    const histRes = await queryFn(
      `select h.*, sm.full_name as staff_name, sm.role as staff_role
       from public.admission_status_history h
       left join public.staff_members sm on sm.id = h.changed_by
       where h.admission_application_id = $1
       order by h.created_at asc`,
      [applicationId]
    );

    return {
      id: r.id,
      applicationNumber: r.application_number,
      academicYearId: r.academic_year_id,
      requestedGradeLevelId: r.requested_grade_level_id,
      requestedSectionId: r.requested_section_id,
      status: r.status as AdmissionApplicationStatus,
      studentId: r.student_id,
      student: {
        firstName: r.first_name,
        lastName: r.last_name,
        dob: r.dob,
        gender: r.gender,
        nationality: r.nationality,
        motherTongue: r.mother_tongue,
        bloodGroup: r.blood_group,
        stsNumber: r.sts_number,
        diseNumber: r.dise_number,
        caste: r.caste,
        subcaste: r.subcaste,
        transportOptedIn: r.transport_opted_in,
      },
      guardians: guardRes.rows.map((g: any) => ({
        id: g.id,
        relationship: g.relationship,
        fullName: g.full_name,
        phone: g.phone,
        email: g.email,
        occupation: g.occupation,
        annualIncome: g.annual_income,
        isPrimaryContact: g.is_primary_contact,
      })),
      statusHistory: histRes.rows.map((h: any) => ({
        id: h.id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        changedBy: h.changed_by,
        changedByName: h.staff_name || 'Staff Member',
        changedByRole: h.staff_role || 'staff',
        reason: h.reason || '',
        changedAt: h.created_at,
      })),
      decisionReason: r.decision_reason,
      seatReservedUntil: r.seat_reserved_until,
      overrideMissingDocumentsReason: r.override_missing_documents_reason,
      feeGenerated: r.fee_generated || false,
    };
  }

  async listApplications(
    filter: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const queryFn = existingClient
      ? (text: string, params: any[]) => existingClient.query(text, params)
      : (text: string, params: any[]) => query(text, params, session);

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.academicYearId) {
      conditions.push(`a.academic_year_id = $${pIdx++}`);
      params.push(filter.academicYearId);
    }
    if (filter.status) {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.gradeLevelId) {
      conditions.push(`a.requested_grade_level_id = $${pIdx++}`);
      params.push(filter.gradeLevelId);
    }
    if (filter.sectionId) {
      conditions.push(`a.requested_section_id = $${pIdx++}`);
      params.push(filter.sectionId);
    }

    const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const totalRes = await queryFn(
      `select count(*) as cnt from public.admission_applications a ${whereClause}`,
      params
    );
    const total = parseInt(totalRes.rows[0].cnt, 10);

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    params.push(limit, offset);

    const listRes = await queryFn(
      `select a.id, a.application_number, a.academic_year_id, a.status, a.student_id,
              s.first_name, s.last_name, g.name as grade_name, sec.name as section_name, y.label as year_label
       from public.admission_applications a
       join public.students s on s.id = a.student_id
       join public.grade_levels g on g.id = a.requested_grade_level_id
       join public.academic_years y on y.id = a.academic_year_id
       left join public.sections sec on sec.id = a.requested_section_id
       ${whereClause}
       order by a.created_at desc
       limit $${pIdx++} offset $${pIdx++}`,
      params
    );

    const data: any[] = listRes.rows.map((r: any) => ({
      id: r.id,
      applicationNumber: r.application_number,
      academicYearId: r.academic_year_id,
      academicYearLabel: r.year_label,
      studentId: r.student_id,
      studentName: `${r.first_name} ${r.last_name}`,
      gradeLevelId: '',
      gradeLevelName: r.grade_name,
      sectionId: null,
      sectionName: r.section_name || 'Unassigned',
      status: r.status,
      submittedAt: null,
      reviewedAt: null,
      decisionReason: null,
      createdAt: '',
      updatedAt: '',
    }));

    return {
      data,
      total,
      limit,
      offset,
      counts: {
        total,
        draft: 0,
        submitted: 0,
        under_review: 0,
        on_hold: 0,
        approved: 0,
        rejected: 0,
        admitted: 0,
        cancelled: 0,
      } as any,
    };
  }

  async checkCapacity(
    sectionId: string,
    academicYearId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const queryFn = existingClient
      ? (text: string, params: any[]) => existingClient.query(text, params)
      : (text: string, params: any[]) => query(text, params, session);

    const secRes = await queryFn(
      `select s.id, s.name as section_name, s.max_capacity, g.id as grade_id, g.name as grade_name, g.group_name
       from public.sections s
       join public.grade_levels g on g.id = s.grade_level_id
       where s.id = $1 and s.academic_year_id = $2`,
      [sectionId, academicYearId]
    );

    if (secRes.rowCount === 0) {
      throw new NotFoundError(`Section "${sectionId}" not found in academic year.`);
    }

    const sec = secRes.rows[0];

    const enrollRes = await queryFn(
      `select count(*) as cnt from public.student_academic_records
       where section_id = $1 and academic_year_id = $2 and status in ('admitted', 'active')`,
      [sectionId, academicYearId]
    );
    const enrolledInSection = parseInt(enrollRes.rows[0].cnt, 10);

    const groupEnrollRes = await queryFn(
      `select count(*) as cnt from public.student_academic_records r
       join public.grade_levels g on g.id = r.grade_level_id
       where g.group_name = $1 and r.academic_year_id = $2 and r.status in ('admitted', 'active')`,
      [sec.group_name, academicYearId]
    );
    const enrolledInGroup = parseInt(groupEnrollRes.rows[0].cnt, 10);

    const sectionCap = sec.max_capacity || 40;
    const groupCap = 100;
    const isAvailable = enrolledInSection < sectionCap && enrolledInGroup < groupCap;

    return {
      sectionId,
      sectionName: sec.section_name,
      gradeLevelId: sec.grade_id,
      gradeLevelName: sec.grade_name,
      academicYearId,
      enrolledInSection,
      sectionMaxCapacity: sectionCap,
      isSectionAvailable: enrolledInSection < sectionCap,
      divisionGroup: sec.group_name,
      enrolledInDivisionGroup: enrolledInGroup,
      divisionGroupCapacity: groupCap,
      isDivisionGroupAvailable: enrolledInGroup < groupCap,
      isCapacityAvailable: isAvailable,
      utilizationPercentage: Math.round((enrolledInSection / sectionCap) * 100),
      divisionUtilizationPercentage: Math.round((enrolledInGroup / groupCap) * 100),
    };
  }

  async approveApplication(
    applicationId: string,
    payload: { sectionId: string; remarks?: string },
    session: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    const runInTx = async (client: PoolClient) => {
      // 1. Principal Role Check
      if (session.role !== 'principal') {
        throw new AuthorizationError('Access Denied: Only the Principal holds authority to approve student admissions.');
      }

      // 2. Fetch Application
      const appRes = await client.query(
        `select * from public.admission_applications where id = $1`,
        [applicationId]
      );
      if (appRes.rowCount === 0) {
        throw new NotFoundError(`Admission application with ID "${applicationId}" not found.`);
      }
      const app = appRes.rows[0];

      // 3. Idempotent check
      if (app.status === 'approved') {
        const existRec = await client.query(
          `select * from public.student_academic_records where student_id = $1 and academic_year_id = $2`,
          [app.student_id, app.academic_year_id]
        );
        if ((existRec.rowCount ?? 0) > 0) {
          const rec = existRec.rows[0];
          return {
            applicationId: app.id,
            applicationNumber: app.application_number,
            admissionNumber: rec.admission_number,
            studentId: app.student_id,
            studentAcademicRecordId: rec.id,
            sectionId: rec.section_id,
            status: 'approved',
            approvedBy: app.reviewed_by || session.staffId,
            approvedAt: app.reviewed_at || app.updated_at,
            initialAssessmentId: null,
            initialBilledAmountInr: formatInr('0.00'),
            feeGenerated: app.fee_generated,
          };
        }
      }

      // 4. Concurrency lock on the section row to protect seat capacity under race conditions
      const secLock = await client.query(
        `select id, grade_level_id, name, max_capacity from public.sections where id = $1 for update`,
        [payload.sectionId]
      );
      if (secLock.rowCount === 0) {
        throw new NotFoundError(`Section "${payload.sectionId}" not found.`);
      }
      const secRow = secLock.rows[0];

      // Check current enrolled count under lock
      const countRes = await client.query(
        `select count(*) as cnt from public.student_academic_records
         where section_id = $1 and academic_year_id = $2 and status in ('admitted', 'active')`,
         [payload.sectionId, app.academic_year_id]
      );
      const currentEnrolled = parseInt(countRes.rows[0].cnt, 10);
      if (currentEnrolled >= secRow.max_capacity) {
        throw new BusinessRuleError(
          `SECTION_CAPACITY_EXCEEDED: Section "${secRow.name}" has reached capacity (${currentEnrolled}/${secRow.max_capacity} filled). Approval blocked.`
        );
      }

      // 5. Monotonic admission number allocation (ADM-YYYY-NNNN) via DB sequence
      const admissionNumRes = await client.query(
        `select private.next_admission_number('ADM', $1) as val`,
        [app.academic_year_id]
      );
      const admissionNumber = admissionNumRes.rows[0].val;

      // 6. Insert student academic record (admitted)
      const academicRecordId = randomUUID();
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      await client.query(
        `insert into public.student_academic_records (
           id, student_id, academic_year_id, grade_level_id, section_id,
           admission_number, status, admission_date, notes, created_at
         ) values ($1, $2, $3, $4, $5, $6, 'admitted', $7, $8, $9)`,
        [
          academicRecordId,
          app.student_id,
          app.academic_year_id,
          secRow.grade_level_id,
          payload.sectionId,
          admissionNumber,
          todayDate,
          payload.remarks || 'Admitted via Principal approval.',
          nowIso,
        ]
      );

      // 7. Instantiation of Fee Assessment from approved fee structure (DEC-01 zero payment gate)
      const structRes = await client.query(
        `select id from public.fee_structures
         where academic_year_id = $1 and grade_level_id = $2 and status = 'approved'
         order by version desc limit 1`,
        [app.academic_year_id, secRow.grade_level_id]
      );

      let initialAssessmentId: string | null = null;
      let initialBilledAmount = formatInr('0.00');
      let feeGenerated = false;

      if ((structRes.rowCount ?? 0) > 0) {
        const structId = structRes.rows[0].id;
        initialAssessmentId = randomUUID();
        const assessNumRes = await client.query(
          `select private.next_receipt_number('ASM', $1) as num`,
          [app.academic_year_id]
        );
        const assessmentNumber = assessNumRes.rows[0].num;

        await client.query(
          `insert into public.student_fee_assessments (
             id, student_academic_record_id, fee_structure_id, assessment_number, status, assessed_at, snapshot, created_at, updated_at
           ) values ($1, $2, $3, $4, 'issued', $5, '{}', $6, $7)`,
          [initialAssessmentId, academicRecordId, structId, assessmentNumber, nowIso, nowIso, nowIso]
        );

        // Fetch structure lines
        const linesRes = await client.query(
          `select * from public.fee_structure_lines where fee_structure_id = $1`,
          [structId]
        );

        for (const l of linesRes.rows) {
          await client.query(
            `insert into public.student_fee_assessment_lines (
               id, student_fee_assessment_id, fee_head_id, assessed_amount, is_optional, created_at
             ) values ($1, $2, $3, $4, false, $5)`,
            [randomUUID(), initialAssessmentId, l.fee_head_id, formatInr(l.amount), nowIso]
          );
          initialBilledAmount = addInr(initialBilledAmount, l.amount);
        }

        feeGenerated = true;
      }

      // 8. Update admission application
      await client.query(
        `update public.admission_applications
         set status = 'approved',
             requested_section_id = $1,
             reviewed_by = $2,
             reviewed_at = $3,
             decision_reason = $4,
             fee_generated = $5,
             updated_at = $6
         where id = $7`,
        [
          payload.sectionId,
          session.staffId,
          nowIso,
          payload.remarks || 'Principal approved admission.',
          feeGenerated,
          nowIso,
          applicationId,
        ]
      );

      // 9. Status history
      await client.query(
        `insert into public.admission_status_history (
           id, admission_application_id, from_status, to_status, changed_by, reason, created_at
         ) values ($1, $2, $3, 'approved', $4, $5, $6)`,
        [randomUUID(), applicationId, app.status, session.staffId, payload.remarks || 'Principal approved admission.', nowIso]
      );

      // 10. Audit log
      await client.query(
        `insert into public.audit_logs (
           id, actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at
         ) values ($1, $2, 'ADMISSION_APPROVED', 'admission_applications', $3, 'SUCCESS', $4, $5)`,
        [randomUUID(), session.staffId, applicationId, `Principal approved admission for student ${app.student_id} as ${admissionNumber}`, nowIso]
      );

      return {
        applicationId,
        applicationNumber: app.application_number,
        admissionNumber,
        studentId: app.student_id,
        studentAcademicRecordId: academicRecordId,
        sectionId: payload.sectionId,
        status: 'approved',
        approvedBy: session.staffId,
        approvedAt: nowIso,
        initialAssessmentId,
        initialBilledAmountInr: initialBilledAmount,
        feeGenerated,
      };
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getAcademicRecordById(
    recordId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for database operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(
        `select * from public.student_academic_records where id = $1`,
        [recordId]
      );
      if (res.rowCount === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        studentId: r.student_id,
        academicYearId: r.academic_year_id,
        gradeLevelId: r.grade_level_id,
        sectionId: r.section_id,
        admissionNumber: r.admission_number,
        status: r.status,
        admissionDate: r.admission_date,
        rollNumber: r.roll_number,
        transportOptedIn: r.transport_opted_in,
        notes: r.notes,
        createdAt: r.created_at,
      };
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async listAcademicRecordsForYear(
    academicYearId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any[]> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for database operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(
        `select * from public.student_academic_records where academic_year_id = $1 order by created_at desc`,
        [academicYearId]
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        academicYearId: r.academic_year_id,
        gradeLevelId: r.grade_level_id,
        sectionId: r.section_id,
        admissionNumber: r.admission_number,
        status: r.status,
        admissionDate: r.admission_date,
        rollNumber: r.roll_number,
        transportOptedIn: r.transport_opted_in,
        notes: r.notes,
        createdAt: r.created_at,
      }));
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getAllAcademicRecords(
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any[]> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for database operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(`select * from public.student_academic_records order by created_at desc`);
      return res.rows.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        academicYearId: r.academic_year_id,
        gradeLevelId: r.grade_level_id,
        sectionId: r.section_id,
        admissionNumber: r.admission_number,
        status: r.status,
        admissionDate: r.admission_date,
        rollNumber: r.roll_number,
        transportOptedIn: r.transport_opted_in,
        notes: r.notes,
        createdAt: r.created_at,
      }));
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getStudentById(
    studentId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for database operations.');
    }
    const runInTx = async (client: any) => {
      const res = await client.query(`select * from public.students where id = $1`, [studentId]);
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        firstName: r.first_name,
        middleName: r.middle_name,
        lastName: r.last_name,
        dob: r.dob,
        gender: r.gender,
        nationality: r.nationality,
        motherTongue: r.mother_tongue,
        bloodGroup: r.blood_group,
        religion: r.religion,
        caste: r.caste,
        subcaste: r.subcaste,
        category: r.category,
        stsNumber: r.sts_number,
        diseNumber: r.dise_number,
        transportOptedIn: r.transport_opted_in,
      };
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }

  async getApplicationByRecordId(
    recordId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authenticated user session is required for database operations.');
    }
    const runInTx = async (client: any) => {
      const recRes = await client.query(
        `select student_id, academic_year_id from public.student_academic_records where id = $1`,
        [recordId]
      );
      if (recRes.rowCount === 0) return null;
      const { student_id, academic_year_id } = recRes.rows[0];
      const appRes = await client.query(
        `select id from public.admission_applications where student_id = $1 and academic_year_id = $2`,
        [student_id, academic_year_id]
      );
      if (appRes.rowCount === 0) return null;
      return this.getApplicationById(appRes.rows[0].id, session, client);
    };

    if (existingClient) {
      return runInTx(existingClient);
    }
    return withTransaction(session, runInTx);
  }
}
