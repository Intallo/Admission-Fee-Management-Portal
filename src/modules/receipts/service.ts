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
  NotFoundError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { admissionsService } from '../admissions/service';
import { feesLedgerService } from '../fees-ledger/service';
import { academicYearsService } from '../academic-years/service';
import { generateReceiptPdf } from './pdf';
import { ReceiptNumber, toDecimalInrString } from '../shared/types';
import { IReceiptsRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';

export class ReceiptsService {
  private customRepo?: IReceiptsRepository;
  private receiptSeq = 1;

  constructor(customRepo?: IReceiptsRepository) {
    this.customRepo = customRepo;
  }

  private get repo(): IReceiptsRepository {
    return this.customRepo ?? getRepositories().receipts;
  }

  resetForTesting(): void {
    this.receiptSeq = 1;
    if (this.repo.resetForTesting) {
      this.repo.resetForTesting();
    }
  }

  getNextReceiptNumber(yearLabel: string): ReceiptNumber {
    const yearPrefix = yearLabel.slice(0, 4);
    const padded = String(this.receiptSeq++).padStart(6, '0');
    return `RCT-${yearPrefix}-${padded}` as ReceiptNumber;
  }

  registerReceipt(receipt: ReceiptDTO): void {
    if ((this.repo as any).registerReceipt) {
      (this.repo as any).registerReceipt(receipt);
    } else {
      this.repo.createReceipt(receipt).catch(() => {});
    }
  }

  unregisterReceipt(receiptId: string): void {
    if ((this.repo as any).unregisterReceipt) {
      (this.repo as any).unregisterReceipt(receiptId);
    }
  }

  async getReceiptById(
    receiptId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<ReceiptDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const receipt = await this.repo.getReceiptById(receiptId, actorSession);
    if (!receipt) {
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }

    return receipt;
  }

  async getReceiptByPaymentId(paymentId: string): Promise<ReceiptDTO | undefined> {
    return this.repo.getReceiptByPaymentId(paymentId);
  }

  async listReceiptsForStudent(
    studentAcademicRecordId: string,
    actorSession?: AuthenticatedUserSession
  ): Promise<ReceiptDTO[]> {
    if (actorSession) {
      enforcePolicy(actorSession.role, 'fees:view_dues');
    }

    return this.repo.listReceiptsForRecord(studentAcademicRecordId, actorSession);
  }

  async reprintReceipt(
    receiptId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<ReprintReceiptResultDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const result = await this.repo.reprintReceipt(receiptId, 'User requested reprint', actorSession);

    return {
      receiptId,
      receiptNumber: result.receipt.receiptNumber,
      reprintCount: result.reprintCount,
      isDuplicateWatermarkApplied: true,
      reprintedAt: new Date().toISOString(),
      pdfDownloadUrl: `/api/v1/receipts/${receiptId}/pdf`,
    };
  }

  async issueFinalFeesReceipt(
    payload: IssueFinalReceiptRequestDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<ConsolidatedReceiptDTO> {
    enforcePolicy(actorSession.role, 'fees:record_payment');

    return this.repo.issueFinalReceipt(
      payload.studentAcademicRecordId,
      undefined,
      actorSession
    );
  }

  async getStatementOfAccount(
    studentAcademicRecordId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StatementOfAccountDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');

    const duesSummary = await feesLedgerService.getStudentDues(
      studentAcademicRecordId,
      actorSession
    );
    const academicRecord = await admissionsService.getAcademicRecordAsync(studentAcademicRecordId, actorSession);
    if (!academicRecord) {
      throw new NotFoundError(
        `Student academic record with ID "${studentAcademicRecordId}" not found.`
      );
    }

    const academicYear = await academicYearsService
      .getAcademicYearById(academicRecord.academicYearId)
      .catch(() => null);
    const academicYearLabel = academicYear?.label || '2026-2027';

    const studentPayments = await feesLedgerService.listPaymentsForRecord(studentAcademicRecordId);

    const paymentHistory: Array<{
      receiptNumber: ReceiptNumber;
      date: string;
      amountInr: string;
      method: string;
    }> = [];

    const paymentsList = Array.isArray(studentPayments) ? studentPayments : [];
    for (const payment of paymentsList) {
      if (payment.transactionType === 'collection') {
        const receipt = await this.getReceiptByPaymentId(payment.id);
        if (receipt) {
          paymentHistory.push({
            receiptNumber: receipt.receiptNumber,
            date: (payment.transactionDate || '').slice(0, 10),
            amountInr: payment.amount,
            method: (payment.method || '').toUpperCase(),
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

  async getReceiptPdfBuffer(receiptId: string, isDuplicate = false): Promise<Buffer> {
    const receipt = await this.repo.getReceiptById(receiptId);
    if (!receipt) {
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }

    return generateReceiptPdf(receipt.renderedSnapshot, {
      isDuplicate,
      duplicateCount: receipt.reprintCount,
    });
  }

  getAllReceipts(): ReceiptDTO[] {
    return [];
  }

  getAllConsolidatedReceipts(): ConsolidatedReceiptDTO[] {
    return [];
  }
}

export const receiptsService = new ReceiptsService();
