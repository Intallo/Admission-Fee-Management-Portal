/**
 * School Admission & Fee Management Portal
 * Module: Fees & Financial Ledger (Modules 5 & 6)
 */

import { UUID, DecimalInrString, IsoTimestampString, ReceiptNumber } from '../shared/types';
import { Database } from '../../types/database.types';
import { FeeCategory } from '../fee-configuration/types';

export type PaymentMethod = Database['public']['Enums']['payment_method']; // 'cash' | 'cheque' | 'bank_transfer' | 'upi_manual' | 'other'
export type PaymentKind = Database['public']['Enums']['payment_kind'];     // 'collection' | 'refund' | 'reversal'
export type AdjustmentKind = Database['public']['Enums']['adjustment_kind']; // 'concession' | 'additional_charge' | 'correction'
export type ApprovalState = Database['public']['Enums']['approval_state'];   // 'pending' | 'approved' | 'rejected'

export interface StudentFeeAssessmentLineDTO {
  id: UUID;
  feeHeadId: UUID;
  feeHeadName: string;
  category: FeeCategory;
  assessedAmount: DecimalInrString;
  approvedConcessionsAmount: DecimalInrString;
  collectedAmount: DecimalInrString;
  refundedReversedAmount: DecimalInrString;
  netRemainingDues: DecimalInrString;
}

export interface StudentFeeSummaryDTO {
  studentAcademicRecordId: UUID;
  studentName: string;
  admissionNumber: string;
  standard: string;
  totalAssessedInr: DecimalInrString;
  totalConcessionsInr: DecimalInrString;
  totalPaidInr: DecimalInrString;
  netBalanceDueInr: DecimalInrString;
  lines: StudentFeeAssessmentLineDTO[];
}

export interface PaymentAllocationInputDTO {
  assessmentLineId: UUID;
  amount: DecimalInrString;
}

export interface RecordPaymentRequestDTO {
  studentAcademicRecordId: UUID;
  category: FeeCategory; // All allocations must strictly belong to this category
  amount: DecimalInrString;
  method: PaymentMethod;
  payerName: string;
  referenceNumber?: string;
  remarks?: string;
  allocations: PaymentAllocationInputDTO[];
}

export interface RecordPaymentResultDTO {
  paymentId: UUID;
  receiptId: UUID;
  receiptNumber: ReceiptNumber;
  category: FeeCategory;
  amountInr: DecimalInrString;
  amountInWords: string;
  method: PaymentMethod;
  payerName: string;
  receivedAt: IsoTimestampString;
  renderedSnapshot: Record<string, unknown>;
}

export interface CreateFeeAdjustmentDTO {
  studentFeeAssessmentLineId: UUID;
  adjustmentType: AdjustmentKind;
  amount: DecimalInrString;
  reason: string;
}

export interface ApproveFeeAdjustmentDTO {
  approvalNotes?: string;
}

export interface ReversePaymentRequestDTO {
  reason: string; // Mandatory Principal explanation
}

export interface ReversePaymentResultDTO {
  reversalPaymentId: UUID;
  originalPaymentId: UUID;
  reversalAmountInr: DecimalInrString;
  reversedBy: UUID;
  reversedAt: IsoTimestampString;
  auditLogId: UUID;
}
