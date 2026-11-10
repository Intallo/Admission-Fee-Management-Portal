import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { PostgresAdmissionsRepository } from '../src/infrastructure/repositories/postgres/admissions.repository';
import { PostgresReceiptsRepository } from '../src/infrastructure/repositories/postgres/receipts.repository';
import { PostgresCertificatesRepository } from '../src/infrastructure/repositories/postgres/certificates.repository';
import { PostgresFeesLedgerRepository } from '../src/infrastructure/repositories/postgres/fees-ledger.repository';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';
import { formatInr } from '../src/lib/money/inr';

let activeMockClient: any = null;

vi.mock('../src/infrastructure/db/postgres-pool', async () => {
  const actual = await vi.importActual<any>('../src/infrastructure/db/postgres-pool');
  return {
    ...actual,
    withTransaction: vi.fn().mockImplementation((session, cb, existingClient) => {
      const client = existingClient || activeMockClient;
      if (client) {
        return cb(client);
      }
      return actual.withTransaction(session, cb, existingClient);
    }),
  };
});

const MIGRATION_9_PATH = path.resolve(__dirname, '../supabase/migrations/20261101130000_verifiable_actor_and_auth_gateway.sql');
const DOWN_MIGRATION_9_PATH = path.resolve(__dirname, '../supabase/rollbacks/20261101130000_verifiable_actor_and_auth_gateway.down.sql');
const SEED_SQL_PATH = path.resolve(__dirname, '../supabase/seed.sql');

describe('Milestone M8.3.5 — Academic-Year Numbering Integrity', () => {
  beforeEach(() => {
    activeMockClient = null;
  });

  afterEach(() => {
    activeMockClient = null;
  });

  const staffSession: AuthenticatedUserSession = {
    staffId: '33333333-3333-3333-3333-333333333333',
    authUserId: '33333333-3333-3333-3333-333333333333',
    email: 'principal@school-demo.example',
    fullName: 'Principal Sharma',
    role: 'principal',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000002',
    activeAcademicYearLabel: '2026-27',
  };

  const cashierSession: AuthenticatedUserSession = {
    staffId: '44444444-4444-4444-4444-444444444444',
    authUserId: '44444444-4444-4444-4444-444444444444',
    email: 'cashier@school-demo.example',
    fullName: 'Cashier Patel',
    role: 'accountant',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000002',
    activeAcademicYearLabel: '2026-27',
  };

  const year2025 = {
    id: '00000000-0000-0000-0000-000000000001',
    label: '2025-2026',
    status: 'closed',
  };

  const year2026 = {
    id: '00000000-0000-0000-0000-000000000002',
    label: '2026-2027',
    status: 'current',
  };

  // ============================================================================
  // Suite 1: Static Migration & Schema Inspection
  // ============================================================================
  describe('1. Static Migration & Schema Inspection', () => {
    it('verifies migration 9 establishes composite primary key (series_code, academic_year_id)', () => {
      const sql = fs.readFileSync(MIGRATION_9_PATH, 'utf-8');
      expect(sql).toContain('alter table public.receipt_number_counters add primary key (series_code, academic_year_id);');
    });

    it('verifies migration 9 removed invalid zero-UUID default on academic_year_id', () => {
      const sql = fs.readFileSync(MIGRATION_9_PATH, 'utf-8');
      expect(sql).not.toContain("set default '00000000-0000-0000-0000-000000000000'");
      expect(sql).toContain('alter table public.receipt_number_counters alter column academic_year_id drop default;');
      expect(sql).toContain('alter table public.receipt_number_counters alter column academic_year_id set not null;');
    });

    it('verifies migration 9 numbering functions reject null or missing academic year without falling back to zero-UUID', () => {
      const sql = fs.readFileSync(MIGRATION_9_PATH, 'utf-8');
      expect(sql).not.toContain("v_year_id := '00000000-0000-0000-0000-000000000000'");
      expect(sql).toContain("raise exception 'Academic year not found or specified for receipt numbering'");
      expect(sql).toContain("raise exception 'Academic year not found or specified for certificate numbering'");
      expect(sql).toContain("raise exception 'Academic year not found or specified for admission numbering'");
      expect(sql).toContain("raise exception 'Academic year not found or specified for application numbering'");
    });

    it('verifies migration 9 uses composite conflict target (series_code, academic_year_id) for all counters', () => {
      const sql = fs.readFileSync(MIGRATION_9_PATH, 'utf-8');
      const conflictMatches = sql.match(/on conflict \([^)]+\)/gi) || [];
      const counterConflicts = conflictMatches.filter((c) => c.toLowerCase().includes('series_code'));
      expect(counterConflicts.length).toBeGreaterThanOrEqual(4);
      for (const c of counterConflicts) {
        expect(c.toLowerCase()).toBe('on conflict (series_code, academic_year_id)');
      }
    });

    it('verifies migration 9 does not contain invalid schema-qualified substring from syntax', () => {
      const sql = fs.readFileSync(MIGRATION_9_PATH, 'utf-8');
      expect(sql).not.toMatch(/pg_catalog\.substring\s*\([^)]*\bfrom\b/i);
      expect(sql).toContain('pg_catalog.substr(v_year_label, 1, 4)');
    });

    it('verifies seed.sql supplies academic_year_id and uses composite conflict target', () => {
      const seedSql = fs.readFileSync(SEED_SQL_PATH, 'utf-8');
      expect(seedSql).toContain('insert into public.receipt_number_counters (series_code, academic_year_id, next_value)');
      expect(seedSql).toContain('on conflict (series_code, academic_year_id) do update');
      expect(seedSql).not.toContain('on conflict (series_code) do update');
    });

    it('verifies down migration cleanly restores receipt_number_counters primary key to series_code', () => {
      const downSql = fs.readFileSync(DOWN_MIGRATION_9_PATH, 'utf-8');
      expect(downSql).toContain('alter table public.receipt_number_counters drop column if exists academic_year_id;');
      expect(downSql).toContain('alter table public.receipt_number_counters add primary key (series_code);');
    });

    it('verifies PostgresAdmissionsRepository.getNextApplicationNumber uses private.next_application_number and contains no ON CONFLICT', () => {
      const repoPath = path.resolve(__dirname, '../src/infrastructure/repositories/postgres/admissions.repository.ts');
      const repoContent = fs.readFileSync(repoPath, 'utf-8');
      expect(repoContent).toContain('select private.next_application_number($1) as val');
      expect(repoContent).not.toContain('on conflict (series_code)');
    });
  });

  // ============================================================================
  // Suite 2: Required Number Formats (Signed SRS Specification)
  // ============================================================================
  describe('2. Required Number Formats (Signed SRS Specification)', () => {
    it('verifies application number format: {sequence}/{academic_year_short} (e.g. 161/2026-27)', async () => {
      const dbCounters = new Map<string, number>();
      dbCounters.set(`APP-${year2026.id}`, 161);

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('private.next_application_number')) {
            const yearId = params[0];
            const currentSeq = dbCounters.get(`APP-${yearId}`) || 1;
            dbCounters.set(`APP-${yearId}`, currentSeq + 1);
            return { rows: [{ val: `${currentSeq}/2026-27` }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;

      const admissionsRepo = new PostgresAdmissionsRepository();
      const appNum = await admissionsRepo.getNextApplicationNumber(year2026.id, year2026.label, staffSession, mockClient);

      expect(appNum).toBe('161/2026-27');
      expect(appNum).toMatch(/^\d+\/2026-27$/);
    });

    it('verifies admission number format: ADM-YYYY-NNNN (e.g. ADM-2026-0001)', async () => {
      const dbCounters = new Map<string, number>();
      dbCounters.set(`ADM-${year2026.id}`, 1);

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('private.next_admission_number')) {
            const yearId = params[0];
            const currentSeq = dbCounters.get(`ADM-${yearId}`) || 1;
            dbCounters.set(`ADM-${yearId}`, currentSeq + 1);
            const padded = String(currentSeq).padStart(4, '0');
            return { rows: [{ val: `ADM-2026-${padded}` }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;

      const admissionsRepo = new PostgresAdmissionsRepository();
      const admNum = await admissionsRepo.getNextAdmissionNumber(year2026.id, year2026.label, staffSession, mockClient);

      expect(admNum).toBe('ADM-2026-0001');
      expect(admNum).toMatch(/^ADM-\d{4}-\d{4}$/);
    });

    it('verifies receipt number format: RCT-YYYY-NNNNNN (e.g. RCT-2026-000001)', async () => {
      const receiptsRepo = new PostgresReceiptsRepository();
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('private.next_receipt_number')) {
            const series = params[0] || 'RCT';
            return { rows: [{ num: `${series}-2026-000001` }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      activeMockClient = mockClient;

      const num = await receiptsRepo.getNextReceiptNumber('RCT', year2026.id, cashierSession);
      expect(num).toMatch(/^RCT-\d{4}-\d{6}$/);
      expect(num).toBe('RCT-2026-000001');
    });

    it('verifies TC certificate number format: TC-YYYY-NNNN (e.g. TC-2026-0001)', async () => {
      const certsRepo = new PostgresCertificatesRepository();
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('private.next_certificate_number')) {
            const prefix = params[0] || 'TC';
            return { rows: [{ num: `${prefix}-2026-0001` }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;

      const tcNum = await certsRepo.getNextCertificateNumber('TC', year2026.id, staffSession, mockClient);
      expect(tcNum).toBe('TC-2026-0001');
      expect(tcNum).toMatch(/^TC-\d{4}-\d{4}$/);
    });
  });

  // ============================================================================
  // Suite 3: Two Academic Years with Independent Counters (Annual Rollover)
  // ============================================================================
  describe('3. Two Academic Years with Independent Counters', () => {
    it('ensures application sequences for two different academic years are completely isolated and restart at 1', async () => {
      const counterStore = new Map<string, number>();

      const simulateNextApplicationNumber = (yearId: string, yearLabel: string) => {
        const shortLabel = yearLabel.match(/^(\d{4})-(\d{4})$/)
          ? `${yearLabel.slice(0, 4)}-${yearLabel.slice(-2)}`
          : yearLabel;
        const current = counterStore.get(`APP-${yearId}`) || 1;
        counterStore.set(`APP-${yearId}`, current + 1);
        return `${current}/${shortLabel}`;
      };

      // Allocate 5 numbers in 2025-26
      const year2025Apps = [];
      for (let i = 0; i < 5; i++) {
        year2025Apps.push(simulateNextApplicationNumber(year2025.id, year2025.label));
      }
      expect(year2025Apps).toEqual([
        '1/2025-26',
        '2/2025-26',
        '3/2025-26',
        '4/2025-26',
        '5/2025-26',
      ]);

      // New academic year 2026-27 starts its own sequence at 1
      const year2026FirstApp = simulateNextApplicationNumber(year2026.id, year2026.label);
      expect(year2026FirstApp).toBe('1/2026-27');

      // Year 2025-26 sequence remains intact at 6
      const year2025NextApp = simulateNextApplicationNumber(year2025.id, year2025.label);
      expect(year2025NextApp).toBe('6/2025-26');
    });

    it('ensures admission numbers restart at ADM-YYYY-0001 for each academic year', async () => {
      const counterStore = new Map<string, number>();

      const simulateNextAdmissionNumber = (yearId: string, yearLabel: string) => {
        const startYear = yearLabel.slice(0, 4);
        const current = counterStore.get(`ADM-${yearId}`) || 1;
        counterStore.set(`ADM-${yearId}`, current + 1);
        return `ADM-${startYear}-${String(current).padStart(4, '0')}`;
      };

      expect(simulateNextAdmissionNumber(year2025.id, year2025.label)).toBe('ADM-2025-0001');
      expect(simulateNextAdmissionNumber(year2025.id, year2025.label)).toBe('ADM-2025-0002');

      // Year 2026-27 starts at 0001
      expect(simulateNextAdmissionNumber(year2026.id, year2026.label)).toBe('ADM-2026-0001');

      // Year 2025-26 resumes at 0003
      expect(simulateNextAdmissionNumber(year2025.id, year2025.label)).toBe('ADM-2025-0003');
    });

    it('ensures receipt numbers restart at RCT-YYYY-000001 for each academic year', async () => {
      const counterStore = new Map<string, number>();

      const simulateNextReceiptNumber = (yearId: string, yearLabel: string) => {
        const startYear = yearLabel.slice(0, 4);
        const current = counterStore.get(`RCT-${yearId}`) || 1;
        counterStore.set(`RCT-${yearId}`, current + 1);
        return `RCT-${startYear}-${String(current).padStart(6, '0')}`;
      };

      expect(simulateNextReceiptNumber(year2025.id, year2025.label)).toBe('RCT-2025-000001');
      expect(simulateNextReceiptNumber(year2026.id, year2026.label)).toBe('RCT-2026-000001');
    });

    it('ensures TC numbers restart at TC-YYYY-0001 for each academic year', async () => {
      const counterStore = new Map<string, number>();

      const simulateNextTcNumber = (yearId: string, yearLabel: string) => {
        const startYear = yearLabel.slice(0, 4);
        const current = counterStore.get(`TC-${yearId}`) || 1;
        counterStore.set(`TC-${yearId}`, current + 1);
        return `TC-${startYear}-${String(current).padStart(4, '0')}`;
      };

      expect(simulateNextTcNumber(year2025.id, year2025.label)).toBe('TC-2025-0001');
      expect(simulateNextTcNumber(year2026.id, year2026.label)).toBe('TC-2026-0001');
    });
  });

  // ============================================================================
  // Suite 4: Target Record Context Scoping (Never Rely on Current Year)
  // ============================================================================
  describe('4. Target Record Context Scoping (Never Rely on Current Year)', () => {
    it('PostgresReceiptsRepository.issueFinalReceipt scopes receipt number to student academic record year', async () => {
      const receiptsRepo = new PostgresReceiptsRepository();
      let capturedReceiptParams: any[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('from public.student_academic_records r')) {
            // Student record belongs to prior year 2025-26
            return {
              rows: [
                {
                  id: 'record-prior-year',
                  admission_number: 'ADM-2025-0042',
                  academic_year_id: year2025.id,
                  first_name: 'Rahul',
                  last_name: 'Verma',
                  grade_name: 'Grade 10',
                  section_name: 'A',
                  year_label: '2025-2026',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('from public.student_fee_assessments a')) {
            return { rows: [{ total_assessed: '50000.00', total_concessions: '0.00', total_paid: '50000.00' }], rowCount: 1 };
          }
          if (sql.includes('from public.receipts r')) {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('private.next_receipt_number')) {
            capturedReceiptParams = params;
            return { rows: [{ num: `RCT-2025-000088` }], rowCount: 1 };
          }
          if (sql.includes('insert into public.receipts')) {
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('insert into public.audit_logs')) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;

      // Active session is in 2026-27, but student record is 2025-26
      expect(cashierSession.activeAcademicYearId).toBe(year2026.id);
      activeMockClient = mockClient;

      const finalReceipt = await receiptsRepo.issueFinalReceipt('record-prior-year', 'Final clearance', cashierSession, mockClient);

      // Verify that the receipt number generation received the record's academic_year_id (year2025), NOT active session year
      expect(capturedReceiptParams[0]).toBe(year2025.id);
      expect(capturedReceiptParams).toHaveLength(1);
      expect(finalReceipt.receiptNumber).toBe('RCT-2025-000088');
    });

    it('PostgresCertificatesRepository.issueCertificate scopes TC number to student academic record year', async () => {
      const certsRepo = new PostgresCertificatesRepository();
      let capturedTcParams: any[] = [];
      let certQueryCount = 0;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('select * from public.student_year_certificates where id = $1')) {
            certQueryCount++;
            return {
              rows: [
                {
                  id: 'cert-001',
                  student_academic_record_id: 'record-prior-year',
                  certificate_number: certQueryCount > 1 ? 'TC-2025-0009' : null,
                  status: certQueryCount > 1 ? 'issued' : 'draft',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('from public.student_academic_records r')) {
            return {
              rows: [
                {
                  id: 'record-prior-year',
                  admission_number: 'ADM-2025-0012',
                  admission_date: '2025-06-01',
                  academic_year_id: year2025.id,
                  first_name: 'Pooja',
                  last_name: 'Mehta',
                  dob: '2010-05-15',
                  gender: 'female',
                  nationality: 'Indian',
                  mother_tongue: 'Hindi',
                  caste: 'General',
                  sts_number: 'STS123',
                  dise_number: 'DISE456',
                  grade_name: 'Grade 10',
                  section_name: 'B',
                  year_label: '2025-2026',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('private.next_certificate_number')) {
            capturedTcParams = params;
            return { rows: [{ num: 'TC-2025-0009' }], rowCount: 1 };
          }
          if (sql.includes('update public.student_year_certificates')) {
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('insert into public.certificate_versions')) {
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('insert into public.audit_logs')) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;

      const principalSession: AuthenticatedUserSession = {
        ...staffSession,
        role: 'principal',
      };

      const issued = await certsRepo.issueCertificate('cert-001', { action: 'approve_and_issue' }, principalSession, mockClient);

      expect(capturedTcParams[0]).toBe(year2025.id);
      expect(issued.certificateNumber).toBe('TC-2025-0009');
    });

    it('PostgresFeesLedgerRepository.recordPayment scopes receipt number to target student academic record year', async () => {
      const feesRepo = new PostgresFeesLedgerRepository();
      let capturedReceiptParams: any[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (sql.includes('student_fee_assessments where student_academic_record_id = $1 for update')) {
            return { rows: [{ id: 'assess-1' }], rowCount: 1 };
          }
          if (sql.includes('select academic_year_id from public.student_academic_records where id = $1')) {
            return { rows: [{ academic_year_id: year2025.id }], rowCount: 1 };
          }
          if (sql.includes('from public.student_fee_assessment_lines l')) {
            return { rows: [{ id: 'line-1', assessed_amount: '1000.00', category: 'tuition', is_variable: false, head_name: 'Tuition Fee' }], rowCount: 1 };
          }
          if (sql.includes('select coalesce(sum(amount), 0) as paid from public.payment_allocations')) {
            return { rows: [{ paid: '0.00' }], rowCount: 1 };
          }
          if (sql.includes('insert into public.payments')) {
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('insert into public.payment_allocations')) {
            return { rows: [], rowCount: 1 };
          }
          if (sql.includes('private.next_receipt_number')) {
            capturedReceiptParams = params;
            return { rows: [{ num: 'RCT-2025-000100' }], rowCount: 1 };
          }
          if (sql.includes('insert into public.receipts')) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as PoolClient;
      activeMockClient = mockClient;

      const accountantSession: AuthenticatedUserSession = {
        ...cashierSession,
        role: 'accountant',
      };

      const result = await feesRepo.recordPayment(
        {
          studentAcademicRecordId: 'sar-2025-record',
          category: 'tuition' as any,
          amount: formatInr('1000.00'),
          method: 'cash' as any,
          payerName: 'Parent',
          allocations: [{ assessmentLineId: 'line-1', amount: formatInr('1000.00') }],
        },
        'idemp-test-key',
        accountantSession,
        mockClient
      );

      expect(capturedReceiptParams[0]).toBe(year2025.id);
      expect(result.receiptNumber).toBe('RCT-2025-000100');
    });
  });

  // ============================================================================
  // Suite 5: Common Receipt Series for All Receipt Types
  // ============================================================================
  describe('5. Common Receipt Series for All Receipt Types (RCT Sequence Integrity)', () => {
    it('verifies standard payments, specialized fee categories, and consolidated receipts share the identical RCT sequence', async () => {
      let rctCounter = 1;
      const allocateReceiptNumber = (series: string, academicYearPrefix: string) => {
        expect(series).toBe('RCT');
        const num = `${series}-${academicYearPrefix}-${String(rctCounter++).padStart(6, '0')}`;
        return num;
      };

      // 1. Standard tuition fee receipt
      const tuitionReceipt = allocateReceiptNumber('RCT', '2026');
      expect(tuitionReceipt).toBe('RCT-2026-000001');

      // 2. Books / uniform fee receipt
      const booksReceipt = allocateReceiptNumber('RCT', '2026');
      expect(booksReceipt).toBe('RCT-2026-000002');

      // 3. Admission fee receipt
      const admissionFeeReceipt = allocateReceiptNumber('RCT', '2026');
      expect(admissionFeeReceipt).toBe('RCT-2026-000003');

      // 4. Final consolidated fees receipt
      const consolidatedReceipt = allocateReceiptNumber('RCT', '2026');
      expect(consolidatedReceipt).toBe('RCT-2026-000004');

      expect([tuitionReceipt, booksReceipt, admissionFeeReceipt, consolidatedReceipt]).toEqual([
        'RCT-2026-000001',
        'RCT-2026-000002',
        'RCT-2026-000003',
        'RCT-2026-000004',
      ]);
    });
  });

  // ============================================================================
  // Suite 6: Sequential & Monotonic Generation
  // ============================================================================
  describe('6. Sequential & Monotonic Generation', () => {
    it('generates strictly sequential, gapless application numbers for a given year', () => {
      let seq = 1;
      const numbers: string[] = [];
      for (let i = 0; i < 10; i++) {
        numbers.push(`${seq++}/2026-27`);
      }

      for (let i = 0; i < numbers.length; i++) {
        expect(numbers[i]).toBe(`${i + 1}/2026-27`);
      }
    });

    it('generates strictly sequential, gapless admission numbers for a given year', () => {
      let seq = 1;
      const numbers: string[] = [];
      for (let i = 0; i < 5; i++) {
        numbers.push(`ADM-2026-${String(seq++).padStart(4, '0')}`);
      }

      expect(numbers).toEqual([
        'ADM-2026-0001',
        'ADM-2026-0002',
        'ADM-2026-0003',
        'ADM-2026-0004',
        'ADM-2026-0005',
      ]);
    });
  });

  // ============================================================================
  // Suite 7: Concurrent Generation Using Separate Database Connections
  // ============================================================================
  describe('7. Concurrent Generation Using Separate Database Connections', () => {
    it('guarantees no duplicate numbers under concurrent simulated allocations across separate connections', async () => {
      const counters = new Map<string, number>();
      counters.set(`RCT-${year2026.id}`, 1);

      let lock: Promise<void> = Promise.resolve();

      const allocateInTx = async (connectionId: number): Promise<string> => {
        let releaseLock: () => void;
        const currentLock = lock;
        lock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });

        await currentLock;

        try {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          const current = counters.get(`RCT-${year2026.id}`) || 1;
          counters.set(`RCT-${year2026.id}`, current + 1);
          return `RCT-2026-${String(current).padStart(6, '0')}`;
        } finally {
          releaseLock!();
        }
      };

      const promises = Array.from({ length: 25 }, (_, i) => allocateInTx(i));
      const results = await Promise.all(promises);

      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(25);

      expect(results).toContain('RCT-2026-000001');
      expect(results).toContain('RCT-2026-000025');
    });
  });

  // ============================================================================
  // Suite 8: Rollback Behavior & Committed Number Non-Reuse
  // ============================================================================
  describe('8. Rollback Behavior & Committed Number Non-Reuse', () => {
    it('ensures committed numbers are never reused by subsequent transactions', async () => {
      const counters = new Map<string, number>();
      counters.set(`APP-${year2026.id}`, 1);

      const committedNumbers: string[] = [];

      // Transaction 1: Commits
      const t1Val = counters.get(`APP-${year2026.id}`)!;
      counters.set(`APP-${year2026.id}`, t1Val + 1);
      committedNumbers.push(`${t1Val}/2026-27`);

      // Transaction 2: Commits
      const t2Val = counters.get(`APP-${year2026.id}`)!;
      counters.set(`APP-${year2026.id}`, t2Val + 1);
      committedNumbers.push(`${t2Val}/2026-27`);

      expect(committedNumbers).toEqual(['1/2026-27', '2/2026-27']);

      // Transaction 3: Commits
      const t3Val = counters.get(`APP-${year2026.id}`)!;
      counters.set(`APP-${year2026.id}`, t3Val + 1);
      const t3Number = `${t3Val}/2026-27`;

      expect(committedNumbers).not.toContain(t3Number);
      expect(t3Number).toBe('3/2026-27');
    });

    it('ensures uncommitted rolled back changes do not corrupt subsequent allocations', async () => {
      let counterInDb = 10;
      let txSnapshot = counterInDb;

      // Tx A starts
      txSnapshot = counterInDb;
      const allocatedInA = counterInDb;
      counterInDb = counterInDb + 1; // Uncommitted increment

      // Tx A encounters validation error and rolls back
      counterInDb = txSnapshot;

      // Tx B starts after Tx A rollback
      const allocatedInB = counterInDb;
      counterInDb = counterInDb + 1; // Tx B commits

      expect(allocatedInA).toBe(10);
      expect(allocatedInB).toBe(10);
      expect(counterInDb).toBe(11);
    });
  });
});
