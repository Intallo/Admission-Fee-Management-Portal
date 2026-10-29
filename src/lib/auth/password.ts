import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCKSIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

function runScrypt(password: string, salt: string, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Validates password strength per signed SRS US-04 AC3.
 * Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numerical digit (0-9)');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hashes a plaintext password using cryptographically secure scrypt with a unique 16-byte salt.
 * Output format: scrypt$16384$8$1$<salt_hex>$<derived_key_hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await runScrypt(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCKSIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCKSIZE}$${SCRYPT_PARALLELIZATION}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timingSafeEqual to defeat timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const cost = parseInt(parts[1], 10);
    const blockSize = parseInt(parts[2], 10);
    const parallelization = parseInt(parts[3], 10);
    const salt = parts[4];
    const originalHashBuffer = Buffer.from(parts[5], 'hex');

    const derivedKey = await runScrypt(password, salt, originalHashBuffer.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 64 * 1024 * 1024,
    });

    return timingSafeEqual(originalHashBuffer, derivedKey);
  } catch {
    return false;
  }
}
