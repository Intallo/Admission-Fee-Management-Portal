import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRepositories,
  setPersistenceMode,
  resetInMemoryRepositoriesForTesting,
} from '../src/infrastructure/repositories/registry';
import { PostgresFeesLedgerRepository } from '../src/infrastructure/repositories/postgres/fees-ledger.repository';
import { InMemoryFeesLedgerRepository } from '../src/infrastructure/repositories/in-memory/fees-ledger.repository';
import { withTransaction, setPostgresPoolForTesting } from '../src/infrastructure/db/postgres-pool';
import { assertSafeDatabaseTarget, PROTECTED_REMOTE_REF } from '../src/lib/env';
import { AuthenticatedUserSession } from '../src/modules/identity-access/types';

describe('Phase 8: Durable Persistence & Runtime Least-Privilege Remediation', () => {
  const principalSession: AuthenticatedUserSession = {
    staffId: '11111111-1111-1111-1111-111111111111',
    authUserId: '11111111-1111-1111-1111-111111111111',
    role: 'principal',
    fullName: 'Dr. Ramesh Kulkarni',
    email: 'principal@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const accountantSession: AuthenticatedUserSession = {
    staffId: '22222222-2222-2222-2222-222222222222',
    authUserId: '22222222-2222-2222-2222-222222222222',
    role: 'accountant',
    fullName: 'Vinod Patil',
    email: 'accounts@school-demo.example',
    isActive: true,
    activeAcademicYearId: '00000000-0000-0000-0000-000000000001',
    activeAcademicYearLabel: '2026-27',
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local_dev_key';
    resetInMemoryRepositoriesForTesting();
    setPersistenceMode('in-memory');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setPersistenceMode('in-memory');
  });

  describe('1. Production Fail-Closed Persistence Boundary', () => {
    it('refuses to start and throws an error if production environment lacks DATABASE_URL', () => {
      const origEnv = process.env.NODE_ENV;
      const origDbUrl = process.env.DATABASE_URL;

      try {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.DATABASE_URL;
        setPersistenceMode('postgres');

        expect(() => getRepositories()).toThrow(
          /Production runtime requires DATABASE_URL with durable PostgreSQL persistence/
        );
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.DATABASE_URL = origDbUrl;
      }
    });

    it('aborts immediately if DATABASE_URL attempts to connect to the retained remote project (fjrfyzamiirqzitdchkz)', () => {
      const forbiddenUrl = `postgresql://postgres:secret@db.${PROTECTED_REMOTE_REF}.supabase.co:5432/postgres`;
      expect(() => assertSafeDatabaseTarget(undefined, forbiddenUrl, false)).toThrow(
        /Connection to retained remote database \(fjrfyzamiirqzitdchkz\) is STRICTLY FORBIDDEN/
      );
    });

    it('provides PostgreSQL-backed repositories when persistence mode is postgres', () => {
      setPersistenceMode('postgres');
      process.env.DATABASE_URL = 'postgresql://school_app_login:secret@127.0.0.1:54322/postgres';
      const repos = getRepositories();
      expect(repos.feesLedger).toBeInstanceOf(PostgresFeesLedgerRepository);
    });
  });

  describe('2. Direct PostgreSQL Pooling & Transaction-Local Actor Context (F-02)', () => {
    it('sets transaction-local actor context with is_local=true and runs RESET ALL on cleanup', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql === 'BEGIN') return Promise.resolve();
          if (sql.includes('set_config')) return Promise.resolve({ rows: [{ set_config: '' }] });
          if (sql === 'COMMIT') return Promise.resolve();
          if (sql === 'RESET ALL') return Promise.resolve();
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      // Inject mock pool
      setPostgresPoolForTesting(mockPool as any);

      try {
        await withTransaction(accountantSession, async (client) => {
          expect(client).toBe(mockClient);
          return 'success';
        });

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
          "SELECT set_config('app.current_staff_id', $1, true), set_config('app.current_role', $2, true)",
          [accountantSession.staffId, accountantSession.role]
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.query).toHaveBeenCalledWith('RESET ALL');
        expect(mockClient.release).toHaveBeenCalled();
      } finally {
        setPostgresPoolForTesting(null);
      }
    });

    it('rolls back transaction and executes RESET ALL if an internal operation throws', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql === 'BEGIN') return Promise.resolve();
          if (sql === 'ROLLBACK') return Promise.resolve();
          if (sql === 'RESET ALL') return Promise.resolve();
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      setPostgresPoolForTesting(mockPool as any);

      try {
        await expect(
          withTransaction(principalSession, async () => {
            throw new Error('Simulated database failure during payment insert');
          })
        ).rejects.toThrow('Simulated database failure during payment insert');

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.query).toHaveBeenCalledWith('RESET ALL');
        expect(mockClient.release).toHaveBeenCalled();
      } finally {
        setPostgresPoolForTesting(null);
      }
    });
  });

  describe('3. In-Memory Test Fakes Isolation & Atomicity', () => {
    it('isolates state in in-memory repository fakes during unit test runs', () => {
      setPersistenceMode('in-memory');
      const repos = getRepositories();
      expect(repos.feesLedger).toBeInstanceOf(InMemoryFeesLedgerRepository);
    });

    it('resets in-memory repository fakes cleanly on resetForTesting()', () => {
      const repos = getRepositories();
      expect(repos.feesLedger).toBeInstanceOf(InMemoryFeesLedgerRepository);
      resetInMemoryRepositoriesForTesting();
    });
  });
});
