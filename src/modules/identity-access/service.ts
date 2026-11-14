import { randomUUID } from 'crypto';
import { StaffRole, StaffMemberDTO, AuthenticatedUserSession } from './types';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../lib/auth/password';
import { signSessionToken, SessionPayload, MAX_SESSION_LIFETIME_MS } from '../../lib/auth/token';
import { checkLockout, recordFailedAttempt, recordSuccessfulLogin, resetLockout } from '../../lib/auth/lockout';
import { AuthenticationError, AuthorizationError, ValidationError, NotFoundError, BusinessRuleError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { enforcePolicy } from '../../policy/guards';
import { IIdentityRepository } from '../../infrastructure/repositories/interfaces';
import { getRepositories } from '../../infrastructure/repositories/registry';
import { PROTECTED_REMOTE_REF } from '../../lib/env';

// Seed default credentials for standard demo accounts (Password: "School@2026!")
const DEFAULT_DEMO_PASSWORD = 'School@2026!';
let demoAccountsInitialized = false;

export async function initializeDemoCredentials(repo?: IIdentityRepository): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY VIOLATION] Demo account credential initialization is strictly forbidden in production environments.'
    );
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(PROTECTED_REMOTE_REF)) {
    throw new Error(
      `[SECURITY VIOLATION] Demo account credential initialization cannot target retained remote database (${PROTECTED_REMOTE_REF}).`
    );
  }

  const repository = repo ?? getRepositories().identity;
  const defaultHash = await hashPassword(DEFAULT_DEMO_PASSWORD);

  const demoAccounts = [
    { email: 'system.admin@school-demo.example', role: 'system_admin' as StaffRole, fullName: 'Demo System Administrator', mustChange: true },
    { email: 'principal@school-demo.example', role: 'principal' as StaffRole, fullName: 'Demo Principal', mustChange: false },
    { email: 'admissions@school-demo.example', role: 'admission_officer' as StaffRole, fullName: 'Demo Admission Officer', mustChange: false },
    { email: 'clerk@school-demo.example', role: 'clerk' as StaffRole, fullName: 'Demo Clerk', mustChange: false },
    { email: 'accounts@school-demo.example', role: 'accountant' as StaffRole, fullName: 'Demo Accountant', mustChange: false },
  ];

  // Resolve or initialize system admin staff member first to establish a legitimate system_admin actor session
  const adminAccount = demoAccounts[0];
  let existingAdmin = await repository.getStaffByEmail(adminAccount.email);
  const adminId = existingAdmin ? existingAdmin.id : randomUUID();

  const bootstrapSession: AuthenticatedUserSession = {
    staffId: adminId,
    authUserId: adminId,
    email: adminAccount.email,
    fullName: adminAccount.fullName,
    role: 'system_admin',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-2027',
  };

  if (!existingAdmin) {
    existingAdmin = await repository.createStaff({
      id: adminId,
      email: adminAccount.email.toLowerCase(),
      role: adminAccount.role,
      fullName: adminAccount.fullName,
      passwordHash: defaultHash,
      mustChangePassword: adminAccount.mustChange,
      isActive: true,
    }, bootstrapSession);
  }

  for (const acc of demoAccounts) {
    let staffRecord = (acc.email === adminAccount.email) ? existingAdmin : await repository.getStaffByEmail(acc.email);
    if (!staffRecord) {
      staffRecord = await repository.createStaff({
        id: randomUUID(),
        email: acc.email.toLowerCase(),
        role: acc.role,
        fullName: acc.fullName,
        passwordHash: defaultHash,
        mustChangePassword: acc.mustChange,
        isActive: true,
      }, bootstrapSession);
    } else {
      // Check if existing demo staff has missing or invalid demo password hash
      const secProfile = await repository.getSecurityProfile(staffRecord.id, acc.email);
      const isPasswordValid = secProfile?.passwordHash
        ? await verifyPassword(DEFAULT_DEMO_PASSWORD, secProfile.passwordHash)
        : false;

      // Only auto-heal if account has never logged in or customized their password, and hash is invalid
      if (!secProfile || (!isPasswordValid && !secProfile.lastLoginAt)) {
        if (repository.ensureSecurityProfile) {
          await repository.ensureSecurityProfile(
            staffRecord.id,
            defaultHash,
            acc.mustChange,
            bootstrapSession
          );
        }
      }
    }
  }

  demoAccountsInitialized = true;
}

export class IdentityService {
  private customRepo?: IIdentityRepository;

  constructor(repo?: IIdentityRepository) {
    this.customRepo = repo;
  }

  private get repo(): IIdentityRepository {
    return this.customRepo ?? getRepositories().identity;
  }

  resetForTesting(): void {
    demoAccountsInitialized = false;
    this.repo.resetForTesting?.();
  }

  private async resolveActiveAcademicYear(): Promise<{ id: string; label: string }> {
    let activeYearId = '00000000-0000-0000-0000-000000000001';
    let activeYearLabel = '2026-2027';
    try {
      const years = await getRepositories().academicYears.listAcademicYears();
      const currentYear = years.find((y) => y.status === 'current') || years[0];
      if (currentYear) {
        activeYearId = currentYear.id;
        activeYearLabel = currentYear.label;
      }
    } catch (ayError) {
      logger.warn('Failed to resolve active academic year, falling back to default', {
        error: String(ayError),
      });
    }
    return { id: activeYearId, label: activeYearLabel };
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    return this.repo.isSessionRevoked(sessionId);
  }

  async revokeSession(sessionId: string, expiresAt: number): Promise<void> {
    return this.repo.revokeSession(sessionId, expiresAt);
  }

  /**
   * Authenticates staff user credentials with 5-attempt/15-minute lockout enforcement.
   * Guarantees that browser-supplied roles or IDs cannot override trusted session identity.
   */
  async login(
    email: string,
    plaintextPassword: string,
    metadata?: { ip?: string; correlationId?: string }
  ): Promise<{
    user: StaffMemberDTO;
    token: string;
    mustChangePassword: boolean;
    activeAcademicYearId: string;
    activeAcademicYearLabel: string;
  }> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check user-specific lockout status (US-01 AC3)
    const lockout = checkLockout(normalizedEmail);
    if (lockout.isLocked) {
      logger.warn('Login rejected: account is locked', {
        email: normalizedEmail,
        remainingMinutes: lockout.remainingMinutes,
        correlationId: metadata?.correlationId,
      });
      throw new AuthenticationError(
        `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after ${lockout.remainingMinutes} minute(s).`
      );
    }

    // 2. Lookup staff profile from repository
    const staffRecord = await this.repo.getStaffByEmail(normalizedEmail);
    const secRecord = staffRecord ? await this.repo.getSecurityProfile(staffRecord.id, normalizedEmail) : null;

    // Check DB-persisted lockout
    if (secRecord && secRecord.lockedUntil && Date.now() < secRecord.lockedUntil) {
      const remainingMinutes = Math.ceil((secRecord.lockedUntil - Date.now()) / (60 * 1000));
      logger.warn('Login rejected: account is locked in database', {
        email: normalizedEmail,
        remainingMinutes,
        correlationId: metadata?.correlationId,
      });
      throw new AuthenticationError(
        `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after ${remainingMinutes} minute(s).`
      );
    }

    // Generic invalid credential check if account does not exist (prevent enumeration)
    if (!staffRecord || !secRecord) {
      recordFailedAttempt(normalizedEmail);
      logger.warn('Login failed: user not found', { email: normalizedEmail, correlationId: metadata?.correlationId });
      throw new AuthenticationError('Invalid email or password.');
    }

    // Inactive account check (US-04 AC1)
    if (!staffRecord.isActive) {
      logger.warn('Login rejected: staff account is deactivated', {
        staffId: staffRecord.id,
        email: normalizedEmail,
        correlationId: metadata?.correlationId,
      });
      throw new AuthenticationError('Account has been deactivated. Please contact the administrator.');
    }

    // 3. Verify password hash
    const passwordValid = await verifyPassword(plaintextPassword, secRecord.passwordHash);

    if (!passwordValid) {
      const result = recordFailedAttempt(normalizedEmail);
      const attempts = Math.max((secRecord.failedLoginAttempts || 0) + 1, result.failedAttempts);
      const isNowLocked = result.isNowLocked || attempts >= 5;
      const lockUntil = isNowLocked ? Date.now() + 15 * 60 * 1000 : null;

      await this.repo.recordLoginAttempt(staffRecord.id, false, lockUntil);

      logger.warn('Login failed: invalid password', {
        email: normalizedEmail,
        consecutiveFailedAttempts: attempts,
        correlationId: metadata?.correlationId,
      });

      if (isNowLocked) {
        throw new AuthenticationError(
          `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after 15 minutes.`
        );
      }

      throw new AuthenticationError('Invalid email or password.');
    }

    // Concurrency guard: re-verify lockout in case a concurrent attempt locked the account
    const postVerifyLockout = checkLockout(normalizedEmail);
    if (postVerifyLockout.isLocked) {
      throw new AuthenticationError(
        `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after ${postVerifyLockout.remainingMinutes} minute(s).`
      );
    }

    // Successful login: reset failed attempts using authenticated self-session
    recordSuccessfulLogin(normalizedEmail);

    // Resolve active academic year dynamically from authoritative repository
    const { id: activeYearId, label: activeYearLabel } = await this.resolveActiveAcademicYear();

    const selfSession: AuthenticatedUserSession = {
      staffId: staffRecord.id,
      authUserId: staffRecord.authUserId || staffRecord.id,
      email: staffRecord.email,
      fullName: staffRecord.fullName,
      role: staffRecord.role,
      isActive: true,
      activeAcademicYearId: activeYearId,
      activeAcademicYearLabel: activeYearLabel,
    };
    await this.repo.recordLoginAttempt(staffRecord.id, true, null, selfSession);

    const nowMs = Date.now();
    const sessionPayload: SessionPayload = {
      sessionId: randomUUID(),
      staffId: staffRecord.id,
      authUserId: null,
      email: staffRecord.email,
      fullName: staffRecord.fullName,
      role: staffRecord.role,
      isActive: true,
      activeAcademicYearId: activeYearId,
      activeAcademicYearLabel: activeYearLabel,
      mustChangePassword: secRecord.mustChangePassword,
      createdAt: nowMs,
      lastActivityAt: nowMs,
      expiresAt: nowMs + MAX_SESSION_LIFETIME_MS,
    };

    const token = signSessionToken(sessionPayload);

    logger.info('User successfully authenticated', {
      staffId: staffRecord.id,
      role: staffRecord.role,
      correlationId: metadata?.correlationId,
    });

    return {
      user: {
        id: staffRecord.id,
        authUserId: null,
        fullName: staffRecord.fullName,
        email: staffRecord.email,
        role: staffRecord.role,
        isActive: staffRecord.isActive,
        createdAt: staffRecord.createdAt,
        updatedAt: staffRecord.updatedAt,
      },
      token,
      mustChangePassword: secRecord.mustChangePassword,
      activeAcademicYearId: activeYearId,
      activeAcademicYearLabel: activeYearLabel,
    };
  }

  /**
   * First-login or user-initiated password change.
   */
  async changePassword(
    staffId: string,
    currentPassword: string,
    newPassword: string,
    actorEmail: string
  ): Promise<{ success: boolean; message: string }> {
    const staff = await this.repo.getStaffByEmail(actorEmail.toLowerCase());
    if (!staff) {
      throw new NotFoundError('Security profile not found for staff user.');
    }
    const secRecord = await this.repo.getSecurityProfile(staff.id, staff.email);
    if (!secRecord) {
      throw new NotFoundError('Security profile not found for staff user.');
    }

    // 1. Validate new password strength per US-04 AC3 first
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new ValidationError(`Password does not meet complexity requirements: ${strength.errors.join('; ')}`);
    }

    // 2. Verify current password
    const valid = await verifyPassword(currentPassword, secRecord.passwordHash);
    if (!valid) {
      throw new AuthenticationError('Current password is incorrect.');
    }

    // Authenticated self-session for authorized password change
    const { id: activeYearId, label: activeYearLabel } = await this.resolveActiveAcademicYear();
    const selfSession: AuthenticatedUserSession = {
      staffId: staff.id,
      authUserId: staff.authUserId || staff.id,
      email: staff.email,
      fullName: staff.fullName,
      role: staff.role,
      isActive: staff.isActive,
      activeAcademicYearId: activeYearId,
      activeAcademicYearLabel: activeYearLabel,
    };

    // Hash and persist new password
    const newHash = await hashPassword(newPassword);
    await this.repo.updatePassword(staff.id, newHash, false, selfSession);

    logger.info('Staff password changed successfully', { staffId, email: actorEmail });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }

  /**
   * Administrative password reset by System Administrator.
   */
  async adminResetPassword(
    targetStaffEmail: string,
    actorSession: AuthenticatedUserSession
  ): Promise<{ temporaryPassword: string }> {
    enforcePolicy(actorSession.role, 'users:manage_accounts');

    const normalized = targetStaffEmail.trim().toLowerCase();
    const staff = await this.repo.getStaffByEmail(normalized);
    if (!staff) {
      throw new NotFoundError(`Staff member "${normalized}" not found.`);
    }

    const temporaryPassword = `Temp@${randomUUID().substring(0, 8)}!`;
    const newHash = await hashPassword(temporaryPassword);

    await this.repo.updatePassword(staff.id, newHash, true, actorSession);
    resetLockout(normalized);

    logger.info('Staff password reset triggered by admin', {
      targetEmail: normalized,
      actorStaffId: actorSession.staffId,
    });

    return { temporaryPassword };
  }

  /**
   * Creates a new staff member directory entry with default credentials (SYSADMIN only).
   */
  async createStaffMember(
    data: { fullName: string; email: string; role: StaffRole },
    actorSession: AuthenticatedUserSession
  ): Promise<{ staff: StaffMemberDTO; temporaryPassword: string }> {
    enforcePolicy(actorSession.role, 'users:manage_accounts');

    const normalizedEmail = data.email.trim().toLowerCase();
    const tempPassword = `School@${randomUUID().substring(0, 6)}!`;
    const passwordHash = await hashPassword(tempPassword);

    const staffId = randomUUID();

    const created = await this.repo.createStaff(
      {
        id: staffId,
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        role: data.role,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      },
      actorSession
    );

    logger.info('Staff member created', {
      staffId,
      email: normalizedEmail,
      role: data.role,
      actorStaffId: actorSession.staffId,
    });

    return {
      staff: created,
      temporaryPassword: tempPassword,
    };
  }

  /**
   * Deactivates or updates staff account role (SYSADMIN only).
   */
  async updateStaffMember(
    targetStaffId: string,
    updates: { role?: StaffRole; isActive?: boolean },
    actorSession: AuthenticatedUserSession
  ): Promise<void> {
    enforcePolicy(actorSession.role, 'users:manage_accounts');

    // Prevent system administrator from deactivating themselves
    if (targetStaffId === actorSession.staffId && updates.isActive === false) {
      throw new BusinessRuleError('System Administrators cannot deactivate their own account.');
    }

    await this.repo.updateStaff(targetStaffId, updates, actorSession);

    logger.info('Staff member updated', {
      targetStaffId,
      updates,
      actorStaffId: actorSession.staffId,
    });
  }
}

export const identityService = new IdentityService();
