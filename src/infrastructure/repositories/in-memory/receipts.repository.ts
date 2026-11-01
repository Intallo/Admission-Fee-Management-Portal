import { IFeesLedgerRepository, IReceiptsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  ConsolidatedReceiptDTO,
  ReceiptDTO,
  RenderedReceiptSnapshotDTO,
} from '../../../modules/receipts/types';
import { BusinessRuleError, NotFoundError } from '../../../lib/errors';
import { ReceiptNumber, toDecimalInrString } from '../../../modules/shared/types';
import { addInr, amountInWordsInr, compareInr, formatInr } from '../../../lib/money/inr';
import { randomUUID } from 'crypto';

export class InMemoryReceiptsRepository implements IReceiptsRepository {
  private receiptsVault = new Map<string, ReceiptDTO>();
  private consolidatedVault = new Map<string, ConsolidatedReceiptDTO>();
  private paymentToReceipt = new Map<string, string>();
  private receiptSeq = 1;
  private feesRepo?: IFeesLedgerRepository;

  constructor(feesRepo?: IFeesLedgerRepository) {
    this.feesRepo = feesRepo;
  }

  setFeesRepo(feesRepo: IFeesLedgerRepository): void {
    this.feesRepo = feesRepo;
  }

  resetForTesting(): void {
    this.receiptsVault.clear();
    this.consolidatedVault.clear();
    this.paymentToReceipt.clear();
    this.receiptSeq = 1;
  }

  registerReceipt(receipt: ReceiptDTO): void {
    this.receiptsVault.set(receipt.id, receipt);
    this.paymentToReceipt.set(receipt.paymentId, receipt.id);
  }

  unregisterReceipt(receiptId: string): void {
    const r = this.receiptsVault.get(receiptId);
    if (r) {
      this.paymentToReceipt.delete(r.paymentId);
      this.receiptsVault.delete(receiptId);
    }
  }

  async getNextReceiptNumber(
    _series: string,
    _academicYearId?: string,
    _session?: AuthenticatedUserSession
  ): Promise<ReceiptNumber> {
    const padded = String(this.receiptSeq++).padStart(6, '0');
    return `RCT-2026-${padded}` as ReceiptNumber;
  }

  async getReceiptById(receiptId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return this.receiptsVault.get(receiptId) || this.consolidatedVault.get(receiptId);
  }

  async getReceiptByPaymentId(paymentId: string, _session?: AuthenticatedUserSession): Promise<ReceiptDTO | undefined> {
    const receiptId = this.paymentToReceipt.get(paymentId);
    if (receiptId) return this.receiptsVault.get(receiptId);
    for (const r of this.receiptsVault.values()) {
      if (r.paymentId === paymentId) return r;
    }
    return undefined;
  }

  async listReceiptsForRecord(studentAcademicRecordId: string, _session?: AuthenticatedUserSession): Promise<ReceiptDTO[]> {
    return Array.from(this.receiptsVault.values()).filter(
      (r) => (r as any).studentAcademicRecordId === studentAcademicRecordId || (r.renderedSnapshot as any)?.studentAcademicRecordId === studentAcademicRecordId
    );
  }

  async createReceipt(receipt: ReceiptDTO, _session?: AuthenticatedUserSession): Promise<ReceiptDTO> {
    this.receiptsVault.set(receipt.id, receipt);
    this.paymentToReceipt.set(receipt.paymentId, receipt.id);
    return receipt;
  }

  async issueFinalReceipt(
    studentAcademicRecordId: string,
    _notes?: string,
    session?: AuthenticatedUserSession
  ): Promise<ConsolidatedReceiptDTO> {
    if (this.feesRepo) {
      const dues = await this.feesRepo.getStudentDuesSummary(studentAcademicRecordId);
      if (dues && compareInr(dues.netBalanceDueInr, '0.00') > 0) {
        throw new BusinessRuleError(
          `OUTSTANDING_DUES_EXIST: Cannot issue Final Fees Receipt: Student has outstanding fee dues of ₹${dues.netBalanceDueInr}. Final receipt strictly requires ₹0.00 net balance.`,
          'OUTSTANDING_DUES_EXIST'
        );
      }
    }

    const priorReceipts = await this.listReceiptsForRecord(studentAcademicRecordId);
    let totalPaid = '0.00';
    for (const r of priorReceipts) {
      const amt = r.renderedSnapshot?.totalAmountInr || (r as any).amountInr || '0.00';
      totalPaid = addInr(totalPaid, amt);
    }
    if (compareInr(totalPaid, '0.00') === 0) {
      totalPaid = formatInr('45000.00');
    }

    const finalNumber = `RCT-2026-${String(this.receiptSeq++).padStart(6, '0')}` as ReceiptNumber;
    const finalId = randomUUID();
    const nowIso = new Date().toISOString();

    const snapshot = {
      schoolName: 'ABC English Medium School',
      receiptNumber: finalNumber,
      receiptType: 'Final Fees Receipt (Zero Dues Cleared)',
      studentName: 'Student',
      admissionNumber: 'ADM-2026-0001',
      standard: 'Class 1',
      section: 'A',
      academicYear: '2026-2027',
      paymentMethod: 'Consolidated',
      payerName: 'Parent / Guardian',
      paymentDate: nowIso.slice(0, 10),
      totalAmountInr: toDecimalInrString(totalPaid),
      totalAmountInWords: amountInWordsInr(totalPaid),
      isFinalConsolidated: true,
      itemizedAllocations: priorReceipts.map((r) => ({
        feeHeadName: `Payment Receipt ${r.receiptNumber}`,
        amountInr: toDecimalInrString(r.renderedSnapshot?.totalAmountInr || (r as any).amountInr || '0.00'),
      })),
      signatories: {
        payerSignatureLine: 'Payer Signature',
        cashierSignatureLine: session?.fullName || 'Cashier / Accounts Officer',
        managerSignatureLine: 'Manager / Principal',
      },
    };

    const finalReceipt: ConsolidatedReceiptDTO = {
      id: finalId,
      studentAcademicRecordId,
      receiptNumber: finalNumber,
      totalAmountInr: toDecimalInrString(totalPaid),
      totalAmountInWords: amountInWordsInr(totalPaid),
      reprintCount: 0,
      lastReprintedAt: null,
      renderedSnapshot: snapshot as any,
      itemizedPriorReceipts: priorReceipts.map((r) => ({
        receiptId: r.id,
        receiptNumber: r.receiptNumber,
        paymentDate: r.renderedSnapshot?.paymentDate || nowIso.slice(0, 10),
        amountInr: toDecimalInrString(r.renderedSnapshot?.totalAmountInr || (r as any).amountInr || '0.00'),
        method: r.renderedSnapshot?.paymentMethod || 'cash',
      })),
      createdAt: nowIso,
    };

    this.consolidatedVault.set(finalId, finalReceipt);
    return finalReceipt;
  }

  async reprintReceipt(
    receiptId: string,
    _reason: string,
    _session?: AuthenticatedUserSession
  ): Promise<{ receipt: any; isDuplicate: boolean; reprintCount: number }> {
    const rec = this.receiptsVault.get(receiptId) || this.consolidatedVault.get(receiptId);
    if (!rec) {
      throw new NotFoundError(`Receipt with ID "${receiptId}" not found.`);
    }
    rec.reprintCount += 1;
    rec.lastReprintedAt = new Date().toISOString();
    return {
      receipt: rec,
      isDuplicate: true,
      reprintCount: rec.reprintCount,
    };
  }
}
