import { describe, it, expect, beforeEach } from 'vitest';
import { admissionsService } from '../src/modules/admissions/service';
import { documentsService } from '../src/modules/documents/service';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { toDecimalInrString } from '../src/modules/shared/types';
import { AuthorizationError } from '../src/lib/errors';
import { isAuthorizedForSensitivePii, maskAadhaar, maskBankAccount } from '../src/lib/crypto/pii';

describe('Admissions Privacy, PII Isolation & Authorization Boundary (US-03, R-06)', () => {
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

  const admissionOfficerSession: AuthenticatedUserSession = {
    staffId: 'adm-uuid',
    authUserId: 'adm-auth-uuid',
    email: 'admissions@school-demo.example',
    fullName: 'Demo Admission Officer',
    role: 'admission_officer',
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

  const sysAdminSession: AuthenticatedUserSession = {
    staffId: 'admin-uuid',
    authUserId: 'admin-auth-uuid',
    email: 'system.admin@school-demo.example',
    fullName: 'Demo System Admin',
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  const academicYearId = '00000000-0000-0000-0000-000000000001';
  const std1GradeId = '30000000-0000-0000-0000-000000000004';

  beforeEach(() => {
    admissionsService.resetForTesting();
    documentsService.resetForTesting();
  });

  it('exposes decrypted sensitive PII to Principal and Admission Officer (R-06)', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Sanvi',
          lastName: 'Gowda',
          dateOfBirth: '2020-06-18',
          gender: 'female',
          addressLine1: '21 Rajajinagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560010',
        },
        sensitiveDetails: {
          aadhaarNumber: '123456789012',
          caste: 'OBC',
          subCaste: 'Vokkaliga',
          annualFamilyIncome: toDecimalInrString('350000.00'),
          bankName: 'Canara Bank',
          accountNumber: '987654321098',
          ifscCode: 'CNRB0001234',
        },
        guardians: [
          {
            fullName: 'Manjunath Gowda',
            relationship: 'Father',
            mobileNumber: '+919876543210',
            annualIncomeInr: toDecimalInrString('350000.00'),
            residentialAddress: '21 Rajajinagar',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Admission Officer access: decrypted fields available
    const admView = await admissionsService.getApplicationById(app.id, admissionOfficerSession);
    expect(admView.sensitiveDetails?.aadhaarNumber).toBe('123456789012');
    expect(admView.sensitiveDetails?.accountNumber).toBe('987654321098');
    expect(admView.sensitiveDetails?.caste).toBe('OBC');
    expect(admView.guardians[0].annualIncomeInr).toBe('350000.00');

    // Principal access: decrypted fields available
    const princView = await admissionsService.getApplicationById(app.id, principalSession);
    expect(princView.sensitiveDetails?.aadhaarNumber).toBe('123456789012');
    expect(princView.sensitiveDetails?.accountNumber).toBe('987654321098');
  });

  it('strictly redacts / masks sensitive PII for Accounts Officer and System Admin (R-06, US-03 AC6)', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Karan',
          lastName: 'Kapoor',
          dateOfBirth: '2020-04-04',
          gender: 'male',
          addressLine1: '15 Lavelle Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        sensitiveDetails: {
          aadhaarNumber: '888877776666',
          caste: 'General',
          subCaste: 'Punjabi',
          annualFamilyIncome: toDecimalInrString('900000.00'),
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0000123',
        },
        guardians: [
          {
            fullName: 'Rajiv Kapoor',
            relationship: 'Father',
            mobileNumber: '+919988001122',
            annualIncomeInr: toDecimalInrString('900000.00'),
            residentialAddress: '15 Lavelle Road',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    // Accounts Officer access (ACC)
    const accView = await admissionsService.getApplicationById(app.id, accountantSession);
    expect(accView.sensitiveDetails?.aadhaarNumber).toBeUndefined(); // Prohibited
    expect(accView.sensitiveDetails?.accountNumber).toBeUndefined(); // Prohibited
    expect(accView.sensitiveDetails?.caste).toBeUndefined();         // Prohibited
    expect(accView.sensitiveDetails?.subCaste).toBeUndefined();      // Prohibited
    expect(accView.guardians[0].annualIncomeInr).toBeUndefined();   // Prohibited
    // Masked Aadhaar last 4 only
    expect(accView.sensitiveDetails?.aadhaarLastFour).toBe('••••-••••-6666');

    // System Administrator access (SYSADMIN)
    const sysView = await admissionsService.getApplicationById(app.id, sysAdminSession);
    expect(sysView.sensitiveDetails?.aadhaarNumber).toBeUndefined();
    expect(sysView.sensitiveDetails?.accountNumber).toBeUndefined();
    expect(sysView.guardians[0].annualIncomeInr).toBeUndefined();
    expect(sysView.sensitiveDetails?.aadhaarLastFour).toBe('••••-••••-6666');
  });

  it('blocks Accounts Officer and System Admin from generating document download URLs (403 Forbidden)', async () => {
    const app = await admissionsService.createDraftApplication(
      {
        academicYearId,
        gradeLevelId: std1GradeId,
        student: {
          firstName: 'Maya',
          lastName: 'Pai',
          dateOfBirth: '2020-01-01',
          gender: 'female',
          addressLine1: 'Test Address',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        guardians: [
          {
            fullName: 'Pai Parent',
            relationship: 'Mother',
            mobileNumber: '+919876543210',
            residentialAddress: 'Test Address',
            isPrimaryContact: true,
          },
        ],
      },
      admissionOfficerSession
    );

    const doc = await documentsService.uploadDocument(
      {
        studentId: app.studentId,
        admissionApplicationId: app.id,
        documentTypeId: '10000000-0000-0000-0000-000000000001',
        fileName: 'birth_cert.pdf',
        fileSizeBytes: 1024 * 100,
        mimeType: 'application/pdf',
      },
      admissionOfficerSession
    );

    // Admission Officer can download
    const admUrl = await documentsService.generateDownloadUrl(doc.id, admissionOfficerSession);
    expect(admUrl.downloadUrl).toContain('https://');
    expect(admUrl.expiresInSeconds).toBe(900);

    // Principal can download
    const princUrl = await documentsService.generateDownloadUrl(doc.id, principalSession);
    expect(princUrl.downloadUrl).toBeDefined();

    // Accounts Officer download attempt must be rejected with 403
    await expect(
      documentsService.generateDownloadUrl(doc.id, accountantSession)
    ).rejects.toThrow(AuthorizationError);

    // System Administrator download attempt must be rejected with 403
    await expect(
      documentsService.generateDownloadUrl(doc.id, sysAdminSession)
    ).rejects.toThrow(AuthorizationError);
  });

  it('rejects forged caller role and strictly evaluates server-side session authority', async () => {
    // An attacker claims role: 'principal' in body or parameter, but the session is 'accountant'
    expect(isAuthorizedForSensitivePii(accountantSession.role)).toBe(false);
    expect(isAuthorizedForSensitivePii(sysAdminSession.role)).toBe(false);
    expect(isAuthorizedForSensitivePii(principalSession.role)).toBe(true);
    expect(isAuthorizedForSensitivePii(admissionOfficerSession.role)).toBe(true);

    // Mask helper checks
    expect(maskAadhaar('1234')).toBe('••••-••••-1234');
    expect(maskBankAccount('9876543210')).toBe('••••••3210');
  });
});
