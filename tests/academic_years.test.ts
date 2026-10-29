import { describe, it, expect } from 'vitest';
import { academicYearsService } from '../src/modules/academic-years/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { BusinessRuleError, AuthorizationError, ValidationError } from '../src/lib/errors';

describe('Academic Years Lifecycle & Closed-Year Protections (SBR-05)', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: 'principal-uuid',
    authUserId: 'principal-auth-uuid',
    email: 'principal@school-demo.example',
    fullName: 'Demo Principal',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: 'acc-uuid',
    authUserId: 'acc-auth-uuid',
    email: 'accounts@school-demo.example',
    fullName: 'Demo Accountant',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  it('lists existing academic years with their calendar states', async () => {
    const years = await academicYearsService.listAcademicYears();
    expect(years.length).toBeGreaterThanOrEqual(2);

    const closedYear = years.find((y) => y.status === 'closed');
    const currentYear = years.find((y) => y.status === 'current');

    expect(closedYear).toBeDefined();
    expect(currentYear).toBeDefined();
  });

  it('allows Principal to create a new academic year in planning state', async () => {
    const created = await academicYearsService.createAcademicYear(
      {
        label: '2028-2029',
        startDate: '2028-06-01',
        endDate: '2029-05-31',
        notes: 'Future planning cycle',
      },
      principalSession
    );

    expect(created.status).toBe('planning');
    expect(created.label).toBe('2028-2029');
  });

  it('prohibits non-authorized roles (e.g. Accounts Officer) from creating academic years', async () => {
    await expect(
      academicYearsService.createAcademicYear(
        {
          label: '2029-2030',
          startDate: '2029-06-01',
          endDate: '2030-05-31',
        },
        accountantSession
      )
    ).rejects.toThrow(AuthorizationError);
  });

  it('rejects academic year creation when start date is on or after end date', async () => {
    await expect(
      academicYearsService.createAcademicYear(
        {
          label: '2031-2032',
          startDate: '2031-06-01',
          endDate: '2031-05-31', // Inverted dates
        },
        principalSession
      )
    ).rejects.toThrow(ValidationError);
  });

  it('rejects academic year creation with overlapping date ranges (SBR-05)', async () => {
    // Attempt to overlap with 2026-2027 (2026-06-01 to 2027-05-31)
    await expect(
      academicYearsService.createAcademicYear(
        {
          label: '2026-Midyear-Overlap',
          startDate: '2026-10-01',
          endDate: '2027-03-31',
        },
        principalSession
      )
    ).rejects.toThrow(/overlaps with existing academic year/);
  });

  it('allows Principal to formally close an academic year', async () => {
    // 2026-2027 is current; closing it must transition status to closed
    const currentYearId = '00000000-0000-0000-0000-000000000001';
    const closed = await academicYearsService.closeAcademicYear(
      currentYearId,
      principalSession
    );

    expect(closed.status).toBe('closed');
  });

  it('prohibits non-Principal from closing an academic year', async () => {
    const currentYearId = '00000000-0000-0000-0000-000000000001';
    await expect(
      academicYearsService.closeAcademicYear(currentYearId, accountantSession)
    ).rejects.toThrow(AuthorizationError);
  });

  describe('Closed-Year Write Protections (Strict Invariant)', () => {
    it('assertAcademicYearWritable blocks any write mutation against a closed academic year', async () => {
      // 2025-2026 is closed
      const closedYearId = '00000000-0000-0000-0000-000000000000';

      await expect(
        academicYearsService.assertAcademicYearWritable(closedYearId)
      ).rejects.toThrow(BusinessRuleError);

      await expect(
        academicYearsService.assertAcademicYearWritable(closedYearId)
      ).rejects.toThrow(/is closed and strictly read-only/);
    });
  });
});
