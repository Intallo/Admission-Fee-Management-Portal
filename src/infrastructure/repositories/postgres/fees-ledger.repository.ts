import { IFeesLedgerRepository } from '../interfaces';
import { withTransaction, query } from '../../db/postgres-pool';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { FeeCategory } from '../../../modules/fee-configuration/types';
import {
  RecordPaymentRequestDTO,
  RecordPaymentResultDTO,
  ReversePaymentResultDTO,
  StudentFeeAssessmentLineDTO,
  StudentFeeSummaryDTO,
} from '../../../modules/fees-ledger/types';
import {
  InternalFeeAdjustment,
  InternalPaymentAllocation,
  InternalPaymentRecord,
} from '../../../modules/fees-ledger/service';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../lib/errors';
import {
  addInr,
  amountInWordsInr,
  compareInr,
  formatInr,
  multiplyInr,
  subtractInr,
} from '../../../lib/money/inr';
import { DecimalInrString, ReceiptNumber, toDecimalInrString, UUID } from '../../../modules/shared/types';
import { randomUUID } from 'crypto';
import { logger } from '../../../lib/logger';

export class PostgresFeesLedgerRepository implements IFeesLedgerRepository {
  async getStudentDuesSummary(
    studentAcademicRecordId: string,
    academicYearId: string,
    session: AuthenticatedUserSession
  ): Promise<StudentFeeSummaryDTO> {
    return withTransaction(session, async (client) => {
      // 1. Fetch student assessment header
      const assessRes = await client.query(
        `select a.id, a.assessment_number, a.status, a.student_academic_record_id, r.student_id, r.admission_number,
                s.first_name, s.last_name, g.name as grade_name, sec.name as section_name
         from public.student_fee_assessments a
         join public.student_academic_records r on r.id = a.student_academic_record_id
         join public.students s on s.id = r.student_id
         join public.grade_levels g on g.id = r.grade_level_id
         left join public.sections sec on sec.id = r.section_id
         where a.student_academic_record_id = $1`,
        [studentAcademicRecordId]
      );

      if (assessRes.rowCount === 0) {
        throw new NotFoundError(`No fee assessment found for student academic record "${studentAcademicRecordId}".`);
      }

      const assessment = assessRes.rows[0];

      // 2. Fetch assessment lines with fee heads
      const linesRes = await client.query(
        `select l.id, l.fee_head_id, l.assessed_amount, l.is_optional,
                h.code as head_code, h.name as head_name, h.category as head_category, h.is_variable
         from public.student_fee_assessment_lines l
         join public.fee_heads h on h.id = l.fee_head_id
         where l.student_fee_assessment_id = $1
         order by h.name asc`,
        [assessment.id]
      );

      const feeHeadSummaries: StudentFeeAssessmentLineDTO[] = [];
      let totalAssessed = '0.00';
      let totalConcessions = '0.00';
      let totalPaid = '0.00';
      let totalRemaining = '0.00';

      for (const row of linesRes.rows) {
        const lineId = row.id;
        const assessed = Number(row.assessed_amount).toFixed(2);

        // Fetch approved adjustments
        const adjRes = await client.query(
          `select adjustment_type, amount from public.fee_adjustments
           where student_fee_assessment_line_id = $1 and status = 'approved'`,
          [lineId]
        );

        let concessionAmount = '0.00';
        for (const adj of adjRes.rows) {
          const amt = Number(adj.amount).toFixed(2);
          if (adj.adjustment_type === 'concession') {
            concessionAmount = addInr(concessionAmount, amt);
          }
        }

        // Fetch allocations
        const allocRes = await client.query(
          `select coalesce(sum(amount), 0) as paid
           from public.payment_allocations
           where student_fee_assessment_line_id = $1`,
          [lineId]
        );
        const paidAmount = Number(allocRes.rows[0].paid).toFixed(2);

        // Net remaining dues = Assessed - Concession - Paid
        const netAssessed = subtractInr(assessed, concessionAmount);
        const lineRemaining = subtractInr(netAssessed, paidAmount);

        totalAssessed = addInr(totalAssessed, assessed);
        totalConcessions = addInr(totalConcessions, concessionAmount);
        totalPaid = addInr(totalPaid, paidAmount);
        totalRemaining = addInr(totalRemaining, lineRemaining);

        feeHeadSummaries.push({
          id: lineId,
          feeHeadId: row.fee_head_id,
          feeHeadName: row.head_name,
          category: row.head_category as FeeCategory,
          assessedAmount: toDecimalInrString(assessed),
          approvedConcessionsAmount: toDecimalInrString(concessionAmount),
          collectedAmount: toDecimalInrString(paidAmount),
          refundedReversedAmount: toDecimalInrString('0.00'),
          netRemainingDues: toDecimalInrString(lineRemaining),
        });
      }

      return {
        studentAcademicRecordId,
        studentName: `${assessment.first_name} ${assessment.last_name}`,
        admissionNumber: assessment.admission_number,
        standard: assessment.grade_name,
        totalAssessedInr: toDecimalInrString(totalAssessed),
        totalConcessionsInr: toDecimalInrString(totalConcessions),
        totalPaidInr: toDecimalInrString(totalPaid),
        netBalanceDueInr: toDecimalInrString(totalRemaining),
        lines: feeHeadSummaries,
      };
    });
  }

  async recordOfflinePayment(
    params: RecordPaymentRequestDTO,
    idempotencyKey: string | undefined,
    session: AuthenticatedUserSession
  ): Promise<RecordPaymentResultDTO> {
    return withTransaction(session, async (client) => {
      // 1. Role validation (Accountant, Principal, Clerk)
      if (!['accountant', 'principal', 'clerk'].includes(session.role)) {
        throw new AuthorizationError(`Role "${session.role}" is not authorized to record payments.`);
      }

      // 2. Validate allocations sum equals payment amount
      let allocationSum = '0.00';
      for (const a of params.allocations) {
        allocationSum = addInr(allocationSum, a.amount);
      }
      if (allocationSum !== params.amount) {
        throw new ValidationError(
          `Allocation sum mismatch: Sum of allocations (₹${allocationSum}) must exactly equal payment amount (₹${params.amount}).`
        );
      }

      // 3. Verify single category rule across all allocated lines
      const lineIds = params.allocations.map((a) => a.assessmentLineId);
      const linesCheck = await client.query(
        `select l.id, l.assessed_amount, h.category, h.is_variable, h.name as head_name
         from public.student_fee_assessment_lines l
         join public.fee_heads h on h.id = l.fee_head_id
         where l.id = any($1)`,
        [lineIds]
      );

      for (const line of linesCheck.rows) {
        if (line.category !== params.category) {
          throw new BusinessRuleError(
            `Single fee category violation: Head "${line.head_name}" belongs to category "${line.category}", which differs from payment category "${params.category}".`
          );
        }
      }

      // 4. Overpayment check on fixed fee heads
      for (const alloc of params.allocations) {
        const lineMeta = linesCheck.rows.find((r) => r.id === alloc.assessmentLineId);
        if (lineMeta && !lineMeta.is_variable) {
          const allocPaidRes = await client.query(
            `select coalesce(sum(amount), 0) as paid from public.payment_allocations where student_fee_assessment_line_id = $1`,
            [alloc.assessmentLineId]
          );
          const currentPaid = Number(allocPaidRes.rows[0].paid).toFixed(2);
          const remaining = subtractInr(Number(lineMeta.assessed_amount).toFixed(2), currentPaid);
          if (compareInr(alloc.amount, remaining) > 0) {
            throw new BusinessRuleError(
              `Overpayment disallowed: Allocated amount (₹${alloc.amount}) exceeds remaining dues (₹${remaining}) for head "${lineMeta.head_name}".`
            );
          }
        }
      }

      // 5. Insert payment header
      const paymentId = randomUUID();
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      await client.query(
        `insert into public.payments (
           id, student_academic_record_id, category, amount, currency, method,
           payer_name, reference_number, notes, transaction_type, transaction_date,
           recorded_by, created_at
         ) values ($1, $2, $3, $4, 'INR', $5, $6, $7, $8, 'standard', $9, $10, $11)`,
        [
          paymentId,
          params.studentAcademicRecordId,
          params.category,
          params.amount,
          params.method,
          params.payerName,
          params.referenceNumber || null,
          (params as any).notes || null,
          todayDate,
          session.staffId,
          nowIso,
        ]
      );

      // 6. Insert allocations
      for (const alloc of params.allocations) {
        const allocId = randomUUID();
        await client.query(
          `insert into public.payment_allocations (id, payment_id, student_fee_assessment_line_id, amount, created_at)
           values ($1, $2, $3, $4, $5)`,
          [allocId, paymentId, alloc.assessmentLineId, alloc.amount, nowIso]
        );
      }

      // 7. Atomic Monotonic Receipt Number Allocation via row-locked function
      const receiptNumRes = await client.query(`select private.next_receipt_number('RCT') as num`);
      const receiptNumber = receiptNumRes.rows[0].num as ReceiptNumber;

      // 8. Insert receipt with rendered snapshot
      const receiptId = randomUUID();
      const snapshot: Record<string, unknown> = {
        receiptNumber,
        category: params.category,
        amount: params.amount,
        payerName: params.payerName,
        paymentMethod: params.method,
        referenceNumber: params.referenceNumber || null,
        allocations: params.allocations,
        generatedAt: nowIso,
        cashierStaffId: session.staffId,
        cashierName: session.fullName,
      };

      await client.query(
        `insert into public.receipts (
           id, receipt_number, payment_id, student_academic_record_id, category,
           rendered_snapshot, template_version, reprint_count, issued_at, issued_by, created_at
         ) values ($1, $2, $3, $4, $5, $6, 'v1.0', 0, $7, $8, $9)`,
        [
          receiptId,
          receiptNumber,
          paymentId,
          params.studentAcademicRecordId,
          params.category,
          JSON.stringify(snapshot),
          nowIso,
          session.staffId,
          nowIso,
        ]
      );

      // 9. Insert immutable audit event
      await client.query(
        `insert into public.audit_logs (
           id, actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at
         ) values ($1, $2, 'PAYMENT_RECORDED', 'payments', $3, 'SUCCESS', $4, $5)`,
        [
          randomUUID(),
          session.staffId,
          paymentId,
          `Recorded payment of ₹${params.amount} under category ${params.category} with receipt ${receiptNumber}`,
          nowIso,
        ]
      );

      logger.info('Durable payment transaction committed to PostgreSQL', {
        paymentId,
        receiptNumber,
        amount: params.amount,
        category: params.category,
      });

      return {
        paymentId,
        receiptId,
        receiptNumber,
        category: params.category,
        amountInr: toDecimalInrString(params.amount),
        amountInWords: amountInWordsInr(params.amount),
        method: params.method,
        payerName: params.payerName,
        receivedAt: nowIso,
        renderedSnapshot: snapshot,
      };
    });
  }

  async requestAdjustment(
    params: {
      studentFeeAssessmentLineId: string;
      adjustmentType: 'concession' | 'additional_charge' | 'correction';
      amount: string;
      reason: string;
    },
    session: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    return withTransaction(session, async (client) => {
      const adjId = randomUUID();
      const nowIso = new Date().toISOString();

      await client.query(
        `insert into public.fee_adjustments (
           id, student_fee_assessment_line_id, adjustment_type, amount, reason,
           status, requested_by, requested_at, created_at
         ) values ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)`,
        [
          adjId,
          params.studentFeeAssessmentLineId,
          params.adjustmentType,
          params.amount,
          params.reason,
          session.staffId,
          nowIso,
          nowIso,
        ]
      );

      return {
        id: adjId,
        studentFeeAssessmentLineId: params.studentFeeAssessmentLineId,
        adjustmentType: params.adjustmentType,
        amount: toDecimalInrString(params.amount),
        status: 'pending',
        reason: params.reason,
        requestedBy: session.staffId,
        requestedAt: nowIso,
        approvedBy: null,
        approvedAt: null,
        createdAt: nowIso,
      };
    });
  }

  async approveFeeAdjustment(
    adjustmentId: string,
    session: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    return withTransaction(session, async (client) => {
      if (session.role !== 'principal') {
        throw new AuthorizationError('Access Denied: Only the Principal holds authority to approve fee adjustments.');
      }

      const adjRes = await client.query(
        `select * from public.fee_adjustments where id = $1`,
        [adjustmentId]
      );

      if (adjRes.rowCount === 0) {
        throw new NotFoundError(`Adjustment with ID "${adjustmentId}" not found.`);
      }

      const adj = adjRes.rows[0];
      if (adj.status !== 'pending') {
        throw new BusinessRuleError(`Adjustment is already processed with status: ${adj.status}`);
      }

      const nowIso = new Date().toISOString();

      await client.query(
        `update public.fee_adjustments
         set status = 'approved', approved_by = $1, approved_at = $2
         where id = $3`,
        [session.staffId, nowIso, adjustmentId]
      );

      return {
        id: adj.id,
        studentFeeAssessmentLineId: adj.student_fee_assessment_line_id,
        adjustmentType: adj.adjustment_type,
        amount: toDecimalInrString(Number(adj.amount).toFixed(2)),
        status: 'approved',
        reason: adj.reason,
        requestedBy: adj.requested_by,
        requestedAt: adj.requested_at,
        approvedBy: session.staffId,
        approvedAt: nowIso,
        createdAt: adj.created_at,
      };
    });
  }

  async reversePayment(
    paymentId: string,
    reason: string,
    session: AuthenticatedUserSession
  ): Promise<ReversePaymentResultDTO> {
    return withTransaction(session, async (client) => {
      if (session.role !== 'principal') {
        throw new AuthorizationError('Access Denied: Only the Principal holds authority to reverse payments.');
      }

      const payRes = await client.query(
        `select * from public.payments where id = $1`,
        [paymentId]
      );

      if (payRes.rowCount === 0) {
        throw new NotFoundError(`Payment with ID "${paymentId}" not found.`);
      }

      const orig = payRes.rows[0];

      // Check if already reversed
      const existingRev = await client.query(
        `select id from public.payments where reverses_payment_id = $1`,
        [paymentId]
      );
      if ((existingRev.rowCount ?? 0) > 0) {
        throw new ConflictError(`Payment "${paymentId}" has already been reversed.`);
      }

      const reversalId = randomUUID();
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);

      await client.query(
        `insert into public.payments (
           id, student_academic_record_id, category, amount, currency, method,
           payer_name, reference_number, notes, transaction_type, transaction_date,
           reverses_payment_id, recorded_by, created_at
         ) values ($1, $2, $3, $4, 'INR', $5, $6, $7, $8, 'reversal', $9, $10, $11, $12)`,
        [
          reversalId,
          orig.student_academic_record_id,
          orig.category,
          orig.amount,
          orig.method,
          orig.payer_name,
          orig.reference_number,
          reason,
          todayDate,
          paymentId,
          session.staffId,
          nowIso,
        ]
      );

      const auditLogId = randomUUID();
      await client.query(
        `insert into public.audit_logs (
           id, actor_staff_id, action, entity_type, entity_id, outcome, reason, created_at
         ) values ($1, $2, 'PAYMENT_REVERSED', 'payments', $3, 'SUCCESS', $4, $5)`,
        [
          auditLogId,
          session.staffId,
          reversalId,
          reason,
          nowIso,
        ]
      );

      return {
        reversalPaymentId: reversalId,
        originalPaymentId: paymentId,
        reversalAmountInr: toDecimalInrString(Number(orig.amount).toFixed(2)),
        reversedBy: session.staffId,
        reversedAt: nowIso,
        auditLogId,
      };
    });
  }

  async getPaymentById(paymentId: string, session: AuthenticatedUserSession): Promise<InternalPaymentRecord | undefined> {
    const res = await query(
      `select * from public.payments where id = $1`,
      [paymentId],
      session
    );
    if (res.rowCount === 0) return undefined;
    const row = res.rows[0];
    return {
      id: row.id,
      studentAcademicRecordId: row.student_academic_record_id,
      transactionType: row.transaction_type,
      amount: toDecimalInrString(Number(row.amount).toFixed(2)),
      currency: 'INR',
      method: row.method,
      transactionDate: row.transaction_date,
      payerName: row.payer_name,
      payerContact: row.payer_contact,
      referenceNumber: row.reference_number,
      notes: row.notes,
      reversesPaymentId: row.reverses_payment_id,
      idempotencyKey: row.idempotency_key,
      recordedBy: row.recorded_by,
      createdAt: row.created_at,
    };
  }

  async listPaymentsForRecord(studentAcademicRecordId: string, session: AuthenticatedUserSession): Promise<InternalPaymentRecord[]> {
    const res = await query(
      `select * from public.payments where student_academic_record_id = $1 order by created_at desc`,
      [studentAcademicRecordId],
      session
    );
    return res.rows.map((row) => ({
      id: row.id,
      studentAcademicRecordId: row.student_academic_record_id,
      transactionType: row.transaction_type,
      amount: toDecimalInrString(Number(row.amount).toFixed(2)),
      currency: 'INR',
      method: row.method,
      transactionDate: row.transaction_date,
      payerName: row.payer_name,
      payerContact: row.payer_contact,
      referenceNumber: row.reference_number,
      notes: row.notes,
      reversesPaymentId: row.reverses_payment_id,
      idempotencyKey: row.idempotency_key,
      recordedBy: row.recorded_by,
      createdAt: row.created_at,
    }));
  }

  async getAllAllocations(session: AuthenticatedUserSession): Promise<InternalPaymentAllocation[]> {
    const res = await query(
      `select * from public.payment_allocations order by created_at desc`,
      [],
      session
    );
    return res.rows.map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      studentFeeAssessmentLineId: row.student_fee_assessment_line_id,
      amount: toDecimalInrString(Number(row.amount).toFixed(2)),
      createdAt: row.created_at,
    }));
  }
}
