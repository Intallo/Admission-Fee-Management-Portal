import {
  ApproveFeeAdjustmentDTO,
  CreateFeeAdjustmentDTO,
  RecordPaymentRequestDTO,
  RecordPaymentResultDTO,
  ReversePaymentRequestDTO,
  ReversePaymentResultDTO,
  StudentFeeSummaryDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import { enforcePolicy } from '../../policy/guards';
import { IFeesLedgerRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';
import {
  InternalFeeAdjustment,
  InternalPaymentAllocation,
  InternalPaymentRecord,
} from '../../infrastructure/repositories/postgres/fees-ledger.repository';

export type {
  InternalFeeAdjustment,
  InternalPaymentAllocation,
  InternalPaymentRecord,
};

export class FeesLedgerService {
  private customRepo?: IFeesLedgerRepository;

  constructor(customRepo?: IFeesLedgerRepository) {
    this.customRepo = customRepo;
  }

  private get repo(): IFeesLedgerRepository {
    return this.customRepo ?? getRepositories().feesLedger;
  }

  resetForTesting(): void {
    if (this.repo.resetForTesting) {
      this.repo.resetForTesting();
    }
  }

  async getStudentDues(
    studentAcademicRecordId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StudentFeeSummaryDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');
    return this.repo.getStudentDuesSummary(studentAcademicRecordId, undefined, actorSession);
  }

  async getStudentDuesInternal(
    studentAcademicRecordId: string
  ): Promise<StudentFeeSummaryDTO> {
    return this.repo.getStudentDuesSummary(studentAcademicRecordId);
  }

  async recordOfflinePayment(
    payload: RecordPaymentRequestDTO,
    idempotencyKey: string | undefined,
    actorSession: AuthenticatedUserSession
  ): Promise<RecordPaymentResultDTO> {
    enforcePolicy(actorSession.role, 'fees:record_payment');
    return this.repo.recordPayment(payload, idempotencyKey, actorSession);
  }

  async approveFeeAdjustment(
    adjustmentId: string,
    payload: ApproveFeeAdjustmentDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    enforcePolicy(actorSession.role, 'fees:approve_concession');
    return this.repo.approveFeeAdjustment(adjustmentId, actorSession);
  }

  async requestFeeAdjustment(
    payload: CreateFeeAdjustmentDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    enforcePolicy(actorSession.role, 'fees:request_concession');
    return this.repo.requestAdjustment(payload, actorSession);
  }

  async reversePayment(
    paymentId: string,
    payload: ReversePaymentRequestDTO,
    idempotencyKey: string | undefined,
    actorSession: AuthenticatedUserSession
  ): Promise<ReversePaymentResultDTO> {
    enforcePolicy(actorSession.role, 'fees:approve_reversal');
    return this.repo.reversePayment(paymentId, payload.reason, actorSession);
  }

  getPaymentById(paymentId: string): any {
    if ((this.repo as any).getPaymentByIdSync) {
      return (this.repo as any).getPaymentByIdSync(paymentId);
    }
    return this.repo.getPaymentById(paymentId);
  }

  listPaymentsForRecord(studentAcademicRecordId: string): any {
    if ((this.repo as any).listPaymentsForRecordSync) {
      return (this.repo as any).listPaymentsForRecordSync(studentAcademicRecordId);
    }
    return this.repo.listPaymentsForRecord(studentAcademicRecordId);
  }

  getAllAllocations(): any {
    if ((this.repo as any).getAllAllocationsSync) {
      return (this.repo as any).getAllAllocationsSync();
    }
    return this.repo.getAllAllocations();
  }

  getAllPayments(): any {
    if ((this.repo as any).getAllPaymentsSync) {
      return (this.repo as any).getAllPaymentsSync();
    }
    return (this.repo as any).getAllPayments ? (this.repo as any).getAllPayments() : [];
  }
}

export const feesLedgerService = new FeesLedgerService();
