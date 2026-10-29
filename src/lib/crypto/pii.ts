import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { StaffRole } from '../../modules/identity-access/types';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_KEY_VERSION = 'v1';

// Default deterministic key for local development and synthetic tests (32 bytes)
const DEFAULT_DEV_KEY = Buffer.from(
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'hex'
);

function getEncryptionKey(): Buffer {
  const envKey = process.env.PII_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    return Buffer.from(envKey.padEnd(32, '0').slice(0, 32), 'utf-8');
  }
  return DEFAULT_DEV_KEY;
}

/**
 * Encrypts a sensitive string field using AES-256-GCM.
 * Output format: v1:{ivHex}:{authTagHex}:{cipherHex}
 */
export function encryptSensitiveField(plaintext: string): string {
  if (!plaintext) return plaintext;
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${CURRENT_KEY_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a versioned AES-256-GCM ciphertext.
 */
export function decryptSensitiveField(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith('v1:')) {
    // If not encrypted or unknown version, return as is (e.g. legacy plain in test mock)
    return ciphertext;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed versioned ciphertext format');
  }

  const [, ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(cipherHex, 'hex');
  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Computes a deterministic SHA-256 HMAC for Aadhaar duplicate detection.
 * Matches ADR-001 line 151 and database column `student_sensitive_details.aadhaar_hash`.
 */
export function computeAadhaarHash(aadhaarNumber: string): string {
  const cleaned = aadhaarNumber.replace(/[\s-]/g, '').trim();
  const key = getEncryptionKey();
  return createHmac('sha256', key).update(cleaned).digest('hex');
}

/**
 * Extracts the last 4 digits of an Aadhaar number.
 */
export function extractAadhaarLastFour(aadhaarNumber: string): string {
  const cleaned = aadhaarNumber.replace(/[\s-]/g, '').trim();
  if (cleaned.length < 4) {
    return cleaned.padStart(4, '0');
  }
  return cleaned.slice(-4);
}

/**
 * Returns true strictly if the staff role is authorized to view sensitive PII.
 * Per signed BRD/SRS R-06, only Principal and Admission Officer are authorized.
 */
export function isAuthorizedForSensitivePii(role?: StaffRole | null): boolean {
  return role === 'principal' || role === 'admission_officer';
}

/**
 * Masks an Aadhaar number to display only the last four digits.
 */
export function maskAadhaar(lastFour: string | null | undefined): string {
  if (!lastFour) return '••••-••••-••••';
  const clean = lastFour.trim().slice(-4);
  return `••••-••••-${clean}`;
}

/**
 * Masks a bank account number to show only the last four digits.
 */
export function maskBankAccount(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '••••••••••••';
  const clean = accountNumber.trim();
  if (clean.length <= 4) return '••••';
  return '•'.repeat(Math.max(0, clean.length - 4)) + clean.slice(-4);
}
