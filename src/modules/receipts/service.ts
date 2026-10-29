import { randomUUID } from 'crypto';
import {
  ConsolidatedReceiptDTO,
  IssueFinalReceiptRequestDTO,
  ReceiptDTO,
  RenderedReceiptSnapshotDTO,
  ReprintReceiptResultDTO,
  StatementOfAccountDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { admissionsService } from '../admissions/service';
import { feesLedgerService } from '../fees-ledger/service';
import { academicYearsService } from '../academic-years/service';
import { generateReceiptPdf } from './pdf';
import { logger } from '../../lib/logger';
import { ReceiptNumber, toDecimalInrString } from '../shared/types';
import { addInr, amountInWordsInr, compareInr, formatInr } from '../../lib/money/inr';

// In-memory vaults for receipts
let receiptsVault = new Map<string, ReceiptDTO>(); // receiptId -> ReceiptDTO
let paymentToReceiptMap = new Map<string, string>(); // paymentId -> receiptId
let consolidatedReceiptsVault = new Map<string, ConsolidatedReceiptDTO>(); // consolidatedReceiptId -> ConsolidatedReceiptDTO
let receiptCountersVault = new Map<string, number>(); // yearPrefix -> nextCounter

export class ReceiptsService {
  /**
   * Resets receipt vaults for testing.
   */
  resetForTesting(): void {
    receiptsVault.clear();
    paymentToReceiptMap.clear();
    consolidatedReceiptsVault.clear();
    receiptCountersVault.clear();
  }

  /**
   * Generates the next sequential monotonic receipt number: RCT-YYYY-NNNNNN (6 zero-padded digits).
   * Shared monotonic series across individual and final consolidated receipts (SBR-07, US-27 AC2).
   */
  getNextReceiptNumber(yearLabel: string): ReceiptNumber {
    const yearPrefix = yearLabel.slice(0, 4);
    const current = receiptCountersVault.get(yearPrefix) || 1;
    receiptCountersVault.set(yearPrefix, current + 1);

    const padded = String(current).padStart(6, '0');
    return `RCT-${yearPrefix}-${padded}` as ReceiptNumber;
  }

  /**
   * Registers a newly generated receipt into the vault.
   */
  registerReceipt(receipt: ReceiptDTO): void {
    receiptsVault.set(receipt.id, receipt);
    paymentToReceiptMap.set(receipt.paymentId, receipt.id);
  }

  /**
   * Removes a receipt in case of transaction rollback.
   */
  unregisterReceipt(receiptId: string): void {
    const r = receiptsVault.get(receiptId);
    if (r) {
      paymentToReceiptMap.delete(r.paymentId);
      receiptsVault.delete(receiptId);
    }
  }

  /**
   * Retrieves a receipt by its unique ID.
   */
  async getReceiptById(
    receiptId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<ReceiptDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const receipt = receiptsVault.get(receiptId);
    if (!receipt) {
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }

    return receipt;
  }

  /**
   * Retrieves a receipt by its payment ID.
   */
  async getReceiptByPaymentId(paymentId: string): Promise<ReceiptDTO | undefined> {
    const receiptId = paymentToReceiptMap.get(paymentId);
    if (!receiptId) return undefined;
    return receiptsVault.get(receiptId);
  }

  /**
   * Retrieves all receipts issued for a student academic record.
   */
  async listReceiptsForStudent(
    studentAcademicRecordId: string,
    actorSession?: AuthenticatedUserSession
  ): Promise<ReceiptDTO[]> {
    if (actorSession) {
      enforcePolicy(actorSession.role, 'fees:view_dues');
    }

    const studentPayments = feesLedgerService.listPaymentsForRecord(studentAcademicRecordId);
    const paymentIds = new Set(studentPayments.map((p) => p.id));

    const results: ReceiptDTO[] = [];
    for (const receipt of receiptsVault.values()) {
      if (paymentIds.has(receipt.paymentId)) {
        results.push(receipt);
      }
    }

    return results;
  }

  /**
   * Reprints a receipt, incrementing duplicate count and applying the duplicate watermark.
   * SRS Reference: US-27 AC4.
   */
  async reprintReceipt(
    receiptId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<ReprintReceiptResultDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const receipt = receiptsVault.get(receiptId);
    if (!receipt) {
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }

    const nowIso = new Date().toISOString();
    receipt.reprintCount += 1;
    receipt.lastReprintedAt = nowIso;
    receiptsVault.set(receiptId, receipt);

    logger.info('Receipt reprinted with DUPLICATE stamp', {
      receiptId,
      receiptNumber: receipt.receiptNumber,
      reprintCount: receipt.reprintCount,
      actorStaffId: actorSession.staffId,
    });

    return {
      receiptId,
      receiptNumber: receipt.receiptNumber,
      reprintCount: receipt.reprintCount,
      isDuplicateWatermarkApplied: true,
      reprintedAt: nowIso,
      pdfDownloadUrl: `/api/v1/receipts/${receiptId}/pdf`,
    };
  }

  /**
   * Issues the Final Fees Receipt strictly when net dues equal ₹0.00 across all fee heads.
   * Operation 6: issue_final_receipt_atomic (US-28, BR-25, BR-26, BR-46, BR-47, SBR-08)
   */
  async issueFinalFeesReceipt(
    payload: IssueFinalReceiptRequestDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<ConsolidatedReceiptDTO> {
    enforcePolicy(actorSession.role, 'fees:record_payment');

    const academicRecord = admissionsService.getAcademicRecord(payload.studentAcademicRecordId);
    if (!academicRecord) {
      throw new NotFoundError(
        `Student academic record with ID "${payload.studentAcademicRecordId}" not found.`
      );
    }

    // 1. Verify that net dues across ALL fee heads equal ₹0.00 exactly (SBR-08)
    const duesSummary = await feesLedgerService.getStudentDues(
      payload.studentAcademicRecordId,
      actorSession
    );

    if (compareInr(duesSummary.netBalanceDueInr, '0.00') > 0) {
      throw new BusinessRuleError(
        `OUTSTANDING_DUES_EXIST: Cannot issue Final Fees Receipt: Student has outstanding fee balance of ₹${duesSummary.netBalanceDueInr}. A Final Fees Receipt requires ₹0.00 net dues. An unnumbered Statement of Account is available.`,
        'OUTSTANDING_DUES_EXIST'
      );
    }

    // 2. Gather all prior individual payment receipts for this student
    const studentPayments = feesLedgerService.listPaymentsForRecord(
      payload.studentAcademicRecordId
    );
    const collectionPayments = studentPayments.filter((p) => p.transactionType === 'collection');

    const itemizedPriorReceipts: Array<{
      receiptId: string;
      receiptNumber: ReceiptNumber;
      amountInr: string;
    }> = [];

    let totalAmount = '0.00';

    for (const payment of collectionPayments) {
      const receipt = await this.getReceiptByPaymentId(payment.id);
      if (receipt) {
        itemizedPriorReceipts.push({
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          amountInr: payment.amount,
        });
        totalAmount = addInr(totalAmount, payment.amount);
      }
    }

    // 3. Allocate monotonic receipt number from the unified sequence (RCT-YYYY-NNNNNN)
    const academicYear = await academicYearsService
      .getAcademicYearById(academicRecord.academicYearId)
      .catch(() => null);
    const academicYearLabel = academicYear?.label || '2026-2027';
    const finalReceiptNumber = this.getNextReceiptNumber(academicYearLabel);

    const consolidatedReceiptId = randomUUID();
    const nowIso = new Date().toISOString();

    const student = admissionsService.getStudentById(academicRecord.studentId);
    const grade = admissionsService.getGradeLevel(academicRecord.gradeLevelId);
    const section = admissionsService.getSection(academicRecord.sectionId);

    const renderedSnapshot: RenderedReceiptSnapshotDTO = {
      schoolName: 'ABC English Medium School',
      receiptNumber: finalReceiptNumber,
      receiptType: 'final_consolidated',
      studentName: student ? `${student.firstName} ${student.lastName}` : 'Student Name',
      admissionNumber: academicRecord.admissionNumber,
      standard: grade?.name || 'Class',
      section: section?.name || 'A',
      academicYear: academicYearLabel,
      paymentMethod: 'Consolidated Payments',
      payerName: 'Parent / Guardian',
      paymentDate: nowIso.slice(0, 10),
      totalAmountInr: toDecimalInrString(totalAmount),
      totalAmountInWords: amountInWordsInr(totalAmount),
      itemizedAllocations: itemizedPriorReceipts.map((r) => ({
        feeHeadName: `Payment Receipt ${r.receiptNumber}`,
        amountInr: toDecimalInrString(r.amountInr),
      })),
      signatories: {
        payerSignatureLine: 'Payer Signature',
        cashierSignatureLine: actorSession.fullName || 'Cashier / Accounts Officer',
        managerSignatureLine: 'Manager / Principal',
      },
    };

    const finalReceipt: ConsolidatedReceiptDTO = {
      id: consolidatedReceiptId,
      studentAcademicRecordId: payload.studentAcademicRecordId,
      receiptNumber: finalReceiptNumber,
      totalAmountInr: toDecimalInrString(totalAmount),
      totalAmountInWords: amountInWordsInr(totalAmount),
      reprintCount: 0,
      lastReprintedAt: null,
      renderedSnapshot,
      itemizedPriorReceipts: itemizedPriorReceipts.map((r) => ({
        ...r,
        amountInr: toDecimalInrString(r.amountInr),
      })),
      createdAt: nowIso,
    };

    consolidatedReceiptsVault.set(consolidatedReceiptId, finalReceipt);

    logger.info('Final Fees Receipt atomically issued at ₹0.00 net dues', {
      consolidatedReceiptId,
      receiptNumber: finalReceiptNumber,
      studentAcademicRecordId: payload.studentAcademicRecordId,
      totalPaidInr: totalAmount,
      actorStaffId: actorSession.staffId,
    });

    return finalReceipt;
  }

  /**
   * Generates an unnumbered Statement of Account available at any time.
   * SRS Reference: US-28, SBR-08. Strictly unnumbered.
   */
  async getStatementOfAccount(
    studentAcademicRecordId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StatementOfAccountDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const duesSummary = await feesLedgerService.getStudentDues(
      studentAcademicRecordId,
      actorSession
    );
    const academicRecord = admissionsService.getAcademicRecord(studentAcademicRecordId);
    if (!academicRecord) {
      throw new NotFoundError(
        `Student academic record with ID "${studentAcademicRecordId}" not found.`
      );
    }

    const academicYear = await academicYearsService
      .getAcademicYearById(academicRecord.academicYearId)
      .catch(() => null);
    const academicYearLabel = academicYear?.label || '2026-2027';

    const studentPayments = feesLedgerService.listPaymentsForRecord(studentAcademicRecordId);

    const paymentHistory: Array<{
      receiptNumber: ReceiptNumber;
      date: string;
      amountInr: string;
      method: string;
    }> = [];

    for (const payment of studentPayments) {
      if (payment.transactionType === 'collection') {
        const receipt = await this.getReceiptByPaymentId(payment.id);
        if (receipt) {
          paymentHistory.push({
            receiptNumber: receipt.receiptNumber,
            date: payment.transactionDate.slice(0, 10),
            amountInr: payment.amount,
            method: payment.method.toUpperCase(),
          });
        }
      }
    }

    return {
      studentName: duesSummary.studentName,
      admissionNumber: duesSummary.admissionNumber,
      standard: duesSummary.standard,
      academicYear: academicYearLabel,
      generatedAt: new Date().toISOString(),
      totalAssessedInr: duesSummary.totalAssessedInr,
      totalConcessionsInr: duesSummary.totalConcessionsInr,
      totalPaidInr: duesSummary.totalPaidInr,
      netOutstandingDuesInr: duesSummary.netBalanceDueInr,
      assessments: duesSummary.lines.map((l) => ({
        headName: l.feeHeadName,
        category: l.category,
        assessedInr: l.assessedAmount,
        concessionInr: l.approvedConcessionsAmount,
        paidInr: l.collectedAmount,
        balanceInr: l.netRemainingDues,
      })),
      paymentHistory: paymentHistory.map((h) => ({
        ...h,
        amountInr: toDecimalInrString(h.amountInr),
      })),
    };
  }

  /**
   * Generates a PDF buffer for a receipt.
   */
  async getReceiptPdfBuffer(receiptId: string, isDuplicate = false): Promise<Buffer> {
    const receipt = receiptsVault.get(receiptId);
    if (!receipt) {
      // Check if consolidated
      const cons = consolidatedReceiptsVault.get(receiptId);
      if (cons) {
        return generateReceiptPdf(cons.renderedSnapshot, {
          isDuplicate,
          duplicateCount: cons.reprintCount,
        });
      }
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }

    return generateReceiptPdf(receipt.renderedSnapshot, {
      isDuplicate,
      duplicateCount: receipt.reprintCount,
    });
  }

  // --- Queries ---

  getAllReceipts(): ReceiptDTO[] {
    return Array.from(receiptsVault.values());
  }

  getAllConsolidatedReceipts(): ConsolidatedReceiptDTO[] {
    return Array.from(consolidatedReceiptsVault.values());
  }
}

export const receiptsService = new ReceiptsService();
