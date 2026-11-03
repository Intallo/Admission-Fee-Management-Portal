import { IAcademicYearsRepository } from '../interfaces';
import { runWithSessionOrSystem } from '../../db/postgres-pool';
import { PoolClient } from 'pg';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import { AcademicYearDTO, AcademicYearState } from '../../../modules/academic-years/types';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class PostgresAcademicYearsRepository implements IAcademicYearsRepository {
  async listAcademicYears(
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<AcademicYearDTO[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select id, label, start_date, end_date, status, notes, created_at, updated_at
           from public.academic_years
           order by start_date desc`
        );
        return res.rows.map((r: any) => ({
          id: r.id,
          label: r.label,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status as AcademicYearState,
          notes: r.notes,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      },
      existingClient
    );
  }

  async getAcademicYearById(
    yearId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<AcademicYearDTO> {
    const list = await this.listAcademicYears(session, existingClient);
    const found = list.find((y) => y.id === yearId);
    if (!found) {
      throw new NotFoundError(`Academic year with ID "${yearId}" not found.`);
    }
    return found;
  }

  async createAcademicYear(
    data: any,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<AcademicYearDTO> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const id = data.id || randomUUID();
        const nowIso = new Date().toISOString();
        await client.query(
          `insert into public.academic_years (id, label, start_date, end_date, status, notes, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [id, data.label, data.startDate, data.endDate, data.status || 'draft', data.notes || null, nowIso]
        );
        return {
          id,
          label: data.label,
          startDate: data.startDate,
          endDate: data.endDate,
          status: (data.status || 'draft') as AcademicYearState,
          notes: data.notes || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      },
      existingClient
    );
  }

  async closeAcademicYear(
    yearId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<AcademicYearDTO> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const nowIso = new Date().toISOString();
        const res = await client.query(
          `update public.academic_years
           set status = 'closed', updated_at = $1
           where id = $2
           returning id, label, start_date, end_date, status, notes, created_at, updated_at`,
          [nowIso, yearId]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Academic year "${yearId}" not found.`);
        }
        const r = res.rows[0];
        return {
          id: r.id,
          label: r.label,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status as AcademicYearState,
          notes: r.notes,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      },
      existingClient
    );
  }

  async listGradeLevels(
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select id, code, name, group_name, sort_order
           from public.grade_levels
           order by sort_order asc`
        );
        return res.rows.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          groupName: r.group_name,
          sortOrder: r.sort_order,
        }));
      },
      existingClient
    );
  }

  async listSections(
    academicYearId?: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any[]> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        let sql = `select id, academic_year_id, grade_level_id, name, max_capacity, is_active from public.sections`;
        const params: any[] = [];
        if (academicYearId) {
          sql += ` where academic_year_id = $1`;
          params.push(academicYearId);
        }
        sql += ` order by name asc`;
        const res = await client.query(sql, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          academicYearId: r.academic_year_id,
          gradeLevelId: r.grade_level_id,
          name: r.name,
          maxCapacity: r.max_capacity,
          isActive: r.is_active,
        }));
      },
      existingClient
    );
  }

  async getSectionById(
    sectionId: string,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const res = await client.query(
          `select id, academic_year_id, grade_level_id, name, max_capacity, is_active
           from public.sections
           where id = $1`,
          [sectionId]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Section "${sectionId}" not found.`);
        }
        const r = res.rows[0];
        return {
          id: r.id,
          academicYearId: r.academic_year_id,
          gradeLevelId: r.grade_level_id,
          name: r.name,
          maxCapacity: r.max_capacity,
          isActive: r.is_active,
        };
      },
      existingClient
    );
  }

  async updateSectionCapacity(
    sectionId: string,
    maxCapacity: number,
    session?: AuthenticatedUserSession,
    existingClient?: PoolClient
  ): Promise<any> {
    return runWithSessionOrSystem(
      session,
      async (client) => {
        const nowIso = new Date().toISOString();
        const res = await client.query(
          `update public.sections
           set max_capacity = $1, updated_at = $2
           where id = $3
           returning id, academic_year_id, grade_level_id, name, max_capacity, is_active`,
          [maxCapacity, nowIso, sectionId]
        );
        if (res.rowCount === 0) {
          throw new NotFoundError(`Section "${sectionId}" not found.`);
        }
        const r = res.rows[0];
        return {
          id: r.id,
          academicYearId: r.academic_year_id,
          gradeLevelId: r.grade_level_id,
          name: r.name,
          maxCapacity: r.max_capacity,
          isActive: r.is_active,
        };
      },
      existingClient
    );
  }
}
