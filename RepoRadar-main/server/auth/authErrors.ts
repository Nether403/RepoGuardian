/**
 * Authentication Error Handling
 * 
 * Provides secure error handling for authentication operations with:
 * - Generic error messages to prevent information disclosure
 * - Detailed server-side logging for debugging
 * - Progressive delays for repeated failures
 * - Account lockout tracking
 */

import { AppError, ErrorCodes } from '@shared/errors';

/**
 * Authentication error types
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  OAUTH_ERROR = 'OAUTH_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PASSWORD_VALIDATION_ERROR = 'PASSWORD_VALIDATION_ERROR',
}

/**
 * Authentication error details for server-side logging
 */
export interface AuthErrorDetails {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  attemptCount?: number;
  provider?: string;
  reason?: string;
  retryAfter?: number;
}

/**
 * Creates a secure authentication error with generic user message
 * and detailed server-side logging
 */
export class AuthError extends AppError {
  details: AuthErrorDetails;

  constructor(
    code: AuthErrorCode,
    serverMessage: string,
    details: AuthErrorDetails = {}
  ) {
    const errorConfig = ErrorCodes[code];
    
    super(
      code,
      serverMessage, // Detailed message for server logs
      errorConfig.userMessage, // Generic message for users
      errorConfig.statusCode,
      errorConfig.recoveryAction,
      details
    );

    this.details = details;
    this.name = 'AuthError';
  }

  /**
   * Logs the error with full details for debugging
   */
  logError(): void {
    console.error('[AUTH ERROR]', {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Creates a generic login failure error
 * This prevents email enumeration by not revealing whether the email exists
 */
export function createLoginFailureError(
  email: string,
  ip: string,
  reason: string
): AuthError {
  const error = new AuthError(
    AuthErrorCode.INVALID_CREDENTIALS,
    `Login failed for ${email}: ${reason}`,
    { email, ip, reason }
  );
  
  error.logError();
  return error;
}

/**
 * Creates an account locked error
 */
export function createAccountLockedError(
  userId: string,
  email: string,
  ip: string,
  attemptCount: number,
  lockedUntil: Date
): AuthError {
  const error = new AuthError(
    AuthErrorCode.ACCOUNT_LOCKED,
    `Account locked for user ${userId} (${email}) after ${attemptCount} failed attempts`,
    { userId, email, ip, attemptCount }
  );
  
  error.logError();
  
  // Add retry-after information
  const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
  error.details = { ...error.details, retryAfter: retryAfterSeconds };
  
  return error;
}

/**
 * Creates an OAuth error
 */
export function createOAuthError(
  provider: string,
  reason: string,
  email?: string
): AuthError {
  const error = new AuthError(
    AuthErrorCode.OAUTH_ERROR,
    `OAuth authentication failed for provider ${provider}: ${reason}`,
    { provider, reason, email }
  );
  
  error.logError();
  return error;
}

/**
 * Creates a password validation error
 */
export function createPasswordValidationError(
  reason: string,
  email?: string
): AuthError {
  const error = new AuthError(
    AuthErrorCode.PASSWORD_VALIDATION_ERROR,
    `Password validation failed: ${reason}`,
    { reason, email }
  );
  
  error.logError();
  return error;
}

/**
 * Creates a token error (invalid or expired)
 */
export function createTokenError(
  isExpired: boolean,
  token: string,
  email?: string
): AuthError {
  const code = isExpired ? AuthErrorCode.TOKEN_EXPIRED : AuthErrorCode.INVALID_TOKEN;
  const reason = isExpired ? 'Token expired' : 'Invalid token';
  
  const error = new AuthError(
    code,
    `${reason}: ${token.substring(0, 8)}...`,
    { reason, email }
  );
  
  error.logError();
  return error;
}

/**
 * Progressive delay calculator for repeated failures
 * Implements exponential backoff to slow down brute force attacks
 */
export function calculateProgressiveDelay(attemptCount: number): number {
  // Base delay: 1 second
  // Exponential backoff: 2^(attemptCount - 1) seconds
  // Max delay: 30 seconds
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  
  if (attemptCount <= 1) {
    return 0; // No delay for first attempt
  }
  
  const delay = baseDelay * Math.pow(2, attemptCount - 2);
  return Math.min(delay, maxDelay);
}

/**
 * Applies progressive delay for repeated failures
 */
export async function applyProgressiveDelay(attemptCount: number): Promise<void> {
  const delay = calculateProgressiveDelay(attemptCount);
  
  if (delay > 0) {
    console.log(`[AUTH] Applying progressive delay: ${delay}ms for attempt ${attemptCount}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Sanitizes error for client response
 * Removes sensitive details and returns only safe information
 */
export function sanitizeAuthError(error: AuthError): {
  error: string;
  message: string;
  recoveryAction?: string;
  retryAfter?: number;
} {
  return {
    error: error.code,
    message: error.userMessage,
    recoveryAction: error.recoveryAction,
    retryAfter: error.details.retryAfter,
  };
}
