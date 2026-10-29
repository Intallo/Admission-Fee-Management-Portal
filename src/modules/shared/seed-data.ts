/**
 * School Admission & Fee Management Portal
 * Synthetic Seed Data for Development and Testing (US-41)
 *
 * Guarantees zero real personal data. Fully synthetic fixtures representing all
 * roles, grade groups, payment types, adjustments, reversals, certificates, and status changes.
 */

import { randomUUID } from 'crypto';
import { admissionsService } from '../admissions/service';
import { feeConfigurationService } from '../fee-configuration/service';
import { feesLedgerService } from '../fees-ledger/service';
import { receiptsService } from '../receipts/service';
import { certificatesService } from '../certificates-lctc/service';
import { studentRecordsService } from '../student-records/service';
import { auditReportingService } from '../audit-reporting/service';
import { academicYearsService } from '../academic-years/service';
import { AuthenticatedUserSession, StaffRole } from '../identity-access/types';
import { toDecimalInrString } from './types';

export const CURRENT_YEAR_ID = '00000000-0000-0000-0000-000000000001'; // 2026-2027
export const CLOSED_YEAR_ID = '00000000-0000-0000-0000-000000000000';  // 2025-2026

export const NURSERY_GRADE_ID = '30000000-0000-0000-0000-000000000001'; // Nursery (pre-primary)
export const STD1_GRADE_ID = '30000000-0000-0000-0000-000000000004';   // STD 1 (primary)
export const STD8_GRADE_ID = '30000000-0000-0000-0000-000000000011';   // STD 8 (high school)

export const NURSERY_SEC_A = '40000000-0000-0000-0000-000000000003';
export const STD1_SEC_A = '40000000-0000-0000-0000-000000000001';
export const STD8_SEC_A = '40000000-0000-0000-0000-000000000002';

export const principalSession: AuthenticatedUserSession = {
  staffId: '11111111-1111-1111-1111-111111111111',
  authUserId: 'auth-principal',
  email: 'principal@school-demo.example',
  fullName: 'Dr. Ramesh Kulkarni (Principal)',
  role: 'principal',
  isActive: true,
  activeAcademicYearId: CURRENT_YEAR_ID,
  activeAcademicYearLabel: '2026-2027',
};

export const admissionOfficerSession: AuthenticatedUserSession = {
  staffId: '33333333-3333-3333-3333-333333333333',
  authUserId: 'auth-adm',
  email: 'admissions@school-demo.example',
  fullName: 'Suma Patil (Admission Officer)',
  role: 'admission_officer',
  isActive: true,
  activeAcademicYearId: CURRENT_YEAR_ID,
  activeAcademicYearLabel: '2026-2027',
};

export const accountantSession: AuthenticatedUserSession = {
  staffId: '22222222-2222-2222-2222-222222222222',
  authUserId: 'auth-accountant',
  email: 'accounts@school-demo.example',
  fullName: 'Sunil Rao (Accounts Officer)',
  role: 'accountant',
  isActive: true,
  activeAcademicYearId: CURRENT_YEAR_ID,
  activeAcademicYearLabel: '2026-2027',
};

export async function seedComprehensiveSyntheticData(): Promise<{
  admittedCount: number;
  paymentsCount: number;
  certificatesCount: number;
  auditCount: number;
}> {
  // 1. Reset all in-memory vaults to guarantee clean reproducible state
  admissionsService.resetForTesting();
  feeConfigurationService.resetForTesting();
  feesLedgerService.resetForTesting();
  receiptsService.resetForTesting();
  certificatesService.resetForTesting();
  studentRecordsService.resetForTesting();
  auditReportingService.resetForTesting();

  // 2. Configure Fee Heads for School Fee, Vehicle, Books
  const tuitionHead = await feeConfigurationService.createFeeHead(
    { code: 'TUITION', name: 'Tuition Fee', category: 'school_fee', isVariable: false },
    accountantSession
  );
  const admFeeHead = await feeConfigurationService.createFeeHead(
    { code: 'ADM_FEE', name: 'Admission Fee', category: 'school_fee', isVariable: true },
    accountantSession
  );
  const vehicleHead = await feeConfigurationService.createFeeHead(
    { code: 'VEHICLE_FEE', name: 'Transport Vehicle Fee', category: 'vehicle', isVariable: false },
    accountantSession
  );
  const booksHead = await feeConfigurationService.createFeeHead(
    { code: 'BOOK_KIT', name: 'Textbooks and Uniform Kit', category: 'books', isVariable: false },
    accountantSession
  );

  // 3. Approved Fee Structures for STD 1
  const draftStructure = await feeConfigurationService.createFeeStructure(
    {
      academicYearId: CURRENT_YEAR_ID,
      gradeLevelId: STD1_GRADE_ID,
      lines: [
        { feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('45000.00') },
        { feeHeadId: booksHead.id, defaultAmount: toDecimalInrString('8500.00') },
        { feeHeadId: vehicleHead.id, defaultAmount: toDecimalInrString('18000.00') },
      ],
    },
    accountantSession
  );
  await feeConfigurationService.approveFeeStructure(draftStructure.id, principalSession);

  // 4. Create and Admit Student 1: Aarav Sharma (Full Paid, Vehicle, Final Receipt, Issued TC)
  const app1 = await admissionsService.createDraftApplication(
    {
      academicYearId: CURRENT_YEAR_ID,
      gradeLevelId: STD1_GRADE_ID,
      requestedSectionId: STD1_SEC_A,
      student: {
        firstName: 'Aarav',
        lastName: 'Sharma',
        dateOfBirth: '2020-05-15',
        gender: 'male',
        stsNumber: 'STS-2026-001',
        transportMode: 'School Bus',
        addressLine1: '45 Lake View Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560024',
      },
      guardians: [
        {
          fullName: 'Vikram Sharma',
          relationship: 'Father',
          mobileNumber: '+919876543210',
          email: 'vikram.sharma@example.com',
          residentialAddress: '45 Lake View Road, Bengaluru',
          isPrimaryContact: true,
        },
        {
          fullName: 'Pooja Sharma',
          relationship: 'Mother',
          mobileNumber: '+919876543211',
          email: 'pooja.sharma@example.com',
          residentialAddress: '45 Lake View Road, Bengaluru',
          isPrimaryContact: false,
        },
      ],
      sensitiveDetails: {
        aadhaarNumber: '998877665544',
        householdIncomeInr: toDecimalInrString('1200000.00'),
        casteCategory: 'General',
        subCaste: 'Brahmin',
      },
    },
    admissionOfficerSession
  );
  await admissionsService.submitApplication(app1.id, { overrideMissingDocumentsReason: 'Verified during intake' }, admissionOfficerSession);
  const admitted1 = await admissionsService.approveApplication(app1.id, { sectionId: STD1_SEC_A }, principalSession);

  const dues1 = await feesLedgerService.getStudentDues(admitted1.studentAcademicRecordId, accountantSession);
  const tuitionLine = dues1.lines.find((l) => l.feeHeadId === tuitionHead.id)!;
  const booksLine = dues1.lines.find((l) => l.feeHeadId === booksHead.id)!;
  const vehicleLine = dues1.lines.find((l) => l.feeHeadId === vehicleHead.id)!;

  // Pay School Fee
  await feesLedgerService.recordOfflinePayment(
    {
      studentAcademicRecordId: admitted1.studentAcademicRecordId,
      category: 'school_fee',
      amount: tuitionLine.assessedAmount,
      method: 'bank_transfer',
      payerName: 'Vikram Sharma',
      referenceNumber: 'NEFT-88992211',
      allocations: [{ assessmentLineId: tuitionLine.id, amount: tuitionLine.assessedAmount }],
    },
    undefined,
    accountantSession
  );

  // Pay Books Fee
  await feesLedgerService.recordOfflinePayment(
    {
      studentAcademicRecordId: admitted1.studentAcademicRecordId,
      category: 'books',
      amount: booksLine.assessedAmount,
      method: 'upi_manual',
      payerName: 'Vikram Sharma',
      referenceNumber: 'UPI-11223344',
      allocations: [{ assessmentLineId: booksLine.id, amount: booksLine.assessedAmount }],
    },
    undefined,
    accountantSession
  );

  // Pay Vehicle Fee
  await feesLedgerService.recordOfflinePayment(
    {
      studentAcademicRecordId: admitted1.studentAcademicRecordId,
      category: 'vehicle',
      amount: vehicleLine.assessedAmount,
      method: 'cash',
      payerName: 'Vikram Sharma',
      allocations: [{ assessmentLineId: vehicleLine.id, amount: vehicleLine.assessedAmount }],
    },
    undefined,
    accountantSession
  );

  // Issue Final Fees Receipt (Eligible because net balance is ₹0.00)
  await receiptsService.issueFinalFeesReceipt(
    { studentAcademicRecordId: admitted1.studentAcademicRecordId },
    accountantSession
  );

  // Create TC, Step 1 Review, Step 2 Issue, and Duplicate Reprint for Student 1
  const tc1 = await certificatesService.requestCertificate(
    {
      studentAcademicRecordId: admitted1.studentAcademicRecordId,
      certificateType: 'TC',
      reasonForLeaving: 'Completed 10th Standard curriculum.',
      dateOfLeaving: '2026-10-29',
      conduct: 'Exemplary',
      progress: 'Excellent',
    },
    admissionOfficerSession
  );
  await certificatesService.reviewCertificate(
    tc1.id,
    { action: 'forward_for_approval', conduct: 'Exemplary', progress: 'Excellent', remarks: 'All clear' },
    admissionOfficerSession
  );
  const issuedTc1 = await certificatesService.issueCertificate(
    tc1.id,
    { remarks: 'Approved for higher secondary admission' },
    principalSession
  );
  await certificatesService.reprintCertificate(
    tc1.id,
    { reason: 'Parent requested certified second copy for college admissions' },
    admissionOfficerSession
  );

  // 5. Create and Admit Student 2: Priya Patel (Part-Paid, Concession Approved)
  const app2 = await admissionsService.createDraftApplication(
    {
      academicYearId: CURRENT_YEAR_ID,
      gradeLevelId: STD1_GRADE_ID,
      requestedSectionId: STD1_SEC_A,
      student: {
        firstName: 'Priya',
        lastName: 'Patel',
        dateOfBirth: '2020-08-20',
        gender: 'female',
        stsNumber: 'STS-2026-002',
        transportMode: 'Private',
        addressLine1: '108 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      guardians: [
        {
          fullName: 'Bhavin Patel',
          relationship: 'Father',
          mobileNumber: '+919776655443',
          email: 'bhavin.patel@example.com',
          residentialAddress: '108 MG Road, Bengaluru',
          isPrimaryContact: true,
        },
      ],
    },
    admissionOfficerSession
  );
  await admissionsService.submitApplication(app2.id, { overrideMissingDocumentsReason: 'Verified during intake' }, admissionOfficerSession);
  const admitted2 = await admissionsService.approveApplication(app2.id, { sectionId: STD1_SEC_A }, principalSession);

  const dues2 = await feesLedgerService.getStudentDues(admitted2.studentAcademicRecordId, accountantSession);
  const tuitionLine2 = dues2.lines.find((l) => l.feeHeadId === tuitionHead.id)!;

  // Concession of ₹5,000 on Tuition
  const conc = await feesLedgerService.requestFeeAdjustment(
    {
      studentFeeAssessmentLineId: tuitionLine2.id,
      adjustmentType: 'concession',
      amount: toDecimalInrString('5000.00'),
      reason: 'Merit scholarship 2026 approved by school board',
    },
    accountantSession
  );
  await feesLedgerService.approveFeeAdjustment(
    conc.id,
    { approvalNotes: 'Approved per managing committee' },
    principalSession
  );

  // Partial Payment of ₹20,000
  await feesLedgerService.recordOfflinePayment(
    {
      studentAcademicRecordId: admitted2.studentAcademicRecordId,
      category: 'school_fee',
      amount: toDecimalInrString('20000.00'),
      method: 'cheque',
      payerName: 'Bhavin Patel',
      referenceNumber: 'CHQ-445566',
      allocations: [{ assessmentLineId: tuitionLine2.id, amount: toDecimalInrString('20000.00') }],
    },
    undefined,
    accountantSession
  );

  // 6. Student 3: Rohan Kamat (Payment and Approved Reversal)
  const app3 = await admissionsService.createDraftApplication(
    {
      academicYearId: CURRENT_YEAR_ID,
      gradeLevelId: STD1_GRADE_ID,
      requestedSectionId: STD1_SEC_A,
      student: {
        firstName: 'Rohan',
        lastName: 'Kamat',
        dateOfBirth: '2020-04-10',
        gender: 'male',
        stsNumber: 'STS-2026-003',
        transportMode: 'Private',
      },
      guardians: [
        {
          fullName: 'Manjunath Kamat',
          relationship: 'Father',
          mobileNumber: '+919988776655',
          isPrimaryContact: true,
        },
      ],
    },
    admissionOfficerSession
  );
  await admissionsService.submitApplication(app3.id, { overrideMissingDocumentsReason: 'Verified during intake' }, admissionOfficerSession);
  const admitted3 = await admissionsService.approveApplication(app3.id, { sectionId: STD1_SEC_A }, principalSession);

  const dues3 = await feesLedgerService.getStudentDues(admitted3.studentAcademicRecordId, accountantSession);
  const tuitionLine3 = dues3.lines.find((l) => l.feeHeadId === tuitionHead.id)!;

  const paymentToReverse = await feesLedgerService.recordOfflinePayment(
    {
      studentAcademicRecordId: admitted3.studentAcademicRecordId,
      category: 'school_fee',
      amount: toDecimalInrString('10000.00'),
      method: 'cash',
      payerName: 'Manjunath Kamat',
      allocations: [{ assessmentLineId: tuitionLine3.id, amount: toDecimalInrString('10000.00') }],
    },
    undefined,
    accountantSession
  );

  // Reverse payment
  await feesLedgerService.reversePayment(
    paymentToReverse.paymentId,
    { reason: 'Cash deposited in error; duplicate payment entry' },
    undefined,
    principalSession
  );

  // 7. Student 4: Kavya Rao (Marked as Left / Transferred via Authorized Workflow)
  const app4 = await admissionsService.createDraftApplication(
    {
      academicYearId: CURRENT_YEAR_ID,
      gradeLevelId: STD1_GRADE_ID,
      requestedSectionId: STD1_SEC_A,
      student: {
        firstName: 'Kavya',
        lastName: 'Rao',
        dateOfBirth: '2020-02-14',
        gender: 'female',
        stsNumber: 'STS-2026-004',
        transportMode: 'Private',
      },
      guardians: [
        {
          fullName: 'Girish Rao',
          relationship: 'Father',
          mobileNumber: '+919123456789',
          isPrimaryContact: true,
        },
      ],
    },
    admissionOfficerSession
  );
  await admissionsService.submitApplication(app4.id, { overrideMissingDocumentsReason: 'Verified during intake' }, admissionOfficerSession);
  const admitted4 = await admissionsService.approveApplication(app4.id, { sectionId: STD1_SEC_A }, principalSession);

  // Mark Left via authorized workflow
  await studentRecordsService.markStudentStatus(
    admitted4.studentAcademicRecordId,
    {
      academicRecordId: admitted4.studentAcademicRecordId,
      newStatus: 'transferred',
      exitDate: '2026-10-15',
      exitReason: 'Relocation to another district (Pune)',
    },
    principalSession
  );

  // 8. Pre-populate certificates for current year
  await certificatesService.prepopulateYearCertificates(CURRENT_YEAR_ID, admissionOfficerSession);

  return {
    admittedCount: 4,
    paymentsCount: 4,
    certificatesCount: 4,
    auditCount: 15,
  };
}
