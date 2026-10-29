import { logger } from '../logger';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes per US-01 AC3

export interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

// In-memory store (keyed by normalized email)
const lockoutStore = new Map<string, LockoutRecord>();

/**
 * Checks whether an account is currently locked due to >= 5 failed attempts.
 */
export function checkLockout(
  email: string,
  nowMs = Date.now()
): { isLocked: boolean; remainingMinutes: number; failedAttempts: number } {
  const normalized = email.trim().toLowerCase();
  const record = lockoutStore.get(normalized);

  if (!record) {
    return { isLocked: false, remainingMinutes: 0, failedAttempts: 0 };
  }

  // If locked, check if lockout duration has passed
  if (record.lockedUntil !== null) {
    if (nowMs < record.lockedUntil) {
      const remainingMs = record.lockedUntil - nowMs;
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      return { isLocked: true, remainingMinutes, failedAttempts: record.failedAttempts };
    }

    // Lockout has expired: reset consecutive failed count
    record.failedAttempts = 0;
    record.lockedUntil = null;
    lockoutStore.set(normalized, record);
  }

  return { isLocked: false, remainingMinutes: 0, failedAttempts: record.failedAttempts };
}

/**
 * Records a failed login attempt for a user.
 * After 5 consecutive failed attempts, locks the account for 15 minutes.
 */
export function recordFailedAttempt(
  email: string,
  nowMs = Date.now()
): { isNowLocked: boolean; failedAttempts: number; remainingMinutes: number } {
  const normalized = email.trim().toLowerCase();
  const existing = lockoutStore.get(normalized) || {
    failedAttempts: 0,
    lockedUntil: null,
    lastAttemptAt: nowMs,
  };

  // If previous lockout expired, start fresh
  if (existing.lockedUntil !== null && nowMs >= existing.lockedUntil) {
    existing.failedAttempts = 0;
    existing.lockedUntil = null;
  }

  existing.failedAttempts += 1;
  existing.lastAttemptAt = nowMs;

  if (existing.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    existing.lockedUntil = nowMs + LOCKOUT_DURATION_MS;
    lockoutStore.set(normalized, existing);

    logger.warn('Account locked due to consecutive failed attempts', {
      email: normalized,
      failedAttempts: existing.failedAttempts,
      lockoutDurationMinutes: 15,
    });

    return {
      isNowLocked: true,
      failedAttempts: existing.failedAttempts,
      remainingMinutes: 15,
    };
  }

  lockoutStore.set(normalized, existing);
  return {
    isNowLocked: false,
    failedAttempts: existing.failedAttempts,
    remainingMinutes: 0,
  };
}

/**
 * Clears failed attempts and unlocks account on successful login.
 */
export function recordSuccessfulLogin(email: string): void {
  const normalized = email.trim().toLowerCase();
  lockoutStore.delete(normalized);
}

/**
 * Administrative unlock / reset.
 */
export function resetLockout(email: string): void {
  const normalized = email.trim().toLowerCase();
  lockoutStore.delete(normalized);
}

/**
 * Test helper to clear all lockout state.
 */
export function clearAllLockouts(): void {
  lockoutStore.clear();
}
