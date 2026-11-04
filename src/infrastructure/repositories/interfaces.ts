import { AuthenticatedUserSession } from '../../modules/identity-access/types';

export interface IIdentityRepository {
  getStaffByEmail(email: string): Promise<any | null>;
  getStaffById(staffId: string): Promise<any | null>;
  getSecurityProfile(staffId: string, email?: string, session?: AuthenticatedUserSession): Promise<any | null>;
  recordLoginAttempt(staffId: string, success: boolean, lockedUntil?: number | null, session?: AuthenticatedUserSession): Promise<void>;
  updatePassword(staffId: string, passwordHash: string, mustChangePassword: boolean, session?: AuthenticatedUserSession): Promise<void>;
  listStaff(session?: AuthenticatedUserSession): Promise<any[]>;
  createStaff(data: any, session?: AuthenticatedUserSession): Promise<any>;
  updateStaff(staffId: string, data: any, session?: AuthenticatedUserSession): Promise<any>;
  resetForTesting?(): void;
}

export interface IAcademicYearsRepository {
  listAcademicYears(session?: AuthenticatedUserSession): Promise<any[]>;
  getAcademicYearById(yearId: string, session?: AuthenticatedUserSession): Promise<any>;
  createAcademicYear(data: any, session?: AuthenticatedUserSession): Promise<any>;
  closeAcademicYear(yearId: string, session?: AuthenticatedUserSession): Promise<any>;
  listGradeLevels(session?: AuthenticatedUserSession): Promise<any[]>;
  listSections(academicYearId?: string, session?: AuthenticatedUserSession): Promise<any[]>;
  getSectionById(sectionId: string, session?: AuthenticatedUserSession): Promise<any>;
  updateSectionCapacity(sectionId: string, maxCapacity: number, session?: AuthenticatedUserSession): Promise<any>;
  resetForTesting?(): void;
}

export interface IAdmissionsRepository {
  getNextApplicationNumber(academicYearId: string, yearLabel: string, session?: AuthenticatedUserSession, client?: any): Promise<string>;
  getNextAdmissionNumber(academicYearId: string, yearLabel: string, session?: AuthenticatedUserSession, client?: any): Promise<string>;
  createDraft(payload: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  updateDraft(applicationId: string, payload: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  submitApplication(applicationId: string, payloadOrSession?: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  reviewApplication(
    applicationId: string,
    payload: any,
    session?: AuthenticatedUserSession,
    client?: any
  ): Promise<any>;
  rejectApplication(applicationId: string, payload: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  getApplicationById(applicationId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  listApplications(filter: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  checkCapacity(sectionId: string, academicYearId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  approveApplication(
    applicationId: string,
    payload: any,
    session?: AuthenticatedUserSession,
    client?: any
  ): Promise<any>;
  getAcademicRecordById(recordId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  getAcademicRecordByAdmissionNumber?(admissionNumber: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  listAcademicRecordsForStudent?(studentId: string, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  listAcademicRecordsForYear(academicYearId: string, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  getAllAcademicRecords(session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  getStudentById(studentId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  getApplicationByRecordId(recordId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  saveAcademicRecord?(record: any): Promise<void>;
  saveStudent?(student: any): Promise<void>;
  saveFeeAssessment?(assessment: any): Promise<void>;
  getFeeAssessmentByRecordId?(studentAcademicRecordId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  getAllApplications?(session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  resetForTesting?(): void;
}

export interface IStudentRecordsRepository {
  searchStudents(filter: any, session: AuthenticatedUserSession, existingClient?: any): Promise<{ data: any[]; total: number }>;
  getStudentProfile(identifier: string, session: AuthenticatedUserSession, requestedAcademicYearId?: string, existingClient?: any): Promise<any>;
  updateStudentStatus(recordId: string, status: any, reason: string, session: AuthenticatedUserSession, exitDate?: string, existingClient?: any): Promise<any>;
  getStatusHistory(recordId: string, session?: AuthenticatedUserSession, existingClient?: any): Promise<any[]>;
  resetForTesting?(): void;
}

export interface IFeeConfigurationRepository {
  listFeeHeads(session?: AuthenticatedUserSession): Promise<any[]>;
  createFeeHead(payload: any, session?: AuthenticatedUserSession): Promise<any>;
  listFeeStructures(academicYearId?: string, session?: AuthenticatedUserSession): Promise<any[]>;
  getFeeStructureById(id: string, session?: AuthenticatedUserSession): Promise<any>;
  getFeeStructureForGrade(academicYearId: string, gradeLevelId: string, session?: AuthenticatedUserSession): Promise<any>;
  createFeeStructure(payload: any, session?: AuthenticatedUserSession): Promise<any>;
  approveFeeStructure(id: string, session?: AuthenticatedUserSession): Promise<any>;
  listTransportRates(academicYearId?: string, session?: AuthenticatedUserSession): Promise<any[]>;
  createTransportRate(payload: any, session?: AuthenticatedUserSession): Promise<any>;
  resetForTesting?(): void;
}

export interface IFeesLedgerRepository {
  getStudentDuesSummary(
    studentAcademicRecordId: string,
    academicYearId?: string,
    session?: AuthenticatedUserSession,
    existingClient?: any
  ): Promise<any>;

  recordOfflinePayment(
    params: any,
    idempotencyKey?: string,
    session?: AuthenticatedUserSession
  ): Promise<any>;

  recordPayment(
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
  getAllAdjustments(session?: AuthenticatedUserSession): Promise<any[]>;
  resetForTesting?(): void;
}

export interface IReceiptsRepository {
  getNextReceiptNumber(series: string, academicYearId?: string, session?: AuthenticatedUserSession): Promise<any>;
  getReceiptById(receiptId: string, session?: AuthenticatedUserSession): Promise<any>;
  getReceiptByPaymentId(paymentId: string, session?: AuthenticatedUserSession): Promise<any>;
  listReceiptsForRecord(studentAcademicRecordId: string, session?: AuthenticatedUserSession, existingClient?: any): Promise<any[]>;
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
  resetForTesting?(): void;
}

export interface ICertificatesRepository {
  getNextCertificateNumber(prefix?: string, academicYearIdOrSession?: string | AuthenticatedUserSession, session?: AuthenticatedUserSession): Promise<string>;
  prepopulateCertificate(studentAcademicRecordId: string, session?: AuthenticatedUserSession, extra?: any): Promise<any>;
  getCertificateById(certificateId: string, session?: AuthenticatedUserSession): Promise<any>;
  getCertificateByStudentRecordId(studentRecordId: string, session?: AuthenticatedUserSession, existingClient?: any): Promise<any>;
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
  listCertificates(filter?: any, session?: AuthenticatedUserSession): Promise<any>;
  resetForTesting?(): void;
}

export interface IDocumentsRepository {
  listDocumentTypes(session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  listRequirements(academicYearId?: string, gradeLevelId?: string | null, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  getDocumentTypeById?(id: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  saveDocument(doc: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  getDocumentById(documentId: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  listDocumentsForApplication(applicationId: string, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  listDocumentsForStudent?(studentId: string, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  getDocumentVersions?(documentId: string, session?: AuthenticatedUserSession, client?: any): Promise<any[]>;
  verifyDocument(documentId: string, status: string, reason?: string, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  resetForTesting?(): void;
}

export interface IAuditRepository {
  recordAuditEvent(input: any, session?: AuthenticatedUserSession, client?: any): Promise<any>;
  logAction(entry: any, session?: AuthenticatedUserSession, client?: any): Promise<void>;
  getLogs(
    filter: any,
    session?: AuthenticatedUserSession,
    client?: any
  ): Promise<{ data: any[]; total: number }>;
  resetForTesting?(): void;
}
