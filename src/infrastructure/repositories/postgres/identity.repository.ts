import { IIdentityRepository } from '../interfaces';
import { withSystemTransaction, withTransaction } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession, StaffRole } from '../../../modules/identity-access/types';
import { AuthorizationError, NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class PostgresIdentityRepository implements IIdentityRepository {
  async getStaffByEmail(
    email: string,
    existingClient?: PoolClient
  ): Promise<any | null> {
    return withSystemTransaction(async (client) => {
      const res = await client.query(
        `select id, email, role, full_name, is_active, active_academic_year_id
         from private.auth_lookup_staff_by_email($1)`,
        [email.trim()]
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        isActive: r.is_active,
        activeAcademicYearId: r.active_academic_year_id,
      };
    }, existingClient);
  }

  async getStaffById(
    staffId: string,
    existingClient?: PoolClient
  ): Promise<any | null> {
    return withSystemTransaction(async (client) => {
      const res = await client.query(
        `select id, email, role, full_name, is_active, active_academic_year_id
         from private.auth_lookup_staff_by_id($1)`,
        [staffId]
      );
      if (res.rowCount === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        email: r.email,
        role: r.role as StaffRole,
        fullName: r.full_name,
        isActive: r.is_active,
        activeAcademicYearId: r.active_academic_year_id,
      };
    }, existingClient);
  }

  async getSecurityProfile(
    staffId: string,
    email?: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any | null> {
    const executeQuery = async (client: any) => {
      const res = await client.query(
        `select staff_id, password_hash, must_change_password, failed_login_attempts,
                locked_until, last_login_at
         from private.auth_get_security_profile($1, $2)`,
        [staffId, email ? email.trim().toLowerCase() : null]
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
      };
    };

    if (session && session.staffId) {
      return withTransaction(session, executeQuery, existingClient);
    }
    return withSystemTransaction(executeQuery, existingClient);
  }

  async recordLoginAttempt(
    staffId: string,
    success: boolean,
    lockedUntil?: number | null,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<void> {
    const lockedUntilIso = lockedUntil ? new Date(lockedUntil).toISOString() : null;
    const executeQuery = async (client: any) => {
      await client.query(
        `select private.auth_record_login_attempt($1, $2, $3)`,
        [staffId, success, lockedUntilIso]
      );
    };

    if (session && session.staffId) {
      return withTransaction(session, executeQuery, existingClient);
    }
    return withSystemTransaction(executeQuery, existingClient);
  }

  async updatePassword(
    staffId: string,
    passwordHash: string,
    mustChangePassword: boolean,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<void> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authentication session required to update passwords.');
    }
    return withTransaction(session, async (client) => {
      await client.query(
        `select private.auth_update_password($1, $2, $3)`,
        [staffId, passwordHash, mustChangePassword]
      );
    }, existingClient);
  }

  async listStaff(
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any[]> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authentication session required to list staff members.');
    }
    return withTransaction(session, async (client: any) => {
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
    }, existingClient);
  }

  async createStaff(
    data: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authentication session required to create staff.');
    }
    return withTransaction(session, async (client: any) => {
      const id = data.id || randomUUID();
      const nowIso = new Date().toISOString();
      await client.query(
        `insert into public.staff_members (id, email, role, full_name, phone, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, data.email.toLowerCase().trim(), data.role, data.fullName, data.phone || null, data.isActive ?? true, nowIso]
      );

      if (data.passwordHash) {
        await client.query(
          `select private.auth_create_security_profile($1, $2, $3)`,
          [id, data.passwordHash, data.mustChangePassword ?? true]
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
    }, existingClient);
  }

  async updateStaff(
    staffId: string,
    data: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    if (!session || !session.staffId) {
      throw new AuthorizationError('Authentication session required to update staff.');
    }
    return withTransaction(session, async (client: any) => {
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
    }, existingClient);
  }
}
