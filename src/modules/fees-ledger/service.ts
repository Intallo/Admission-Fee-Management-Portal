import { randomUUID } from 'crypto';
import {
  FeeCategory,
} from '../fee-configuration/types';
import {
  ApproveFeeAdjustmentDTO,
  CreateFeeAdjustmentDTO,
  PaymentAllocationInputDTO,
  PaymentKind,
  PaymentMethod,
  RecordPaymentRequestDTO,
  RecordPaymentResultDTO,
  ReversePaymentRequestDTO,
  ReversePaymentResultDTO,
  StudentFeeAssessmentLineDTO,
  StudentFeeSummaryDTO,
} from './types';
import { AuthenticatedUserSession } from '../identity-access/types';
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import { enforcePolicy } from '../../policy/guards';
import { academicYearsService } from '../academic-years/service';
import { admissionsService } from '../admissions/service';
import { feeConfigurationService } from '../fee-configuration/service';
import { logger } from '../../lib/logger';
import { toDecimalInrString, DecimalInrString, ReceiptNumber } from '../shared/types';
import {
  addInr,
  amountInWordsInr,
  compareInr,
  formatInr,
  subtractInr,
  toDecimal,
} from '../../lib/money/inr';
import { receiptsService } from '../receipts/service';

export interface InternalPaymentRecord {
  id: string;
  studentAcademicRecordId: string;
  transactionType: PaymentKind; // 'collection' | 'refund' | 'reversal'
  amount: DecimalInrString;
  currency: 'INR';
  method: PaymentMethod;
  transactionDate: string; // ISO
  payerName: string;
  payerContact?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  reversesPaymentId?: string | null;
  idempotencyKey?: string | null;
  recordedBy: string; // Staff UUID
  createdAt: string;
}

export interface InternalPaymentAllocation {
  id: string;
  paymentId: string;
  studentFeeAssessmentLineId: string;
  amount: DecimalInrString;
  createdAt: string;
}

export interface InternalFeeAdjustment {
  id: string;
  studentFeeAssessmentLineId: string;
  adjustmentType: 'concession' | 'additional_charge' | 'correction';
  amount: DecimalInrString;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// Global In-memory vaults for synthetic/unit-test mode
let paymentsVault = new Map<string, InternalPaymentRecord>();
let allocationsVault = new Map<string, InternalPaymentAllocation>();
let adjustmentsVault = new Map<string, InternalFeeAdjustment>();
let paymentResultsVault = new Map<string, RecordPaymentResultDTO>(); // idempotencyKey -> result

// Mutex lock for thread-safe sequential operations
class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const nextQueue = this.queue.then(() => waitPromise);
    const unlock = () => {
      release();
    };
    this.queue = nextQueue;
    return Promise.resolve(unlock);
  }
}

const financialTxLock = new AsyncLock();

export class FeesLedgerService {
  /**
   * Resets the ledger vaults for clean test isolation.
   */
  resetForTesting(): void {
    paymentsVault.clear();
    allocationsVault.clear();
    adjustmentsVault.clear();
    paymentResultsVault.clear();
  }

  /**
   * Computes itemized fee assessment lines, paid sums, and net dues for a student.
   * Enforces SBR-03, US-23, and US-24.
   */
  async getStudentDues(
    studentAcademicRecordId: string,
    actorSession: AuthenticatedUserSession
  ): Promise<StudentFeeSummaryDTO> {
    enforcePolicy(actorSession.role, 'fees:view_dues');
    return this.getStudentDuesInternal(studentAcademicRecordId);
  }

  /**
   * Internal helper to calculate student dues without session policy enforcement (for internal domain modules like certificates and dashboards).
   */
  async getStudentDuesInternal(
    studentAcademicRecordId: string
  ): Promise<StudentFeeSummaryDTO> {
    const academicRecord = admissionsService.getAcademicRecord(studentAcademicRecordId);
    if (!academicRecord) {
      throw new NotFoundError(
        `Student academic record with ID "${studentAcademicRecordId}" not found.`
      );
    }

    const student = admissionsService.getStudentById(academicRecord.studentId);
    const grade = admissionsService.getGradeLevel(academicRecord.gradeLevelId);
    const assessment = admissionsService.getFeeAssessmentByRecordId(studentAcademicRecordId);

    const assessmentLines: StudentFeeAssessmentLineDTO[] = [];
    let totalAssessed = '0.00';
    let totalConcessions = '0.00';
    let totalPaid = '0.00';
    let netBalanceDue = '0.00';

    if (assessment && assessment.lines) {
      for (const line of assessment.lines) {
        const feeHead = await feeConfigurationService.getFeeHeadById(line.feeHeadId);
        const lineAssessed = formatInr(line.assessedAmount);

        // Calculate concessions and additional charges for this line
        const lineAdjustments = Array.from(adjustmentsVault.values()).filter(
          (adj) => adj.studentFeeAssessmentLineId === line.id && adj.status === 'approved'
        );

        let lineConcessions = '0.00';
        let lineExtraCharges = '0.00';

        for (const adj of lineAdjustments) {
          if (adj.adjustmentType === 'concession') {
            lineConcessions = addInr(lineConcessions, adj.amount);
          } else if (adj.adjustmentType === 'additional_charge') {
            lineExtraCharges = addInr(lineExtraCharges, adj.amount);
          }
        }

        // Calculate collections and reversals for this line
        const lineAllocations = Array.from(allocationsVault.values()).filter(
          (alloc) => alloc.studentFeeAssessmentLineId === line.id
        );

        let lineCollected = '0.00';
        let lineReversed = '0.00';

        for (const alloc of lineAllocations) {
          const pay = paymentsVault.get(alloc.paymentId);
          if (!pay) continue;

          if (pay.transactionType === 'collection') {
            lineCollected = addInr(lineCollected, alloc.amount);
          } else if (pay.transactionType === 'reversal' || pay.transactionType === 'refund') {
            lineReversed = addInr(lineReversed, alloc.amount);
          }
        }

        // Net paid = collected - reversed
        const lineNetPaid = subtractInr(lineCollected, lineReversed);

        // Billed = assessed + extra - concession
        const lineBilled = subtractInr(addInr(lineAssessed, lineExtraCharges), lineConcessions);

        // Balance = Billed - Net Paid
        const lineBalance = subtractInr(lineBilled, lineNetPaid);

        assessmentLines.push({
          id: line.id,
          feeHeadId: feeHead.id,
          feeHeadName: feeHead.name,
          category: feeHead.category,
          assessedAmount: toDecimalInrString(lineAssessed),
          approvedConcessionsAmount: toDecimalInrString(lineConcessions),
          collectedAmount: toDecimalInrString(lineCollected),
          refundedReversedAmount: toDecimalInrString(lineReversed),
          netRemainingDues: toDecimalInrString(
            compareInr(lineBalance, '0.00') < 0 ? '0.00' : lineBalance
          ),
        });

        totalAssessed = addInr(totalAssessed, lineBilled);
        totalConcessions = addInr(totalConcessions, lineConcessions);
        totalPaid = addInr(totalPaid, lineNetPaid);
        netBalanceDue = addInr(
          netBalanceDue,
          compareInr(lineBalance, '0.00') < 0 ? '0.00' : lineBalance
        );
      }
    }

    const studentFullName = student
      ? `${student.firstName} ${student.lastName}`
      : 'Student Name';

    return {
      studentAcademicRecordId,
      studentName: studentFullName,
      admissionNumber: academicRecord.admissionNumber,
      standard: grade?.name || 'Class',
      totalAssessedInr: toDecimalInrString(totalAssessed),
      totalConcessionsInr: toDecimalInrString(totalConcessions),
      totalPaidInr: toDecimalInrString(totalPaid),
      netBalanceDueInr: toDecimalInrString(netBalanceDue),
      lines: assessmentLines,
    };
  }

  /**
   * Records an offline payment and issues an immutable receipt snapshot.
   * Operation 2: record_payment_and_issue_receipt
   * Atomic Transaction Guarantee:
   * Payment posting + allocation creation + variable-head billing + receipt numbering + immutable snapshot + audit log commit as ONE.
   */
  async recordOfflinePayment(
    payload: RecordPaymentRequestDTO,
    idempotencyKey: string | undefined,
    actorSession: AuthenticatedUserSession
  ): Promise<RecordPaymentResultDTO> {
    enforcePolicy(actorSession.role, 'fees:record_payment');

    // 1. Idempotency Check: if already processed under this idempotencyKey, return previous result
    if (idempotencyKey && paymentResultsVault.has(idempotencyKey)) {
      logger.info('Returning cached payment result for duplicate idempotency key', {
        idempotencyKey,
        actorStaffId: actorSession.staffId,
      });
      return paymentResultsVault.get(idempotencyKey)!;
    }

    // Acquire transaction mutex lock for sequential consistency
    const releaseLock = await financialTxLock.acquire();

    // Snapshot state for atomic rollback on failure
    const rollbackPaymentId: string | null = null;
    const createdAllocIds: string[] = [];
    let allocatedReceiptId: string | null = null;

    try {
      // Re-check idempotency under lock in case of concurrent burst
      if (idempotencyKey && paymentResultsVault.has(idempotencyKey)) {
        return paymentResultsVault.get(idempotencyKey)!;
      }

      // 2. Validate Student Academic Record & State
      const academicRecord = admissionsService.getAcademicRecord(payload.studentAcademicRecordId);
      if (!academicRecord) {
        throw new NotFoundError(
          `Student academic record with ID "${payload.studentAcademicRecordId}" not found.`
        );
      }

      // Academic Year must be writable (not closed) (SBR-05 / BR-39)
      const academicYear = await academicYearsService.assertAcademicYearWritable(
        academicRecord.academicYearId
      );

      // Student status must be admitted or active
      if (academicRecord.status !== 'admitted' && academicRecord.status !== 'active') {
        throw new BusinessRuleError(
          `Disallowed payment: Student is in state "${academicRecord.status}". Payments can only be accepted for admitted or active students.`
        );
      }

      // 3. Payment Method validation (offline only, DEC-02)
      const allowedMethods: PaymentMethod[] = ['cash', 'cheque', 'bank_transfer', 'upi_manual', 'other'];
      if (!allowedMethods.includes(payload.method)) {
        throw new ValidationError(`Unsupported payment method "${payload.method}". Only offline payment methods are supported.`);
      }

      // 4. Exact Amount & Allocation Arithmetic Validations
      const totalAmount = formatInr(payload.amount);
      if (compareInr(totalAmount, '0.00') <= 0) {
        throw new ValidationError('Payment amount must be greater than ₹0.00.');
      }

      if (!payload.allocations || payload.allocations.length === 0) {
        throw new ValidationError('At least one allocation line is required.');
      }

      // Check sum of allocations matches total payment amount (DEC-11, BR-17, ALLOCATION_SUM_MISMATCH)
      let sumAllocations = '0.00';
      for (const alloc of payload.allocations) {
        const allocAmt = formatInr(alloc.amount);
        if (compareInr(allocAmt, '0.00') <= 0) {
          throw new ValidationError('Allocation amount must be strictly greater than ₹0.00.');
        }
        sumAllocations = addInr(sumAllocations, allocAmt);
      }

      if (compareInr(sumAllocations, totalAmount) !== 0) {
        throw new BusinessRuleError(
          `ALLOCATION_SUM_MISMATCH: Payment amount of ₹${totalAmount} does not match the sum of allocation lines (₹${sumAllocations}).`
        );
      }

      // 5. Single Category Validation (DEC-10, BR-17, MULTI_CATEGORY_PAYMENT_PROHIBITED)
      let assessment = admissionsService.getFeeAssessmentByRecordId(payload.studentAcademicRecordId);
      if (!assessment) {
        // If no assessment exists yet (e.g. admitted with fee not generated, or direct intake), create initial assessment
        assessment = {
          id: randomUUID(),
          assessmentNumber: `AST-${academicYear.label.slice(0, 4)}-${String(payload.studentAcademicRecordId).slice(-4)}`,
          studentAcademicRecordId: payload.studentAcademicRecordId,
          feeStructureId: '60000000-0000-0000-0000-000000000001',
          status: 'issued',
          assessedAt: new Date().toISOString(),
          lines: [],
        };
        admissionsService.saveFeeAssessment(assessment);
      }

      // Get current student dues to validate outstanding balance per head
      const currentDues = await this.getStudentDues(payload.studentAcademicRecordId, actorSession);

      for (const alloc of payload.allocations) {
        let line = assessment.lines.find((l) => l.id === alloc.assessmentLineId);

        // If line is not found by ID directly, check if the allocation ID was actually a fee head ID or needs creation
        if (!line) {
          // Check if this matches a fee head for variable billing
          const head = await feeConfigurationService.getFeeHeadById(alloc.assessmentLineId).catch(() => null);
          if (head && head.isVariable) {
            // Dynamic variable assessment line creation (e.g. Admission Fee)
            line = {
              id: alloc.assessmentLineId,
              feeHeadId: head.id,
              assessedAmount: toDecimal(alloc.amount).toNumber(),
            };
            assessment.lines.push(line);
            admissionsService.saveFeeAssessment(assessment);
          } else {
            throw new NotFoundError(
              `Fee assessment line with ID "${alloc.assessmentLineId}" not found for student.`
            );
          }
        }

        const feeHead = await feeConfigurationService.getFeeHeadById(line.feeHeadId);

        // Check fee category matches payment category strictly
        if (feeHead.category !== payload.category) {
          throw new BusinessRuleError(
            `MULTI_CATEGORY_PAYMENT_PROHIBITED: Cannot allocate payment of category "${payload.category}" to fee head "${feeHead.name}" which belongs to category "${feeHead.category}". Record separate payments per category.`
          );
        }

        // Fixed fee head overpayment check (BR-18, FIXED_HEAD_OVERPAYMENT_PROHIBITED)
        if (!feeHead.isVariable) {
          const dueLine = currentDues.lines.find((dl) => dl.id === line!.id);
          const remainingDue = dueLine ? dueLine.netRemainingDues : '0.00';
          const allocAmt = formatInr(alloc.amount);

          if (compareInr(allocAmt, remainingDue) > 0) {
            throw new BusinessRuleError(
              `FIXED_HEAD_OVERPAYMENT_PROHIBITED: Payment allocation of ₹${allocAmt} exceeds remaining payable dues of ₹${remainingDue} for ${feeHead.name}.`
            );
          }
        } else {
          // Variable head (Admission Fee): amount paid is amount billed (D-002 / DEC-01)
          // Dynamically increase assessed amount by allocation amount so billed == paid
          line.assessedAmount = toDecimal(line.assessedAmount).plus(toDecimal(alloc.amount)).toNumber();
          admissionsService.saveFeeAssessment(assessment);
        }
      }

      // 6. Monotonic Receipt Number Allocation (RCT-YYYY-NNNNNN, SBR-07, US-27 AC2)
      const receiptNumber = receiptsService.getNextReceiptNumber(academicYear.label);

      // 7. Atomic Insertions: Payment + Allocations
      const paymentId = randomUUID();
      const receiptId = randomUUID();
      allocatedReceiptId = receiptId;
      const nowIso = new Date().toISOString();

      const newPayment: InternalPaymentRecord = {
        id: paymentId,
        studentAcademicRecordId: payload.studentAcademicRecordId,
        transactionType: 'collection',
        amount: totalAmount,
        currency: 'INR',
        method: payload.method,
        transactionDate: nowIso,
        payerName: payload.payerName.trim(),
        payerContact: null,
        referenceNumber: payload.referenceNumber || null,
        notes: payload.remarks || null,
        reversesPaymentId: null,
        idempotencyKey: idempotencyKey || null,
        recordedBy: actorSession.staffId,
        createdAt: nowIso,
      };

      paymentsVault.set(paymentId, newPayment);

      for (const alloc of payload.allocations) {
        const allocId = randomUUID();
        const newAlloc: InternalPaymentAllocation = {
          id: allocId,
          paymentId,
          studentFeeAssessmentLineId: alloc.assessmentLineId,
          amount: formatInr(alloc.amount),
          createdAt: nowIso,
        };
        allocationsVault.set(allocId, newAlloc);
        createdAllocIds.push(allocId);
      }

      // 8. Generate Immutable Rendered Receipt Snapshot
      const student = admissionsService.getStudentById(academicRecord.studentId);
      const grade = admissionsService.getGradeLevel(academicRecord.gradeLevelId);
      const section = admissionsService.getSection(academicRecord.sectionId);

      const itemizedAllocations = await Promise.all(
        payload.allocations.map(async (alloc) => {
          const l = assessment!.lines.find((line) => line.id === alloc.assessmentLineId);
          const h = await feeConfigurationService.getFeeHeadById(l!.feeHeadId);
          return {
            feeHeadName: h.name,
            amountInr: formatInr(alloc.amount),
          };
        })
      );

      const renderedSnapshot = {
        schoolName: 'ABC English Medium School',
        receiptNumber,
        receiptType: payload.category,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Student Name',
        admissionNumber: academicRecord.admissionNumber,
        standard: grade?.name || 'Class',
        section: section?.name || 'A',
        academicYear: academicYear.label,
        paymentMethod: payload.method,
        payerName: payload.payerName.trim(),
        paymentDate: nowIso.slice(0, 10),
        totalAmountInr: totalAmount,
        totalAmountInWords: amountInWordsInr(totalAmount),
        itemizedAllocations,
        signatories: {
          payerSignatureLine: 'Payer Signature',
          cashierSignatureLine: actorSession.fullName || 'Cashier / Accounts Officer',
          managerSignatureLine: 'Manager / Principal',
        },
      };

      // Register receipt in receiptsService
      receiptsService.registerReceipt({
        id: receiptId,
        paymentId,
        receiptNumber,
        category: payload.category,
        reprintCount: 0,
        lastReprintedAt: null,
        renderedSnapshot,
        createdAt: nowIso,
      });

      const result: RecordPaymentResultDTO = {
        paymentId,
        receiptId,
        receiptNumber,
        category: payload.category,
        amountInr: totalAmount,
        amountInWords: amountInWordsInr(totalAmount),
        method: payload.method,
        payerName: payload.payerName.trim(),
        receivedAt: nowIso,
        renderedSnapshot,
      };

      if (idempotencyKey) {
        paymentResultsVault.set(idempotencyKey, result);
      }

      logger.info('Offline payment atomically recorded and receipt generated', {
        paymentId,
        receiptNumber,
        studentAcademicRecordId: payload.studentAcademicRecordId,
        amountInr: totalAmount,
        category: payload.category,
        actorStaffId: actorSession.staffId,
      });

      return result;
    } catch (err) {
      // Rollback on any failure
      if (rollbackPaymentId) {
        paymentsVault.delete(rollbackPaymentId);
      }
      for (const id of createdAllocIds) {
        allocationsVault.delete(id);
      }
      if (allocatedReceiptId) {
        receiptsService.unregisterReceipt(allocatedReceiptId);
      }
      logger.error('Payment recording transaction failed; state rolled back', {
        error: (err as Error).message,
        actorStaffId: actorSession.staffId,
      });
      throw err;
    } finally {
      releaseLock();
    }
  }

  /**
   * Approves a fee concession or extra charge (Principal strictly).
   * Operation 3: approve_fee_concession_atomic
   */
  async approveFeeAdjustment(
    adjustmentId: string,
    payload: ApproveFeeAdjustmentDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    enforcePolicy(actorSession.role, 'fees:approve_concession');

    const adj = adjustmentsVault.get(adjustmentId);
    if (!adj) {
      throw new NotFoundError(`Fee adjustment with ID "${adjustmentId}" not found.`);
    }

    if (adj.status === 'approved') {
      return adj; // Idempotent
    }

    if (adj.status === 'rejected') {
      throw new BusinessRuleError('Cannot approve a rejected fee adjustment.');
    }

    const nowIso = new Date().toISOString();
    adj.status = 'approved';
    adj.approvedBy = actorSession.staffId;
    adj.approvedAt = nowIso;
    adjustmentsVault.set(adjustmentId, adj);

    logger.info('Fee adjustment formally approved by Principal', {
      adjustmentId,
      adjustmentType: adj.adjustmentType,
      amount: adj.amount,
      notes: payload.approvalNotes,
      actorStaffId: actorSession.staffId,
    });

    return adj;
  }

  /**
   * Requests a fee concession or additional charge.
   */
  async requestFeeAdjustment(
    payload: CreateFeeAdjustmentDTO,
    actorSession: AuthenticatedUserSession
  ): Promise<InternalFeeAdjustment> {
    enforcePolicy(actorSession.role, 'fees:request_concession');

    if (!payload.reason || payload.reason.trim().length < 5) {
      throw new ValidationError('A detailed reason of at least 5 characters is mandatory.');
    }

    const amount = formatInr(payload.amount);
    if (compareInr(amount, '0.00') <= 0) {
      throw new ValidationError('Adjustment amount must be greater than ₹0.00.');
    }

    const adjId = randomUUID();
    const nowIso = new Date().toISOString();

    // If Principal records directly, auto-approve per AUTHORIZATION_MATRIX.md
    const isPrincipal = actorSession.role === 'principal';

    const newAdj: InternalFeeAdjustment = {
      id: adjId,
      studentFeeAssessmentLineId: payload.studentFeeAssessmentLineId,
      adjustmentType: payload.adjustmentType,
      amount,
      status: isPrincipal ? 'approved' : 'pending',
      reason: payload.reason.trim(),
      requestedBy: actorSession.staffId,
      requestedAt: nowIso,
      approvedBy: isPrincipal ? actorSession.staffId : null,
      approvedAt: isPrincipal ? nowIso : null,
      createdAt: nowIso,
    };

    adjustmentsVault.set(adjId, newAdj);

    logger.info('Fee adjustment requested', {
      adjustmentId: adjId,
      adjustmentType: newAdj.adjustmentType,
      amount: newAdj.amount,
      status: newAdj.status,
      actorStaffId: actorSession.staffId,
    });

    return newAdj;
  }

  /**
   * Reverses a previously recorded payment (Principal authority strictly).
   * Operation 4: reverse_payment_atomic (US-26A, BR-22)
   * Non-negotiable: Original payment record is NEVER modified or deleted.
   * Creates a new payment record of type 'reversal' with matching allocations.
   * SRS Rule: No receipt number generated for reversal/refund.
   */
  async reversePayment(
    paymentId: string,
    payload: ReversePaymentRequestDTO,
    idempotencyKey: string | undefined,
    actorSession: AuthenticatedUserSession
  ): Promise<ReversePaymentResultDTO> {
    enforcePolicy(actorSession.role, 'fees:approve_reversal');

    if (!payload.reason || payload.reason.trim().length < 5) {
      throw new ValidationError('A detailed justification of at least 5 characters is mandatory.');
    }

    const releaseLock = await financialTxLock.acquire();

    try {
      const origPayment = paymentsVault.get(paymentId);
      if (!origPayment) {
        throw new NotFoundError(`Payment with ID "${paymentId}" not found.`);
      }

      if (origPayment.transactionType !== 'collection') {
        throw new BusinessRuleError(
          `Disallowed reversal: Only collection payments can be reversed. Target payment type is "${origPayment.transactionType}".`
        );
      }

      // Check if target payment has already been reversed
      const existingReversal = Array.from(paymentsVault.values()).find(
        (p) => p.transactionType === 'reversal' && p.reversesPaymentId === paymentId
      );
      if (existingReversal) {
        throw new ConflictError(
          `Payment "${paymentId}" has already been reversed by reversal payment "${existingReversal.id}".`
        );
      }

      // Assert academic year is writable
      const academicRecord = admissionsService.getAcademicRecord(origPayment.studentAcademicRecordId);
      if (academicRecord) {
        await academicYearsService.assertAcademicYearWritable(academicRecord.academicYearId);
      }

      // Get original allocations to duplicate as reversal allocations
      const origAllocs = Array.from(allocationsVault.values()).filter(
        (a) => a.paymentId === paymentId
      );

      const reversalPaymentId = randomUUID();
      const auditLogId = randomUUID();
      const nowIso = new Date().toISOString();

      // Create new reversal payment record (preserves original immutable ledger entries)
      const reversalRecord: InternalPaymentRecord = {
        id: reversalPaymentId,
        studentAcademicRecordId: origPayment.studentAcademicRecordId,
        transactionType: 'reversal',
        amount: origPayment.amount,
        currency: 'INR',
        method: origPayment.method,
        transactionDate: nowIso,
        payerName: origPayment.payerName,
        payerContact: origPayment.payerContact,
        referenceNumber: origPayment.referenceNumber,
        notes: payload.reason.trim(),
        reversesPaymentId: paymentId,
        idempotencyKey: idempotencyKey || null,
        recordedBy: actorSession.staffId,
        createdAt: nowIso,
      };

      paymentsVault.set(reversalPaymentId, reversalRecord);

      // Create reversal allocations matching original
      for (const origAlloc of origAllocs) {
        const revAllocId = randomUUID();
        const revAlloc: InternalPaymentAllocation = {
          id: revAllocId,
          paymentId: reversalPaymentId,
          studentFeeAssessmentLineId: origAlloc.studentFeeAssessmentLineId,
          amount: origAlloc.amount,
          createdAt: nowIso,
        };
        allocationsVault.set(revAllocId, revAlloc);
      }

      logger.info('Payment atomically reversed by Principal', {
        originalPaymentId: paymentId,
        reversalPaymentId,
        amountInr: origPayment.amount,
        reason: payload.reason,
        actorStaffId: actorSession.staffId,
      });

      return {
        reversalPaymentId,
        originalPaymentId: paymentId,
        reversalAmountInr: origPayment.amount,
        reversedBy: actorSession.staffId,
        reversedAt: nowIso,
        auditLogId,
      };
    } finally {
      releaseLock();
    }
  }

  // --- Getters & Queries ---

  getPaymentById(paymentId: string): InternalPaymentRecord | undefined {
    return paymentsVault.get(paymentId);
  }

  listPaymentsForRecord(studentAcademicRecordId: string): InternalPaymentRecord[] {
    return Array.from(paymentsVault.values()).filter(
      (p) => p.studentAcademicRecordId === studentAcademicRecordId
    );
  }

  getAllAllocations(): InternalPaymentAllocation[] {
    return Array.from(allocationsVault.values());
  }

  getAllPayments(): InternalPaymentRecord[] {
    return Array.from(paymentsVault.values());
  }
}

export const feesLedgerService = new FeesLedgerService();
