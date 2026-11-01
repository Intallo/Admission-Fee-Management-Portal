import { IIdentityRepository } from '../interfaces';
import { runWithSessionOrSystem, withSystemTransaction, withTransaction } from '../../db/postgres-pool';
import { AuthenticatedUserSession, StaffRole } from '../../../modules/identity-access/types';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class PostgresIdentityRepository implements IIdentityRepository {
  async getStaffByEmail(email: string): Promise<any | null> {
    return withSystemTransaction(async (client) => {
      const res = await client.query(
        `select id, email, role, full_name, phone, is_active, created_at, updated_at
         from public.staff_members
         where lower(email) = lower($1)`,
        [email.trim()]
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        phone: r.phone,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async getStaffById(staffId: string): Promise<any | null> {
    return withSystemTransaction(async (client) => {
      const res = await client.query(
        `select id, email, role, full_name, phone, is_active, created_at, updated_at
         from public.staff_members
         where id = $1`,
        [staffId]
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        phone: r.phone,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async getSecurityProfile(staffId: string): Promise<any | null> {
    return withSystemTransaction(async (client) => {
      const res = await client.query(
        `select staff_id, password_hash, must_change_password, failed_login_attempts,
                locked_until, last_login_at, password_changed_at
         from public.staff_security_profiles
         where staff_id = $1`,
        [staffId]
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        staffId: r.staff_id,
        passwordHash: r.password_hash,
        mustChangePassword: r.must_change_password,
        failedLoginAttempts: r.failed_login_attempts,
        lockedUntil: r.locked_until ? new Date(r.locked_until).getTime() : null,
        lastLoginAt: r.last_login_at,
        passwordChangedAt: r.password_changed_at ? new Date(r.password_changed_at).getTime() : undefined,
      };
    });
  }

  async recordLoginAttempt(staffId: string, success: boolean, lockedUntil?: number | null): Promise<void> {
    return withSystemTransaction(async (client) => {
      const nowIso = new Date().toISOString();
      const lockedUntilIso = lockedUntil ? new Date(lockedUntil).toISOString() : null;

      if (success) {
        await client.query(
          `update public.staff_security_profiles
           set failed_login_attempts = 0, locked_until = null, last_login_at = $1, updated_at = $1
           where staff_id = $2`,
          [nowIso, staffId]
        );
      } else {
        await client.query(
          `update public.staff_security_profiles
           set failed_login_attempts = failed_login_attempts + 1,
               locked_until = coalesce($1, locked_until),
               updated_at = $2
           where staff_id = $3`,
          [lockedUntilIso, nowIso, staffId]
        );
      }
    });
  }

  async updatePassword(staffId: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    return withSystemTransaction(async (client) => {
      const nowIso = new Date().toISOString();
      await client.query(
        `update public.staff_security_profiles
         set password_hash = $1, must_change_password = $2, password_changed_at = $3,
             failed_login_attempts = 0, locked_until = null, updated_at = $3
         where staff_id = $4`,
        [passwordHash, mustChangePassword, nowIso, staffId]
      );
    });
  }

  async listStaff(session?: AuthenticatedUserSession): Promise<any[]> {
    return runWithSessionOrSystem(session, async (client: any) => {
      const res = await client.query(
        `select id, email, role, full_name, phone, is_active, created_at, updated_at
         from public.staff_members
         order by created_at asc`
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        phone: r.phone,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    });
  }

  async createStaff(data: any, session?: AuthenticatedUserSession): Promise<any> {
    const runner = session ? (cb: any) => withTransaction(session, cb) : withSystemTransaction;
    return runner(async (client: any) => {
      const id = data.id || randomUUID();
      const nowIso = new Date().toISOString();
      await client.query(
        `insert into public.staff_members (id, email, role, full_name, phone, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, data.email.toLowerCase().trim(), data.role, data.fullName, data.phone || null, data.isActive ?? true, nowIso]
      );

      if (data.passwordHash) {
        await client.query(
          `insert into public.staff_security_profiles (staff_id, password_hash, must_change_password, created_at, updated_at)
           values ($1, $2, $3, $4, $4)`,
          [id, data.passwordHash, data.mustChangePassword ?? true, nowIso]
        );
      }

      return {
        id,
        email: data.email.toLowerCase().trim(),
        role: data.role,
        fullName: data.fullName,
        phone: data.phone || null,
        isActive: data.isActive ?? true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });
  }

  async updateStaff(staffId: string, data: any, session?: AuthenticatedUserSession): Promise<any> {
    const runner = session ? (cb: any) => withTransaction(session, cb) : withSystemTransaction;
    return runner(async (client: any) => {
      const nowIso = new Date().toISOString();
      const res = await client.query(
        `update public.staff_members
         set role = coalesce($1, role),
             full_name = coalesce($2, full_name),
             phone = coalesce($3, phone),
             is_active = coalesce($4, is_active),
             updated_at = $5
         where id = $6
         returning id, email, role, full_name, phone, is_active, created_at, updated_at`,
        [data.role || null, data.fullName || null, data.phone ?? null, data.isActive ?? null, nowIso, staffId]
      );
      if (res.rowCount === 0) {
        throw new NotFoundError(`Staff member "${staffId}" not found.`);
      }
      const r = res.rows[0];
      return {
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        phone: r.phone,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }
}
