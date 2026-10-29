import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../../types/database.types';
import { getClientEnv } from '../../lib/env';

/**
 * Creates a browser-safe Supabase client using only public credentials.
 * Constrained by PostgreSQL Row-Level Security policies.
 */
export function createBrowserDbClient() {
  const env = getClientEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
