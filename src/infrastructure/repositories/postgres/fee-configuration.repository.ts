import { IFeeConfigurationRepository } from '../interfaces';
import { runWithSessionOrSystem } from '../../db/postgres-pool';
import { AuthenticatedUserSession } from '../../../modules/identity-access/types';
import {
  FeeCategory,
  FeeHeadDTO,
  FeeStructureDTO,
  FeeStructureLineDTO,
  FeeStructureState,
  TransportMode,
  TransportRateDTO,
} from '../../../modules/fee-configuration/types';
import { addInr, formatInr } from '../../../lib/money/inr';
import { NotFoundError } from '../../../lib/errors';
import { randomUUID } from 'crypto';

export class PostgresFeeConfigurationRepository implements IFeeConfigurationRepository {
  async listFeeHeads(session?: AuthenticatedUserSession): Promise<FeeHeadDTO[]> {
    return runWithSessionOrSystem(session, async (client) => {
      const res = await client.query(
        `select id, code, name, category, is_variable, is_active, created_at, updated_at
         from public.fee_heads
         order by name asc`
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category as FeeCategory,
        isVariable: r.is_variable,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    });
  }

  async createFeeHead(payload: any, session?: AuthenticatedUserSession): Promise<FeeHeadDTO> {
    return runWithSessionOrSystem(session, async (client) => {
      const id = payload.id || randomUUID();
      const nowIso = new Date().toISOString();
      await client.query(
        `insert into public.fee_heads (id, code, name, category, is_variable, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, payload.code, payload.name, payload.category, payload.isVariable ?? false, payload.isActive ?? true, nowIso]
      );
      return {
        id,
        code: payload.code,
        name: payload.name,
        category: payload.category as FeeCategory,
        isVariable: payload.isVariable ?? false,
        isActive: payload.isActive ?? true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });
  }

  async listFeeStructures(academicYearId?: string, session?: AuthenticatedUserSession): Promise<FeeStructureDTO[]> {
    return runWithSessionOrSystem(session, async (client) => {
      let sql = `select s.id, s.academic_year_id, s.grade_level_id, gl.name as grade_level_name,
                        s.version, s.status, s.approved_by, s.approved_at, s.created_at, s.updated_at
                 from public.fee_structures s
                 join public.grade_levels gl on gl.id = s.grade_level_id`;
      const params: any[] = [];
      if (academicYearId) {
        sql += ` where s.academic_year_id = $1`;
        params.push(academicYearId);
      }
      sql += ` order by s.updated_at desc`;
      const res = await client.query(sql, params);

      const structures: FeeStructureDTO[] = [];
      for (const r of res.rows) {
        const linesRes = await client.query(
          `select l.id, l.fee_head_id, l.amount,
                  h.code as head_code, h.name as head_name, h.category as head_category, h.is_variable, h.is_optional
           from public.fee_structure_lines l
           join public.fee_heads h on h.id = l.fee_head_id
           where l.fee_structure_id = $1
           order by l.display_order asc`,
          [r.id]
        );

        let totalFixed = '0.00';
        const lines: FeeStructureLineDTO[] = linesRes.rows.map((l: any) => {
          const defaultAmount = l.amount !== null ? formatInr(l.amount) : formatInr('0.00');
          if (!l.is_variable && l.amount !== null) {
            totalFixed = addInr(totalFixed, defaultAmount);
          }
          return {
            id: l.id,
            feeHeadId: l.fee_head_id,
            feeHeadName: l.head_name,
            category: l.head_category as FeeCategory,
            defaultAmount,
            isOptional: l.is_optional ?? false,
          };
        });

        structures.push({
          id: r.id,
          academicYearId: r.academic_year_id,
          gradeLevelId: r.grade_level_id,
          gradeLevelName: r.grade_level_name || 'Grade',
          version: r.version,
          status: r.status as FeeStructureState,
          approvedBy: r.approved_by || null,
          approvedAt: r.approved_at || null,
          lines,
          totalFixedAmountInr: formatInr(totalFixed),
        });
      }
      return structures;
    });
  }

  async getFeeStructureById(id: string, session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    const list = await this.listFeeStructures(undefined, session);
    const found = list.find((s) => s.id === id);
    if (!found) {
      throw new NotFoundError(`Fee structure "${id}" not found.`);
    }
    return found;
  }

  async getFeeStructureForGrade(
    academicYearId: string,
    gradeLevelId: string,
    session?: AuthenticatedUserSession
  ): Promise<FeeStructureDTO | null> {
    const list = await this.listFeeStructures(academicYearId, session);
    const approved = list.find(
      (s) => s.academicYearId === academicYearId && s.gradeLevelId === gradeLevelId && s.status === 'approved'
    );
    return approved || null;
  }

  async createFeeStructure(payload: any, session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    return runWithSessionOrSystem(session, async (client) => {
      const id = payload.id || randomUUID();
      const nowIso = new Date().toISOString();

      await client.query(
        `insert into public.fee_structures (id, academic_year_id, grade_level_id, version, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $6)`,
        [id, payload.academicYearId, payload.gradeLevelId, payload.version || 1, payload.status || 'draft', nowIso]
      );

      for (let i = 0; i < (payload.lines || []).length; i++) {
        const line = payload.lines[i];
        const lineId = line.id || randomUUID();
        const amt = line.defaultAmount !== undefined ? line.defaultAmount : line.amount;
        await client.query(
          `insert into public.fee_structure_lines (id, fee_structure_id, fee_head_id, amount, display_order, created_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [lineId, id, line.feeHeadId, amt ? formatInr(amt) : null, i, nowIso]
        );
      }

      return this.getFeeStructureById(id, session);
    });
  }

  async approveFeeStructure(id: string, session?: AuthenticatedUserSession): Promise<FeeStructureDTO> {
    return runWithSessionOrSystem(session, async (client) => {
      const nowIso = new Date().toISOString();
      const approverId = session ? session.staffId : null;
      const res = await client.query(
        `update public.fee_structures
         set status = 'approved', approved_by = $1, approved_at = $2, updated_at = $2
         where id = $3
         returning id`,
        [approverId, nowIso, id]
      );
      if (res.rowCount === 0) {
        throw new NotFoundError(`Fee structure "${id}" not found.`);
      }
      return this.getFeeStructureById(id, session);
    });
  }

  async listTransportRates(academicYearId?: string, session?: AuthenticatedUserSession): Promise<TransportRateDTO[]> {
    return runWithSessionOrSystem(session, async (client) => {
      let sql = `select id, academic_year_id, mode, place_label, amount, is_active
                 from public.transport_rates`;
      const params: any[] = [];
      if (academicYearId) {
        sql += ` where academic_year_id = $1`;
        params.push(academicYearId);
      }
      sql += ` order by place_label asc`;
      const res = await client.query(sql, params);
      return res.rows.map((r: any) => ({
        id: r.id,
        academicYearId: r.academic_year_id,
        placeName: r.place_label,
        mode: r.mode as TransportMode,
        rateAmount: formatInr(r.amount),
        isActive: r.is_active,
      }));
    });
  }

  async createTransportRate(payload: any, session?: AuthenticatedUserSession): Promise<TransportRateDTO> {
    return runWithSessionOrSystem(session, async (client) => {
      const id = payload.id || randomUUID();
      const nowIso = new Date().toISOString();
      const placeName = payload.placeName || payload.routeName || 'Default';
      const mode = payload.mode || 'school_bus';
      const rate = formatInr(payload.rateAmount || payload.annualRate || '0.00');

      await client.query(
        `insert into public.transport_rates (id, academic_year_id, mode, place_label, amount, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, payload.academicYearId, mode, placeName, rate, payload.isActive ?? true, nowIso]
      );
      return {
        id,
        academicYearId: payload.academicYearId,
        placeName,
        mode,
        rateAmount: rate,
        isActive: payload.isActive ?? true,
      };
    });
  }
}
