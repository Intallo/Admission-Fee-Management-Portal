import { IIdentityRepository } from '../interfaces';
import { AuthenticatedUserSession, StaffMemberDTO, StaffRole } from '../../../modules/identity-access/types';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export interface InMemorySecurityProfile {
  staffId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: number | null;
  lastLoginAt: string | null;
  passwordChangedAt?: number;
}

export class InMemoryIdentityRepository implements IIdentityRepository {
  private staffVault = new Map<string, StaffMemberDTO>();
  private securityProfiles = new Map<string, InMemorySecurityProfile>();
  private revokedSessions = new Map<string, number>();

  resetForTesting(): void {
    this.staffVault.clear();
    this.securityProfiles.clear();
    this.revokedSessions.clear();
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    if (!sessionId) return true;
    const expiresAt = this.revokedSessions.get(sessionId);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.revokedSessions.delete(sessionId);
      return false;
    }
    return true;
  }

  async revokeSession(sessionId: string, expiresAt: number): Promise<void> {
    if (!sessionId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
    this.revokedSessions.set(sessionId, expiresAt);
  }

  async getStaffByEmail(email: string): Promise<any | null> {
    const normalized = email.toLowerCase().trim();
    for (const staff of this.staffVault.values()) {
      if (staff.email.toLowerCase() === normalized) {
        return staff;
      }
    }
    return null;
  }

  async getStaffById(staffId: string): Promise<any | null> {
    return this.staffVault.get(staffId) || null;
  }

  async getSecurityProfile(staffId: string): Promise<any | null> {
    return this.securityProfiles.get(staffId) || null;
  }

  async recordLoginAttempt(staffId: string, success: boolean, lockedUntil?: number | null): Promise<void> {
    const prof = this.securityProfiles.get(staffId);
    if (!prof) return;

    if (success) {
      prof.failedLoginAttempts = 0;
      prof.lockedUntil = null;
      prof.lastLoginAt = new Date().toISOString();
    } else {
      prof.failedLoginAttempts += 1;
      if (lockedUntil !== undefined) {
        prof.lockedUntil = lockedUntil;
      }
    }
    this.securityProfiles.set(staffId, prof);
  }

  async updatePassword(staffId: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    const prof = this.securityProfiles.get(staffId);
    if (prof) {
      prof.passwordHash = passwordHash;
      prof.mustChangePassword = mustChangePassword;
      prof.passwordChangedAt = Date.now();
      prof.failedLoginAttempts = 0;
      prof.lockedUntil = null;
      this.securityProfiles.set(staffId, prof);
    }
  }

  async listStaff(_session?: AuthenticatedUserSession): Promise<any[]> {
    return Array.from(this.staffVault.values());
  }

  async createStaff(data: any, _session?: AuthenticatedUserSession): Promise<any> {
    const id = data.id || randomUUID();
    const nowIso = new Date().toISOString();
    const staff: StaffMemberDTO = {
      id,
      authUserId: null,
      email: data.email.toLowerCase().trim(),
      role: data.role as StaffRole,
      fullName: data.fullName,
      isActive: data.isActive ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.staffVault.set(id, staff);

    if (data.passwordHash) {
      this.securityProfiles.set(id, {
        staffId: id,
        passwordHash: data.passwordHash,
        mustChangePassword: data.mustChangePassword ?? true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      });
    }

    return staff;
  }

  async updateStaff(staffId: string, data: any, _session?: AuthenticatedUserSession): Promise<any> {
    const existing = this.staffVault.get(staffId);
    if (!existing) {
      throw new NotFoundError(`Staff member "${staffId}" not found.`);
    }

    const updated: StaffMemberDTO = {
      ...existing,
      ...data,
      email: data.email ? data.email.toLowerCase().trim() : existing.email,
      updatedAt: new Date().toISOString(),
    };
    this.staffVault.set(staffId, updated);
    return updated;
  }

  async ensureSecurityProfile(
    staffId: string,
    passwordHash: string,
    mustChangePassword: boolean = false,
    _session?: AuthenticatedUserSession
  ): Promise<void> {
    const existing = this.securityProfiles.get(staffId);
    this.securityProfiles.set(staffId, {
      staffId,
      passwordHash,
      mustChangePassword,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: existing?.lastLoginAt || null,
    });
  }
}
