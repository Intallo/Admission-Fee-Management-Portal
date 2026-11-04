import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';
import { getServerEnv } from '../../lib/env';
import { assertServerOnly, assertDisposableDatabase } from './guards';
import crypto from 'crypto';

let cachedAdminClient: any = null;

export class MockStorageBucket {
  private files = new Map<string, { buffer: Buffer; contentType: string }>();
  public shouldFail = false;
  public failureMessage = 'Storage service connection refused';

  async upload(path: string, buffer: Buffer | Uint8Array, options?: { contentType?: string; upsert?: boolean }) {
    if (this.shouldFail) {
      return { data: null, error: new Error(this.failureMessage) };
    }
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    this.files.set(path, { buffer: buf, contentType: options?.contentType || 'application/octet-stream' });
    return { data: { path }, error: null };
  }

  async remove(paths: string[]) {
    if (this.shouldFail) {
      return { data: null, error: new Error(this.failureMessage) };
    }
    for (const p of paths) {
      this.files.delete(p);
    }
    return { data: paths.map((path) => ({ path })), error: null };
  }

  async createSignedUrl(path: string, expiresIn: number) {
    if (this.shouldFail) {
      return { data: null, error: new Error(this.failureMessage) };
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const token = crypto.randomBytes(16).toString('hex');
    const signedUrl = `https://storage.supabase.co/storage/v1/object/sign/admission-documents/${path}?token=${token}&expires=${expiresAt}`;
    return { data: { signedUrl }, error: null };
  }

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  getFile(path: string) {
    return this.files.get(path);
  }

  clear() {
    this.files.clear();
    this.shouldFail = false;
  }
}

export function createMockAdminDbClient() {
  const buckets = new Map<string, MockStorageBucket>();
  return {
    storage: {
      from(bucketName: string) {
        if (!buckets.has(bucketName)) {
          buckets.set(bucketName, new MockStorageBucket());
        }
        return buckets.get(bucketName)!;
      },
      getBucket(bucketName: string) {
        if (!buckets.has(bucketName)) {
          buckets.set(bucketName, new MockStorageBucket());
        }
        return buckets.get(bucketName)!;
      },
    },
  };
}

export function setAdminDbClientForTesting(client: any): void {
  cachedAdminClient = client;
}

export function resetAdminDbClient(): void {
  cachedAdminClient = null;
}

/**
 * Creates or retrieves the singleton server-side privileged application database client.
 * Strictly forbidden from browser execution.
 * Guards against the retained remote database ref (fjrfyzamiirqzitdchkz).
 */
export function getAdminDbClient(): any {
  assertServerOnly();

  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  if (process.env.NODE_ENV === 'test') {
    cachedAdminClient = createMockAdminDbClient();
    return cachedAdminClient;
  }

  const env = getServerEnv();
  assertDisposableDatabase(env.NEXT_PUBLIC_SUPABASE_URL);
  assertDisposableDatabase(env.DATABASE_URL);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[CONFIG ERROR] getAdminDbClient requires SUPABASE_SERVICE_ROLE_KEY to be configured.');
  }

  cachedAdminClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  return cachedAdminClient;
}
