import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';
import { getServerEnv } from '../../lib/env';
import { assertServerOnly, assertDisposableDatabase } from './guards';

let cachedAdminClient: any = null;

/**
 * Creates or retrieves the singleton server-side privileged application database client.
 * Strictly forbidden from browser execution.
 * Guards against the retained remote database ref (fjrfyzamiirqzitdchkz).
 */
export function getAdminDbClient(): any {
  assertServerOnly();
  const env = getServerEnv();

  assertDisposableDatabase(env.NEXT_PUBLIC_SUPABASE_URL);
  assertDisposableDatabase(env.DATABASE_URL);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[CONFIG ERROR] getAdminDbClient requires SUPABASE_SERVICE_ROLE_KEY to be configured.');
  }

  if (!cachedAdminClient) {
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
  }

  return cachedAdminClient;
}
