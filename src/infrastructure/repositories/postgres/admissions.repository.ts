import { IAdmissionsRepository } from '../interfaces';
import { withTransaction, query } from '../../db/postgres-pool';
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
  InternalAcademicRecord,
  InternalApplicationRecord,
} from '../../../modules/admissions/service';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../lib/errors';
import { randomUUID } from 'crypto';
import { toDecimalInrString } from '../../../modules/shared/types';
import { computeAadhaarHash, maskAadhaar, maskBankAccount } from '../../../lib/crypto/pii';
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
    session: AuthenticatedUserSession
  ): Promise<string> {
    const shortLabel = this.formatAcademicYearShort(yearLabel);
    const seriesCode = `APP-${shortLabel}`;

    const res = await query(
      `insert into public.receipt_number_counters as c (series_code, next_value)
       values ($1, 2)
       on conflict (series_code) do update
         set next_value = c.next_value + 1, updated_at = now()
       returning c.next_value - 1 as val`,
      [seriesCode],
      session
    );

    const seq = res.rows[0].val;
    return `${seq}/${shortLabel}`;
  }

  async getNextAdmissionNumber(
    academicYearId: string,
    yearLabel: string,
    session: AuthenticatedUserSession
  ): Promise<string> {
    const startYearMatch = yearLabel.match(/^(\d{4})/);
    const startYear = startYearMatch ? startYearMatch[1] : '2026';
    const seriesCode = `ADM-${startYear}`;

    const res = await query(
      `insert into public.receipt_number_counters as c (series_code, next_value)
       values ($1, 2)
       on conflict (series_code) do update
         set next_value = c.next_value + 1, updated_at = now()
       returning c.next_value - 1 as val`,
      [seriesCode],
      session
    );

    const seq = res.rows[0].val;
    return `ADM-${startYear}-${String(seq).padStart(4, '0')}`;
  }

  async createDraft(
    payload: any,
    session: AuthenticatedUserSession
  ): Promise<any> {
    return withTransaction(session, async (client) => {
      // Fetch academic year
      const yearRes = await client.query(
        `select id, label from public.academic_years where id = $1`,
        [payload.academicYearId]
      );
      if (yearRes.rowCount === 0) {
        throw new NotFoundError(`Academic year with ID "${payload.academicYearId}" not found.`);
      }
      const yearLabel = yearRes.rows[0].label;

      const applicationNumber = await this.getNextApplicationNumber(payload.academicYearId, yearLabel, session);
      const studentId = randomUUID();
      const applicationId = randomUUID();
      const nowIso = new Date().toISOString();

      // Insert student demographics
      await client.query(
        `insert into public.students (
           id, first_name, last_name, dob, gender, nationality, mother_tongue,
           blood_group, sts_number, dise_number, caste, subcaste, transport_opted_in, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          studentId,
          payload.student.firstName,
          payload.student.lastName,
          payload.student.dob,
          payload.student.gender,
          payload.student.nationality || 'Indian',
          payload.student.motherTongue || 'Kannada',
          payload.student.bloodGroup || null,
          payload.student.stsNumber || null,
          payload.student.diseNumber || null,
          payload.student.caste || null,
          payload.student.subcaste || null,
          payload.student.transportOptedIn ?? false,
          nowIso,
          nowIso,
        ]
      );

      // Insert sensitive details if provided
      if (payload.sensitiveDetails) {
        await client.query(
          `insert into public.student_sensitive_details (
             id, student_id, aadhaar_number, annual_family_income, bank_account_number,
             bank_ifsc_code, created_at, updated_at
           ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            studentId,
            payload.sensitiveDetails.aadhaarNumber || null,
            payload.sensitiveDetails.annualFamilyIncome || null,
            payload.sensitiveDetails.bankAccountNumber || null,
            payload.sensitiveDetails.bankIfscCode || null,
            nowIso,
            nowIso,
          ]
        );
      }

      // Insert guardians
      if (payload.guardians && payload.guardians.length > 0) {
        for (const g of payload.guardians) {
          const guardianId = randomUUID();
          await client.query(
            `insert into public.guardians (
               id, name, relation, occupation, income, phone, email, address, created_at, updated_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              guardianId,
              g.name,
              g.relation,
              g.occupation || null,
              g.annualIncome || null,
              g.phone || null,
              g.email || null,
              g.address || null,
              nowIso,
              nowIso,
            ]
          );

          await client.query(
            `insert into public.student_guardians (
               id, student_id, guardian_id, is_primary, created_at
             ) values ($1, $2, $3, $4, $5)`,
            [randomUUID(), studentId, guardianId, g.isPrimary ?? false, nowIso]
          );
        }
      }

      // Insert admission application
      await client.query(
        `insert into public.admission_applications (
           id, application_number, academic_year_id, requested_grade_level_id,
           requested_section_id, status, student_id, fee_generated, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, 'draft', $6, false, $7, $8)`,
        [
          applicationId,
          applicationNumber,
          payload.academicYearId,
          payload.gradeLevelId,
          payload.sectionId || null,
          studentId,
          nowIso,
          nowIso,
        ]
      );

      // Insert status history
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

      return {
        id: applicationId,
        applicationNumber,
        academicYearId: payload.academicYearId,
        requestedGradeLevelId: payload.gradeLevelId,
        requestedSectionId: payload.sectionId || null,
        status: 'draft',
        studentId,
        student: payload.student,
        sensitiveDetails: payload.sensitiveDetails,
        guardians: payload.guardians || [],
        statusHistory: [
          {
            id: historyId,
            fromStatus: null,
            toStatus: 'draft',
            changedBy: session.staffId,
            changedByName: session.fullName,
            changedByRole: session.role,
            reason: 'Application draft created.',
            changedAt: nowIso,
          },
        ],
        decisionReason: null,
        seatReservedUntil: null,
        feeGenerated: false,
      };
    });
  }

  async updateDraft(
    applicationId: string,
    payload: any,
    session: AuthenticatedUserSession
  ): Promise<any> {
    return withTransaction(session, async (client) => {
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

      const updated = await this.getApplicationById(applicationId, session);
      return updated!;
    });
  }

  async getApplicationById(
    applicationId: string,
    session: AuthenticatedUserSession
  ): Promise<any> {
    const res = await query(
      `select a.*, s.first_name, s.last_name, s.dob, s.gender, s.nationality, s.mother_tongue,
              s.blood_group, s.sts_number, s.dise_number, s.caste, s.subcaste, s.transport_opted_in
       from public.admission_applications a
       join public.students s on s.id = a.student_id
       where a.id = $1`,
      [applicationId],
      session
    );

    if (res.rowCount === 0) return undefined;
    const r = res.rows[0];

    // Fetch guardians
    const guardRes = await query(
      `select g.*, sg.is_primary from public.student_guardians sg
       join public.guardians g on g.id = sg.guardian_id
       where sg.student_id = $1`,
      [r.student_id],
      session
    );

    // Fetch sensitive details (RLS will filter out if not authorized)
    let sensitiveDetails: any = undefined;
    try {
      const sensRes = await query(
        `select * from public.student_sensitive_details where student_id = $1`,
        [r.student_id],
        session
      );
      if ((sensRes.rowCount ?? 0) > 0) {
        const s = sensRes.rows[0];
        sensitiveDetails = {
          aadhaarNumber: s.aadhaar_number,
          annualFamilyIncome: s.annual_family_income,
          bankAccountNumber: s.bank_account_number,
          bankIfscCode: s.bank_ifsc_code,
        };
      }
    } catch {
      // Unauthorized or denied by RLS
    }

    // Fetch history
    const histRes = await query(
      `select h.*, sm.full_name as staff_name, sm.role as staff_role
       from public.admission_status_history h
       left join public.staff_members sm on sm.id = h.changed_by
       where h.admission_application_id = $1
       order by h.created_at asc`,
      [applicationId],
      session
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
      sensitiveDetails,
      guardians: guardRes.rows.map((g) => ({
        id: g.id,
        name: g.name,
        relation: g.relation,
        occupation: g.occupation,
        annualIncome: g.income,
        phone: g.phone,
        email: g.email,
        address: g.address,
        isPrimary: g.is_primary,
      })),
      statusHistory: histRes.rows.map((h) => ({
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
    session: AuthenticatedUserSession
  ): Promise<any> {
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
    const totalRes = await query(
      `select count(*) as cnt from public.admission_applications a ${whereClause}`,
      params,
      session
    );
    const total = parseInt(totalRes.rows[0].cnt, 10);

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    params.push(limit, offset);

    const listRes = await query(
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
      params,
      session
    );

    const data: any[] = listRes.rows.map((r) => ({
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
    session: AuthenticatedUserSession
  ): Promise<any> {
    const secRes = await query(
      `select s.id, s.name as section_name, s.max_capacity, g.id as grade_id, g.name as grade_name, g.group_name
       from public.sections s
       join public.grade_levels g on g.id = s.grade_level_id
       where s.id = $1 and s.academic_year_id = $2`,
      [sectionId, academicYearId],
      session
    );

    if (secRes.rowCount === 0) {
      throw new NotFoundError(`Section "${sectionId}" not found in academic year.`);
    }

    const sec = secRes.rows[0];

    const enrollRes = await query(
      `select count(*) as cnt from public.student_academic_records
       where section_id = $1 and academic_year_id = $2 and status in ('admitted', 'active')`,
      [sectionId, academicYearId],
      session
    );
    const enrolledInSection = parseInt(enrollRes.rows[0].cnt, 10);

    const groupEnrollRes = await query(
      `select count(*) as cnt from public.student_academic_records r
       join public.grade_levels g on g.id = r.grade_level_id
       where g.group_name = $1 and r.academic_year_id = $2 and r.status in ('admitted', 'active')`,
      [sec.group_name, academicYearId],
      session
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
    session: AuthenticatedUserSession
  ): Promise<any> {
    return withTransaction(session, async (client) => {
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
            initialBilledAmountInr: '0.00',
            feeGenerated: app.fee_generated,
          };
        }
      }

      // 4. Check section capacity
      const capacity = await this.checkCapacity(payload.sectionId, app.academic_year_id, session);
      if (!capacity.isCapacityAvailable) {
        throw new BusinessRuleError(
          `SECTION_CAPACITY_EXCEEDED: Section "${capacity.sectionName}" in "${capacity.gradeLevelName}" has reached capacity (${capacity.enrolledInSection}/${capacity.sectionMaxCapacity} filled). Approval blocked.`
        );
      }

      // 5. Monotonic admission number allocation (ADM-YYYY-NNNN)
      const yearRes = await client.query(`select label from public.academic_years where id = $1`, [app.academic_year_id]);
      const yearLabel = yearRes.rows[0]?.label || '2026-2027';
      const admissionNumber = await this.getNextAdmissionNumber(app.academic_year_id, yearLabel, session);

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
          capacity.gradeLevelId,
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
        [app.academic_year_id, capacity.gradeLevelId]
      );

      let initialAssessmentId: string | null = null;
      let initialBilledAmount = '0.00';
      let feeGenerated = false;

      if ((structRes.rowCount ?? 0) > 0) {
        const structId = structRes.rows[0].id;
        initialAssessmentId = randomUUID();
        const assessNumRes = await client.query(`select private.next_receipt_number('ASM') as num`);
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
            [randomUUID(), initialAssessmentId, l.fee_head_id, l.amount, nowIso]
          );
          initialBilledAmount = (Number(initialBilledAmount) + Number(l.amount)).toFixed(2);
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
        initialBilledAmountInr: toDecimalInrString(initialBilledAmount),
        feeGenerated,
      };
    });
  }

  async getAcademicRecordById(
    recordId: string,
    session: AuthenticatedUserSession
  ): Promise<any> {
    const res = await query(
      `select * from public.student_academic_records where id = $1`,
      [recordId],
      session
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
  }

  async listAcademicRecordsForYear(
    academicYearId: string,
    session: AuthenticatedUserSession
  ): Promise<any[]> {
    const res = await query(
      `select * from public.student_academic_records where academic_year_id = $1 order by created_at desc`,
      [academicYearId],
      session
    );
    return res.rows.map((r) => ({
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
  }
}
