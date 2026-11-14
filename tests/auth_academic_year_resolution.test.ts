import { describe, it, expect, beforeEach } from 'vitest';
import { identityService, initializeDemoCredentials } from '../src/modules/identity-access/service';
import { getRepositories } from '../src/infrastructure/repositories';
import { verifySessionToken } from '../src/lib/auth/token';

describe('Auth Dynamic Academic Year Resolution', () => {
  beforeEach(async () => {
    identityService.resetForTesting();
    await initializeDemoCredentials();
  });

  it('resolves the current active academic year from repository upon login', async () => {
    const loginResult = await identityService.login('principal@school-demo.example', 'School@2026!');
    expect(loginResult.user).toBeDefined();

    // Verify payload returned and token payload match the active academic year
    expect(loginResult.activeAcademicYearId).toBe('00000000-0000-0000-0000-000000000001');
    expect(loginResult.activeAcademicYearLabel).toBe('2026-2027');

    const verified = verifySessionToken(loginResult.token);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.session.activeAcademicYearId).toBe('00000000-0000-0000-0000-000000000001');
      expect(verified.session.activeAcademicYearLabel).toBe('2026-2027');
    }
  });

  it('dynamically adapts when a different academic year is marked current', async () => {
    const ayRepo = getRepositories().academicYears;
    await ayRepo.createAcademicYear({
      label: '2027-2028',
      startDate: '2027-06-01',
      endDate: '2028-05-31',
      status: 'current',
      notes: 'Next active school year',
    });

    const loginResult = await identityService.login('principal@school-demo.example', 'School@2026!');
    expect(loginResult.activeAcademicYearLabel).toBe('2027-2028');

    const verified = verifySessionToken(loginResult.token);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.session.activeAcademicYearLabel).toBe('2027-2028');
    }
  });

  it('fails closed when no academic year is marked current', async () => {
    const ayRepo = getRepositories().academicYears;
    const originalListAcademicYears = ayRepo.listAcademicYears.bind(ayRepo);
    ayRepo.listAcademicYears = async () => [];

    try {
      await expect(
        identityService.login('principal@school-demo.example', 'School@2026!')
      ).rejects.toThrow(/No active academic year found with status "current"/);
    } finally {
      ayRepo.listAcademicYears = originalListAcademicYears;
    }
  });
});
