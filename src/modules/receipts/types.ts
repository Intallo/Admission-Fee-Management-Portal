/**
 * School Admission & Fee Management Portal
 * Module: Receipts & Financial Statements (Module 7)
 */

import { UUID, DecimalInrString, IsoTimestampString, ReceiptNumber } from '../shared/types';
import { FeeCategory } from '../fee-configuration/types';

export interface ReceiptSnapshotSignatories {
  payerSignatureLine: string;
  cashierSignatureLine: string;
  managerSignatureLine: string; // Manager represents Principal
}

export interface RenderedReceiptSnapshotDTO {
  schoolName: string;
  receiptNumber: ReceiptNumber;
  receiptType: FeeCategory | 'final_consolidated';
  studentName: string;
  admissionNumber: string;
  standard: string;
  section: string;
  academicYear: string;
  paymentMethod: string;
  payerName: string;
  paymentDate: string;
  totalAmountInr: DecimalInrString;
  totalAmountInWords: string;
  itemizedAllocations: Array<{
    feeHeadName: string;
    amountInr: DecimalInrString;
  }>;
  signatories: ReceiptSnapshotSignatories;
}

export interface ReceiptDTO {
  id: UUID;
  paymentId: UUID;
  receiptNumber: ReceiptNumber;
  category: FeeCategory;
  reprintCount: number;
  lastReprintedAt: IsoTimestampString | null;
  renderedSnapshot: RenderedReceiptSnapshotDTO;
  createdAt: IsoTimestampString;
}

export interface IssueFinalReceiptRequestDTO {
  studentAcademicRecordId: UUID;
}

export interface ConsolidatedReceiptDTO {
  id: UUID;
  studentAcademicRecordId: UUID;
  receiptNumber: ReceiptNumber;
  totalAmountInr: DecimalInrString;
  totalAmountInWords: string;
  reprintCount: number;
  lastReprintedAt: IsoTimestampString | null;
  renderedSnapshot: RenderedReceiptSnapshotDTO;
  itemizedPriorReceipts: Array<{
    receiptId: UUID;
    receiptNumber: ReceiptNumber;
    amountInr: DecimalInrString;
  }>;
  createdAt: IsoTimestampString;
}

export interface StatementOfAccountDTO {
  studentName: string;
  admissionNumber: string;
  standard: string;
  academicYear: string;
  generatedAt: IsoTimestampString;
  totalAssessedInr: DecimalInrString;
  totalConcessionsInr: DecimalInrString;
  totalPaidInr: DecimalInrString;
  netOutstandingDuesInr: DecimalInrString;
  assessments: Array<{
    headName: string;
    category: FeeCategory;
    assessedInr: DecimalInrString;
    concessionInr: DecimalInrString;
    paidInr: DecimalInrString;
    balanceInr: DecimalInrString;
  }>;
  paymentHistory: Array<{
    receiptNumber: ReceiptNumber;
    date: string;
    amountInr: DecimalInrString;
    method: string;
  }>;
}

export interface ReprintReceiptResultDTO {
  receiptId: UUID;
  receiptNumber: ReceiptNumber;
  reprintCount: number;
  isDuplicateWatermarkApplied: true;
  reprintedAt: IsoTimestampString;
  pdfDownloadUrl: string;
}
