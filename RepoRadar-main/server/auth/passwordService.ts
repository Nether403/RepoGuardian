import bcrypt from 'bcrypt';

/**
 * Password Service
 * 
 * Provides secure password hashing and verification using bcrypt.
 * Implements password strength validation and automatic rehashing for old passwords.
 */

// Get bcrypt cost factor from environment or use default of 12
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;

/**
 * Password strength validation error
 */
export class PasswordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordValidationError';
  }
}

/**
 * Validates password strength
 * @param password - The password to validate
 * @throws {PasswordValidationError} If password doesn't meet requirements
 */
export function validatePasswordStrength(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
    );
  }
}

/**
 * Hashes a password using bcrypt
 * @param password - The plaintext password to hash
 * @returns Promise resolving to the hashed password
 * @throws {PasswordValidationError} If password doesn't meet strength requirements
 */
export async function hash(password: string): Promise<string> {
  // Validate password strength before hashing
  validatePasswordStrength(password);
  
  // Hash the password with the configured cost factor
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  
  return hashedPassword;
}

/**
 * Verifies a password against a hash
 * @param password - The plaintext password to verify
 * @param hash - The hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verify(password: string, hash: string): Promise<boolean> {
  try {
    // Use bcrypt's compare function which is timing-safe
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    // If comparison fails (e.g., invalid hash format), return false
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Checks if a password hash needs to be rehashed with a higher cost factor
 * @param hash - The password hash to check
 * @returns True if the hash should be regenerated with current cost factor
 */
export function needsRehash(hash: string): boolean {
  try {
    // Extract the cost factor from the hash
    // bcrypt hash format: $2a$[cost]$[salt][hash]
    const rounds = bcrypt.getRounds(hash);
    
    // If the hash was created with a lower cost factor, it needs rehashing
    return rounds < BCRYPT_ROUNDS;
  } catch (error) {
    // If we can't parse the hash, assume it needs rehashing
    console.error('Error checking hash rounds:', error);
    return true;
  }
}

/**
 * Password Service interface for dependency injection
 */
export const passwordService = {
  hash,
  verify,
  needsRehash,
  validatePasswordStrength,
};
