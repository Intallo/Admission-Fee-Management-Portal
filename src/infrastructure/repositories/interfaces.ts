import { AuthenticatedUserSession } from '../../modules/identity-access/types';

export interface IFeesLedgerRepository {
  getStudentDuesSummary(
    studentAcademicRecordId: string,
    academicYearId?: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  recordOfflinePayment(
    params: any,
    idempotencyKey?: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  requestAdjustment(
    params: any,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  approveFeeAdjustment(
    adjustmentId: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  reversePayment(
    paymentId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  getPaymentById(paymentId: string, session?: AuthenticatedUserSession): Promise<any>;
  listPaymentsForRecord(studentAcademicRecordId: string, session?: AuthenticatedUserSession): Promise<any[]>;
  getAllAllocations(session?: AuthenticatedUserSession): Promise<any[]>;
}

export interface IReceiptsRepository {
  getNextReceiptNumber(series: string, academicYearId?: string, session?: AuthenticatedUserSession): Promise<any>;
  getReceiptById(receiptId: string, session?: AuthenticatedUserSession): Promise<any>;
  getReceiptByPaymentId(paymentId: string, session?: AuthenticatedUserSession): Promise<any>;
  listReceiptsForRecord(studentAcademicRecordId: string, session?: AuthenticatedUserSession): Promise<any[]>;
  createReceipt(receipt: any, session?: AuthenticatedUserSession): Promise<any>;
  issueFinalReceipt(
    studentAcademicRecordId: string,
    notes?: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;
  reprintReceipt(
    receiptId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;
}

export interface ICertificatesRepository {
  prepopulateCertificate(studentAcademicRecordId: string, session?: AuthenticatedUserSession): Promise<any>;
  getCertificateById(certificateId: string, session?: AuthenticatedUserSession): Promise<any>;
  getCertificateByStudentRecordId(studentRecordId: string, session?: AuthenticatedUserSession): Promise<any>;
  reviewCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any>;
  issueCertificate(
    certificateId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any>;
  reprintCertificate(
    certificateId: string,
    reason: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;
}

export interface IAdmissionsRepository {
  getNextApplicationNumber(academicYearId: string, yearLabel: string, session?: AuthenticatedUserSession): Promise<string>;
  getNextAdmissionNumber(academicYearId: string, yearLabel: string, session?: AuthenticatedUserSession): Promise<string>;
  createDraft(payload: any, session?: AuthenticatedUserSession): Promise<any>;
  updateDraft(applicationId: string, payload: any, session?: AuthenticatedUserSession): Promise<any>;
  getApplicationById(applicationId: string, session?: AuthenticatedUserSession): Promise<any>;
  listApplications(filter: any, session?: AuthenticatedUserSession): Promise<any>;
  checkCapacity(sectionId: string, academicYearId: string, session?: AuthenticatedUserSession): Promise<any>;
  approveApplication(
    applicationId: string,
    payload: any,
    session?: AuthenticatedUserSession
  ): Promise<any>;
  getAcademicRecordById(recordId: string, session?: AuthenticatedUserSession): Promise<any>;
  listAcademicRecordsForYear(academicYearId: string, session?: AuthenticatedUserSession): Promise<any[]>;
}

export interface IAuditRepository {
  logAction(entry: any, session?: AuthenticatedUserSession): Promise<void>;
  getLogs(
    filter: any,
    session?: AuthenticatedUserSession
  ): Promise<{ data: any[]; total: number }>;
}
