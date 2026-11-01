import {
  IAdmissionsRepository,
  IAuditRepository,
  ICertificatesRepository,
  IFeesLedgerRepository,
  IReceiptsRepository,
} from './interfaces';
import { PostgresFeesLedgerRepository } from './postgres/fees-ledger.repository';
import { PostgresReceiptsRepository } from './postgres/receipts.repository';
import { PostgresCertificatesRepository } from './postgres/certificates.repository';
import { PostgresAdmissionsRepository } from './postgres/admissions.repository';
import { PostgresAuditRepository } from './postgres/audit.repository';
import { InMemoryFeesLedgerRepository } from './in-memory/fees-ledger.repository';
import { InMemoryReceiptsRepository } from './in-memory/receipts.repository';
import { InMemoryCertificatesRepository } from './in-memory/certificates.repository';
import { InMemoryAdmissionsRepository } from './in-memory/admissions.repository';
import { InMemoryAuditRepository } from './in-memory/audit.repository';
import { getServerEnv, assertSafeDatabaseTarget } from '../../lib/env';

export interface RepositoryRegistry {
  feesLedger: IFeesLedgerRepository;
  receipts: IReceiptsRepository;
  certificates: ICertificatesRepository;
  admissions: IAdmissionsRepository;
  audit: IAuditRepository;
}

let activeRegistry: RepositoryRegistry | null = null;
let currentMode: 'postgres' | 'in-memory' | null = null;

// Singleton instances of in-memory fakes for unit test isolation
const inMemoryFees = new InMemoryFeesLedgerRepository();
const inMemoryReceipts = new InMemoryReceiptsRepository();
const inMemoryCerts = new InMemoryCertificatesRepository();
const inMemoryAdmissions = new InMemoryAdmissionsRepository();
const inMemoryAudit = new InMemoryAuditRepository();

export function setPersistenceMode(mode: 'postgres' | 'in-memory'): void {
  currentMode = mode;
  activeRegistry = null;
}

export function resetInMemoryRepositoriesForTesting(): void {
  inMemoryFees.resetForTesting();
  inMemoryReceipts.resetForTesting();
  inMemoryCerts.resetForTesting();
  inMemoryAdmissions.resetForTesting();
  inMemoryAudit.resetForTesting();
}

/**
 * Returns the active repository registry based on environment configuration.
 * Fails closed in production if DATABASE_URL or database connectivity is missing.
 * In-memory fallback is strictly forbidden in production.
 */
export function getRepositories(): RepositoryRegistry {
  if (activeRegistry) {
    return activeRegistry;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const mode = currentMode || process.env.PERSISTENCE_MODE || (isProduction ? 'postgres' : 'in-memory');

  if (mode === 'postgres' || isProduction) {
    const env = getServerEnv();
    if (!env.DATABASE_URL) {
      throw new Error(
        '[CRITICAL CONFIG ERROR] Production runtime requires DATABASE_URL with durable PostgreSQL persistence. Silent fallback to in-memory store is strictly prohibited.'
      );
    }

    assertSafeDatabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL, env.DATABASE_URL, env.ALLOW_REMOTE_DATABASE === 'true');

    activeRegistry = {
      feesLedger: new PostgresFeesLedgerRepository(),
      receipts: new PostgresReceiptsRepository(),
      certificates: new PostgresCertificatesRepository(),
      admissions: new PostgresAdmissionsRepository(),
      audit: new PostgresAuditRepository(),
    };

    return activeRegistry;
  }

  // Test / local fake mode
  activeRegistry = {
    feesLedger: inMemoryFees,
    receipts: inMemoryReceipts,
    certificates: inMemoryCerts,
    admissions: inMemoryAdmissions,
    audit: inMemoryAudit,
  };

  return activeRegistry;
}
