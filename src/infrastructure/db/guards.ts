import { PROTECTED_REMOTE_REF } from '../../lib/env';

/**
 * Asserts that the code is executing strictly within a server-side context.
 * Throws a fatal security exception if invoked in a browser bundle.
 */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[CRITICAL SECURITY DEFECT] Attempted to execute server-only database adapter or access privileged credentials from browser environment.'
    );
  }
}

/**
 * Asserts that database operations target only a disposable local database.
 * Protects against accidental operations on the retained remote reference.
 */
export function assertDisposableDatabase(url?: string): void {
  if (!url) return;
  if (url.includes(PROTECTED_REMOTE_REF)) {
    throw new Error(
      `[DATABASE SAFETY GUARD] Operation rejected. Database URL references protected remote database (${PROTECTED_REMOTE_REF}).`
    );
  }
}
