import { describe, it, expect, beforeEach } from 'vitest';
import { feeConfigurationService } from '../src/modules/fee-configuration/service';
import { academicYearsService } from '../src/modules/academic-years/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { AuthorizationError, BusinessRuleError, ConflictError, ValidationError } from '../src/lib/errors';
import { toDecimalInrString } from '../src/modules/shared/types';

describe('Phase 5: Fee Configuration & Approval Lifecycle (US-17, US-18, REG-05)', () => {
  const currentYearId = '00000000-0000-0000-0000-000000000001'; // 2026-2027 (current)
  const closedYearId = '00000000-0000-0000-0000-000000000000';  // 2025-2026 (closed)
  const std1GradeId = '30000000-0000-0000-0000-000000000004';   // STD 1
  const std2GradeId = '30000000-0000-0000-0000-000000000005';   // STD 2

  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: 'auth-principal',
    email: 'principal@school-demo.example',
    fullName: 'Dr. Ramesh Kulkarni (Principal)',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: 'auth-accountant',
    email: 'accounts@school-demo.example',
    fullName: 'Sunil Rao (Accounts Officer)',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: 'auth-adm',
    email: 'admissions@school-demo.example',
    fullName: 'Suma Patil (Admission Officer)',
    role: 'admission_officer',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  const sysAdminSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: 'auth-sysadmin',
    email: 'admin@school-demo.example',
    fullName: 'System Operator',
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: currentYearId,
    activeAcademicYearLabel: '2026-2027',
  };

  beforeEach(() => {
    feeConfigurationService.resetForTesting();
  });

  describe('Fee Heads & Categories (DEC-10, US-17)', () => {
    it('lists seeded fee heads across school_fee, books, and vehicle categories', async () => {
      const heads = await feeConfigurationService.listFeeHeads();
      expect(heads.length).toBeGreaterThanOrEqual(6);

      const tuition = heads.find((h) => h.code === 'TUITION_FEE');
      expect(tuition).toBeDefined();
      expect(tuition?.category).toBe('school_fee');
      expect(tuition?.isVariable).toBe(false);

      const admissionFee = heads.find((h) => h.code === 'ADMISSION_FEE');
      expect(admissionFee).toBeDefined();
      expect(admissionFee?.category).toBe('school_fee');
      expect(admissionFee?.isVariable).toBe(true);

      const books = heads.find((h) => h.code === 'BOOKS');
      expect(books).toBeDefined();
      expect(books?.category).toBe('books');

      const bus = heads.find((h) => h.code === 'SCHOOL_BUS');
      expect(bus).toBeDefined();
      expect(bus?.category).toBe('vehicle');
    });

    it('allows Accounts Officer to create a new fee head', async () => {
      const newHead = await feeConfigurationService.createFeeHead(
        {
          code: 'LAB_FEE',
          name: 'Science Laboratory Fee',
          category: 'school_fee',
          isVariable: false,
        },
        accountantSession
      );

      expect(newHead.code).toBe('LAB_FEE');
      expect(newHead.category).toBe('school_fee');
      expect(newHead.isActive).toBe(true);

      const fetched = await feeConfigurationService.getFeeHeadById(newHead.id);
      expect(fetched.name).toBe('Science Laboratory Fee');
    });

    it('rejects duplicate fee head code', async () => {
      await expect(
        feeConfigurationService.createFeeHead(
          {
            code: 'TUITION_FEE',
            name: 'Another Tuition',
            category: 'school_fee',
          },
          accountantSession
        )
      ).rejects.toThrow(ConflictError);
    });

    it('denies Admission Officer or SysAdmin from creating fee heads', async () => {
      await expect(
        feeConfigurationService.createFeeHead(
          { code: 'SPORTS_FEE', name: 'Sports Fee', category: 'school_fee' },
          admissionOfficerSession
        )
      ).rejects.toThrow(AuthorizationError);

      await expect(
        feeConfigurationService.createFeeHead(
          { code: 'SPORTS_FEE', name: 'Sports Fee', category: 'school_fee' },
          sysAdminSession
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Fee Structures & Approval Workflow (REG-05, US-18)', () => {
    it('allows Accounts Officer to create a draft fee structure for a standard', async () => {
      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;
      const devHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'DEVELOPMENT_FEE'
      )!;

      const draft = await feeConfigurationService.createFeeStructure(
        {
          academicYearId: currentYearId,
          gradeLevelId: std2GradeId,
          lines: [
            { feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('16000.00') },
            { feeHeadId: devHead.id, defaultAmount: toDecimalInrString('2500.00') },
          ],
        },
        accountantSession
      );

      expect(draft.status).toBe('draft');
      expect(draft.version).toBe(1);
      expect(draft.totalFixedAmountInr).toBe('18500.00');
      expect(draft.approvedBy).toBeNull();
      expect(draft.approvedAt).toBeNull();
    });

    it('strictly forbids non-Principal roles from approving fee structures (REG-05)', async () => {
      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;

      const draft = await feeConfigurationService.createFeeStructure(
        {
          academicYearId: currentYearId,
          gradeLevelId: std2GradeId,
          lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('15000.00') }],
        },
        accountantSession
      );

      // Accounts Officer cannot approve
      await expect(
        feeConfigurationService.approveFeeStructure(draft.id, accountantSession)
      ).rejects.toThrow(AuthorizationError);

      // Admission Officer cannot approve
      await expect(
        feeConfigurationService.approveFeeStructure(draft.id, admissionOfficerSession)
      ).rejects.toThrow(AuthorizationError);

      // System Administrator cannot approve
      await expect(
        feeConfigurationService.approveFeeStructure(draft.id, sysAdminSession)
      ).rejects.toThrow(AuthorizationError);
    });

    it('allows Principal to formally approve fee structure and retires previous version', async () => {
      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;

      // Create v2 draft for STD1
      const draftV2 = await feeConfigurationService.createFeeStructure(
        {
          academicYearId: currentYearId,
          gradeLevelId: std1GradeId,
          lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('15000.00') }],
        },
        accountantSession
      );

      // Check current approved structure is v1
      const v1Before = await feeConfigurationService.getApprovedFeeStructureForGrade(
        currentYearId,
        std1GradeId
      );
      expect(v1Before?.version).toBe(1);

      // Principal approves v2
      const approvedV2 = await feeConfigurationService.approveFeeStructure(
        draftV2.id,
        principalSession
      );
      expect(approvedV2.status).toBe('approved');
      expect(approvedV2.approvedBy).toBe(principalSession.staffId);
      expect(approvedV2.approvedAt).not.toBeNull();

      // v1 is now automatically retired
      const v1After = await feeConfigurationService.getFeeStructureById(v1Before!.id);
      expect(v1After.status).toBe('retired');

      // The new approved structure for STD1 is v2
      const currentApproved = await feeConfigurationService.getApprovedFeeStructureForGrade(
        currentYearId,
        std1GradeId
      );
      expect(currentApproved?.id).toBe(draftV2.id);
    });

    it('blocks fee structure creation in a closed academic year (SBR-05 / BR-39)', async () => {
      const tuitionHead = (await feeConfigurationService.listFeeHeads()).find(
        (h) => h.code === 'TUITION_FEE'
      )!;

      await expect(
        feeConfigurationService.createFeeStructure(
          {
            academicYearId: closedYearId,
            gradeLevelId: std2GradeId,
            lines: [{ feeHeadId: tuitionHead.id, defaultAmount: toDecimalInrString('10000.00') }],
          },
          accountantSession
        )
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('Locations & Transport Tariffs (REG-06, US-19, BR-15)', () => {
    it('lists configured transport tariffs for places', async () => {
      const rates = await feeConfigurationService.listTransportRates(currentYearId);
      expect(rates.length).toBeGreaterThanOrEqual(3);

      const hebbal = rates.find((r) => r.placeName === 'Hebbal');
      expect(hebbal).toBeDefined();
      expect(hebbal?.rateAmount).toBe('6000.00');
      expect(hebbal?.mode).toBe('school_bus');
    });

    it('allows Accounts Officer to add a new transport route place', async () => {
      const newRoute = await feeConfigurationService.createTransportRate(
        {
          academicYearId: currentYearId,
          placeName: 'Whitefield',
          mode: 'school_bus',
          rateAmount: toDecimalInrString('12500.00'),
        },
        accountantSession
      );

      expect(newRoute.placeName).toBe('Whitefield');
      expect(newRoute.rateAmount).toBe('12500.00');
      expect(newRoute.isActive).toBe(true);
    });
  });
});
