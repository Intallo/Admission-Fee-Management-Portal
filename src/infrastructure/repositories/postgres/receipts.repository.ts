import { IReceiptsRepository } from '../interfaces';
import { withTransaction, query } from '../../db/postgres-pool';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  ConsolidatedReceiptDTO,
  ReceiptDTO,
  RenderedReceiptSnapshotDTO,
} from '../../../modules/receipts/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../../lib/errors';
import { randomUUID } from 'crypto';
import { ReceiptNumber, toDecimalInrString } from '../../../modules/shared/types';
import { addInr, amountInWordsInr, formatInr, subtractInr } from '../../../lib/money/inr';

export class PostgresReceiptsRepository implements IReceiptsRepository {
  async getNextReceiptNumber(
    series: string,
    academicYearId: string,
    session: AuthenticatedUserSession
  ): Promise<ReceiptNumber> {
    const res = await query(
      `select private.next_receipt_number($1) as num`,
      [series || 'RCT'],
      session
    );
    return res.rows[0].num as ReceiptNumber;
  }

  async getReceiptById(
    receiptId: string,
    session: AuthenticatedUserSession
  ): Promise<ReceiptDTO | undefined> {
    const res = await query(
      `select r.*, p.amount as payment_amount, p.payer_name, p.method as payment_method, p.reference_number
       from public.receipts r
       join public.payments p on p.id = r.payment_id
       where r.id = $1`,
      [receiptId],
      session
    );

    if (res.rowCount === 0) return undefined;
    const row = res.rows[0];
    const snapshot = typeof row.rendered_snapshot === 'string'
      ? JSON.parse(row.rendered_snapshot)
      : row.rendered_snapshot;

    return {
      id: row.id,
      paymentId: row.payment_id,
      receiptNumber: row.receipt_number,
      category: row.category,
      reprintCount: row.reprint_count || 0,
      lastReprintedAt: row.last_reprinted_at,
      renderedSnapshot: snapshot,
      createdAt: row.created_at,
    };
  }

  async getReceiptByPaymentId(
    paymentId: string,
    session: AuthenticatedUserSession
  ): Promise<ReceiptDTO | undefined> {
    const res = await query(
      `select * from public.receipts where payment_id = $1`,
      [paymentId],
      session
    );

    if (res.rowCount === 0) return undefined;
    const row = res.rows[0];
    const snapshot = typeof row.rendered_snapshot === 'string'
      ? JSON.parse(row.rendered_snapshot)
      : row.rendered_snapshot;

    return {
      id: row.id,
      paymentId: row.payment_id,
      receiptNumber: row.receipt_number,
      category: row.category,
      reprintCount: row.reprint_count || 0,
      lastReprintedAt: row.last_reprinted_at,
      renderedSnapshot: snapshot,
      createdAt: row.created_at,
    };
  }

  async listReceiptsForRecord(
    studentAcademicRecordId: string,
    session: AuthenticatedUserSession
  ): Promise<ReceiptDTO[]> {
    const res = await query(
      `select * from public.receipts
       where student_academic_record_id = $1
       order by created_at desc`,
      [studentAcademicRecordId],
      session
    );

    return res.rows.map((row) => {
      const snapshot = typeof row.rendered_snapshot === 'string'
        ? JSON.parse(row.rendered_snapshot)
        : row.rendered_snapshot;

      return {
        id: row.id,
        paymentId: row.payment_id,
        receiptNumber: row.receipt_number,
        category: row.category,
        reprintCount: row.reprint_count || 0,
        lastReprintedAt: row.last_reprinted_at,
        renderedSnapshot: snapshot,
        createdAt: row.created_at,
      };
    });
  }

  async createReceipt(
    receipt: ReceiptDTO,
    session: AuthenticatedUserSession
  ): Promise<ReceiptDTO> {
    await query(
      `insert into public.receipts (
         id, receipt_number, payment_id, category,
         rendered_snapshot, template_version, reprint_count, created_at
       ) values ($1, $2, $3, $4, $5, 'v1.0', $6, $7)`,
      [
        receipt.id,
        receipt.receiptNumber,
        receipt.paymentId,
        receipt.category,
        JSON.stringify(receipt.renderedSnapshot),
        receipt.reprintCount,
        receipt.createdAt,
      ],
      session
    );
    return receipt;
  }

  async issueFinalReceipt(
    studentAcademicRecordId: string,
    notes: string | undefined,
    session: AuthenticatedUserSession
  ): Promise<ConsolidatedReceiptDTO> {
    return withTransaction(session, async (client) => {
      // 1. Fetch student info
      const sRes = await client.query(
        `select r.id, r.admission_number, r.academic_year_id,
                s.first_name, s.last_name, g.name as grade_name, sec.name as section_name,
                y.label as year_label
         from public.student_academic_records r
         join public.students s on s.id = r.student_id
         join public.grade_levels g on g.id = r.grade_level_id
         left join public.sections sec on sec.id = r.section_id
         join public.academic_years y on y.id = r.academic_year_id
         where r.id = $1`,
        [studentAcademicRecordId]
      );

      if (sRes.rowCount === 0) {
        throw new NotFoundError(`Student academic record "${studentAcademicRecordId}" not found.`);
      }

      const st = sRes.rows[0];

      // 2. Fetch all prior receipts
      const recRes = await client.query(
        `select r.id as receipt_id, r.receipt_number, r.category, p.amount, r.created_at
         from public.receipts r
         join public.payments p on p.id = r.payment_id
         where r.student_academic_record_id = $1
         order by r.created_at asc`,
        [studentAcademicRecordId]
      );

      let total = '0.00';
      const priorItems: Array<{
        receiptId: any;
        receiptNumber: ReceiptNumber;
        amountInr: any;
      }> = [];

      for (const row of recRes.rows) {
        const amt = Number(row.amount).toFixed(2);
        total = addInr(total, amt);
        priorItems.push({
          receiptId: row.receipt_id,
          receiptNumber: row.receipt_number as ReceiptNumber,
          amountInr: toDecimalInrString(amt),
        });
      }

      // 3. Monotonic receipt number
      const numRes = await client.query(`select private.next_receipt_number('RCT') as num`);
      const finalNumber = numRes.rows[0].num as ReceiptNumber;

      const finalId = randomUUID();
      const nowIso = new Date().toISOString();

      const signatories = {
        payerSignatureLine: 'Payer Signature',
        cashierSignatureLine: session.fullName || 'Cashier / Accounts Officer',
        managerSignatureLine: 'Manager / Principal',
      };

      const renderedSnapshot: RenderedReceiptSnapshotDTO = {
        schoolName: 'ABC English Medium School',
        receiptNumber: finalNumber,
        receiptType: 'final_consolidated',
        studentName: `${st.first_name} ${st.last_name}`,
        admissionNumber: st.admission_number,
        standard: st.grade_name,
        section: st.section_name || 'A',
        academicYear: st.year_label,
        paymentMethod: 'Consolidated Payments',
        payerName: 'Parent / Guardian',
        paymentDate: nowIso.slice(0, 10),
        totalAmountInr: toDecimalInrString(total),
        totalAmountInWords: amountInWordsInr(total),
        itemizedAllocations: priorItems.map((r) => ({
          feeHeadName: `Receipt ${r.receiptNumber}`,
          amountInr: r.amountInr,
        })),
        signatories,
      };

      await client.query(
        `insert into public.receipts (
           id, receipt_number, student_academic_record_id, category,
           rendered_snapshot, template_version, reprint_count, issued_at, issued_by, created_at
         ) values ($1, $2, $3, 'school_fee', $4, 'v1.0', 0, $5, $6, $7)`,
        [
          finalId,
          finalNumber,
          studentAcademicRecordId,
          JSON.stringify(renderedSnapshot),
          nowIso,
          session.staffId,
          nowIso,
        ]
      );

      return {
        id: finalId,
        studentAcademicRecordId,
        receiptNumber: finalNumber,
        totalAmountInr: toDecimalInrString(total),
        totalAmountInWords: amountInWordsInr(total),
        reprintCount: 0,
        lastReprintedAt: null,
        renderedSnapshot,
        itemizedPriorReceipts: priorItems,
        createdAt: nowIso,
      };
    });
  }

  async reprintReceipt(
    receiptId: string,
    reason: string,
    session: AuthenticatedUserSession
  ): Promise<{ receipt: ReceiptDTO | ConsolidatedReceiptDTO; isDuplicate: boolean; reprintCount: number }> {
    return withTransaction(session, async (client) => {
      const recRes = await client.query(
        `select * from public.receipts where id = $1`,
        [receiptId]
      );

      if ((recRes.rowCount ?? 0) === 0) {
        throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
      }

      const rec = recRes.rows[0];
      const nextCount = (rec.reprint_count || 0) + 1;
      const nowIso = new Date().toISOString();

      await client.query(
        `update public.receipts
         set reprint_count = $1, last_reprinted_at = $2
         where id = $3`,
        [nextCount, nowIso, receiptId]
      );

      const snapshot = typeof rec.rendered_snapshot === 'string'
        ? JSON.parse(rec.rendered_snapshot)
        : rec.rendered_snapshot;

      const receiptDto: ReceiptDTO = {
        id: rec.id,
        paymentId: rec.payment_id,
        receiptNumber: rec.receipt_number,
        category: rec.category,
        reprintCount: nextCount,
        lastReprintedAt: nowIso,
        renderedSnapshot: snapshot,
        createdAt: rec.created_at,
      };

      return {
        receipt: receiptDto,
        isDuplicate: true,
        reprintCount: nextCount,
      };
    });
  }
}
