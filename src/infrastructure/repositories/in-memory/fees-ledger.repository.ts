import { IFeesLedgerRepository } from '../interfaces';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { feesLedgerService } from '../../../modules/fees-ledger/service';

export class InMemoryFeesLedgerRepository implements IFeesLedgerRepository {
  resetForTesting(): void {
    feesLedgerService.resetForTesting();
  }

  async getStudentDuesSummary(
    studentAcademicRecordId: string,
    _academicYearId?: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    if (session) {
      return feesLedgerService.getStudentDues(studentAcademicRecordId, session);
    }
    return feesLedgerService.getStudentDuesInternal(studentAcademicRecordId);
  }

  async recordOfflinePayment(
    params: any,
    idempotencyKey?: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return feesLedgerService.recordOfflinePayment(params, idempotencyKey, session as any);
  }

  async requestAdjustment(
    params: any,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return feesLedgerService.requestFeeAdjustment(params, session as any);
  }

  async approveFeeAdjustment(
    adjustmentId: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return feesLedgerService.approveFeeAdjustment(adjustmentId, {}, session as any);
  }

  async reversePayment(
    paymentId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any> {
    return feesLedgerService.reversePayment(paymentId, { reason }, undefined, session as any);
  }

  async getPaymentById(paymentId: string, _session?: AuthenticatedUserSession): Promise<any> {
    return feesLedgerService.getPaymentById(paymentId);
  }

  async listPaymentsForRecord(studentAcademicRecordId: string, _session?: AuthenticatedUserSession): Promise<any[]> {
    return feesLedgerService.listPaymentsForRecord(studentAcademicRecordId);
  }

  async getAllAllocations(_session?: AuthenticatedUserSession): Promise<any[]> {
    return feesLedgerService.getAllAllocations();
  }
}
