import {
  IAcademicYearsRepository,
  IAdmissionsRepository,
  IAuditRepository,
  ICertificatesRepository,
  IDocumentsRepository,
  IFeeConfigurationRepository,
  IFeesLedgerRepository,
  IIdentityRepository,
  IReceiptsRepository,
  IStudentRecordsRepository,
} from './interfaces';
import { PostgresFeesLedgerRepository } from './postgres/fees-ledger.repository';
import { PostgresReceiptsRepository } from './postgres/receipts.repository';
import { PostgresCertificatesRepository } from './postgres/certificates.repository';
import { PostgresAdmissionsRepository } from './postgres/admissions.repository';
import { PostgresAuditRepository } from './postgres/audit.repository';
import { PostgresIdentityRepository } from './postgres/identity.repository';
import { PostgresAcademicYearsRepository } from './postgres/academic-years.repository';
import { PostgresStudentRecordsRepository } from './postgres/student-records.repository';
import { PostgresFeeConfigurationRepository } from './postgres/fee-configuration.repository';
import { PostgresDocumentsRepository } from './postgres/documents.repository';

import { InMemoryFeesLedgerRepository } from './in-memory/fees-ledger.repository';
import { InMemoryReceiptsRepository } from './in-memory/receipts.repository';
import { InMemoryCertificatesRepository } from './in-memory/certificates.repository';
import { InMemoryAdmissionsRepository } from './in-memory/admissions.repository';
import { InMemoryAuditRepository } from './in-memory/audit.repository';
import { InMemoryIdentityRepository } from './in-memory/identity.repository';
import { InMemoryAcademicYearsRepository } from './in-memory/academic-years.repository';
import { InMemoryStudentRecordsRepository } from './in-memory/student-records.repository';
import { InMemoryFeeConfigurationRepository } from './in-memory/fee-configuration.repository';
import { InMemoryDocumentsRepository } from './in-memory/documents.repository';

import { getServerEnv, assertSafeDatabaseTarget } from '../../lib/env';

export interface RepositoryRegistry {
  identity: IIdentityRepository;
  academicYears: IAcademicYearsRepository;
  admissions: IAdmissionsRepository;
  studentRecords: IStudentRecordsRepository;
  feeConfiguration: IFeeConfigurationRepository;
  feesLedger: IFeesLedgerRepository;
  receipts: IReceiptsRepository;
  certificates: ICertificatesRepository;
  documents: IDocumentsRepository;
  audit: IAuditRepository;
}

let activeRegistry: RepositoryRegistry | null = null;
let currentMode: 'postgres' | 'memory' | null = null;

// Singleton instances of in-memory fakes for unit test isolation
const inMemoryIdentity = new InMemoryIdentityRepository();
const inMemoryAcademicYears = new InMemoryAcademicYearsRepository();
const inMemoryAdmissions = new InMemoryAdmissionsRepository();
const inMemoryStudentRecords = new InMemoryStudentRecordsRepository();
const inMemoryFeeConfiguration = new InMemoryFeeConfigurationRepository();
const inMemoryReceipts = new InMemoryReceiptsRepository();
const inMemoryFees = new InMemoryFeesLedgerRepository(inMemoryReceipts, inMemoryAdmissions);
inMemoryReceipts.setFeesRepo(inMemoryFees);
const inMemoryCerts = new InMemoryCertificatesRepository(inMemoryAdmissions, inMemoryFees);
const inMemoryDocuments = new InMemoryDocumentsRepository();
const inMemoryAudit = new InMemoryAuditRepository();

export function setPersistenceMode(mode: 'postgres' | 'memory' | 'in-memory'): void {
  currentMode = mode === 'in-memory' ? 'memory' : mode;
  activeRegistry = null;
}

export function resetInMemoryRepositoriesForTesting(): void {
  inMemoryIdentity.resetForTesting();
  inMemoryAcademicYears.resetForTesting();
  inMemoryAdmissions.resetForTesting();
  inMemoryStudentRecords.resetForTesting();
  inMemoryFeeConfiguration.resetForTesting();
  inMemoryFees.resetForTesting();
  inMemoryReceipts.resetForTesting();
  inMemoryCerts.resetForTesting();
  inMemoryDocuments.resetForTesting();
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
  const mode = currentMode || process.env.PERSISTENCE_MODE || (isProduction ? 'postgres' : 'memory');

  if (isProduction && mode === 'memory') {
    throw new Error(
      '[CRITICAL CONFIG ERROR] Production runtime cannot start in in-memory persistence mode. PERSISTENCE_MODE=memory is strictly forbidden in production.'
    );
  }

  if (mode === 'postgres' || isProduction) {
    const env = getServerEnv();
    if (!env.DATABASE_URL) {
      throw new Error(
        '[CRITICAL CONFIG ERROR] Production runtime requires DATABASE_URL with durable PostgreSQL persistence. Silent fallback to in-memory store is strictly prohibited.'
      );
    }

    assertSafeDatabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL, env.DATABASE_URL, env.ALLOW_REMOTE_DATABASE === 'true');

    activeRegistry = {
      identity: new PostgresIdentityRepository(),
      academicYears: new PostgresAcademicYearsRepository(),
      admissions: new PostgresAdmissionsRepository(),
      studentRecords: new PostgresStudentRecordsRepository(),
      feeConfiguration: new PostgresFeeConfigurationRepository(),
      feesLedger: new PostgresFeesLedgerRepository(),
      receipts: new PostgresReceiptsRepository(),
      certificates: new PostgresCertificatesRepository(),
      documents: new PostgresDocumentsRepository(),
      audit: new PostgresAuditRepository(),
    };

    return activeRegistry!;
  }

  // Test / isolated fake mode (PERSISTENCE_MODE=memory)
  activeRegistry = {
    identity: inMemoryIdentity,
    academicYears: inMemoryAcademicYears,
    admissions: inMemoryAdmissions,
    studentRecords: inMemoryStudentRecords,
    feeConfiguration: inMemoryFeeConfiguration,
    feesLedger: inMemoryFees,
    receipts: inMemoryReceipts,
    certificates: inMemoryCerts,
    documents: inMemoryDocuments,
    audit: inMemoryAudit,
  };

  return activeRegistry!;
}
