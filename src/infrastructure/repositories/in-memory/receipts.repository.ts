import { IReceiptsRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { receiptsService } from '../../../modules/receipts/service';

export class InMemoryReceiptsRepository implements IReceiptsRepository {
  resetForTesting(): void {
    receiptsService.resetForTesting();
  }

  async getNextReceiptNumber(series: string, _academicYearId?: string, _session?: AuthenticatedUserSession): Promise<any> {
    return receiptsService.getNextReceiptNumber(series);
  }

  async getReceiptById(receiptId: string, session?: AuthenticatedUserSession): Promise<any> {
    return receiptsService.getReceiptById(receiptId, session as any);
  }

  async getReceiptByPaymentId(paymentId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return receiptsService.getReceiptByPaymentId(paymentId);
  }

  async listReceiptsForRecord(studentAcademicRecordId: string, session?: AuthenticatedUserSession): Promise<any[]> {
    return receiptsService.listReceiptsForStudent(studentAcademicRecordId, session);
  }

  async createReceipt(receipt: any, _session?: AuthenticatedUserSession): Promise<any> {
    receiptsService.registerReceipt(receipt);
    return receipt;
  }

  async issueFinalReceipt(
    studentAcademicRecordId: string,
    _notes?: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return receiptsService.issueFinalFeesReceipt({ studentAcademicRecordId }, session as any);
  }

  async reprintReceipt(
    receiptId: string,
    _reason?: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return receiptsService.reprintReceipt(receiptId, session as any);
  }
}
