/**
 * Login Service
 * 
 * Handles user login with security features:
 * - Account lockout after failed attempts
 * - Progressive delays for repeated failures
 * - Secure error handling
 */

import { storage } from '../storage';
import { passwordService } from './passwordService';
import {
  createLoginFailureError,
  createAccountLockedError,
  applyProgressiveDelay,
  AuthErrorCode,
} from './authErrors';
import { AppError, ErrorCodes } from '@shared/errors';

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  userId?: string;
  user?: any;
  error?: AppError;
}

/**
 * Attempts to log in a user with email and password
 * Implements account lockout and progressive delays
 */
export async function loginWithPassword(
  email: string,
  password: string,
  ip: string
): Promise<LoginResult> {
  try {
    // Get user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      // User doesn't exist - return generic error to prevent email enumeration
      throw createLoginFailureError(email, ip, 'User not found');
    }
    
    // Check if account is locked
    const isLocked = await storage.isAccountLocked(user.id);
    if (isLocked) {
      const lockedUntil = user.accountLockedUntil || new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      throw createAccountLockedError(
        user.id,
        email,
        ip,
        user.failedLoginAttempts || 0,
        lockedUntil
      );
    }
    
    // Check if user has a password hash
    if (!user.passwordHash) {
      throw createLoginFailureError(email, ip, 'No password set - OAuth account');
    }
    
    // Apply progressive delay based on previous failed attempts
    const attemptCount = user.failedLoginAttempts || 0;
    await applyProgressiveDelay(attemptCount);
    
    // Verify password
    const isValid = await passwordService.verify(password, user.passwordHash);
    
    if (!isValid) {
      // Increment failed login attempts
      const updatedUser = await storage.incrementFailedLoginAttempts(user.id);
      
      // Check if we should lock the account
      const newAttemptCount = updatedUser.failedLoginAttempts || 0;
      if (newAttemptCount >= MAX_FAILED_ATTEMPTS) {
        await storage.lockAccount(user.id, LOCKOUT_DURATION_MINUTES);
        
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        
        throw createAccountLockedError(
          user.id,
          email,
          ip,
          newAttemptCount,
          lockedUntil
        );
      }
      
      throw createLoginFailureError(email, ip, 'Invalid password');
    }
    
    // Login successful - update last login and reset failed attempts
    const updatedUser = await storage.updateUserLastLogin(user.id, ip);
    
    console.log(`[AUTH] Successful login for user ${user.id} (${email}) from ${ip}`);
    
    return {
      success: true,
      userId: user.id,
      user: updatedUser,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error,
      };
    }
    
    // Unexpected error
    console.error('[AUTH] Unexpected login error:', error);
    return {
      success: false,
      error: new AppError(
        ErrorCodes.INTERNAL_ERROR.code,
        'Unexpected login error',
        ErrorCodes.INTERNAL_ERROR.userMessage,
        ErrorCodes.INTERNAL_ERROR.statusCode,
        ErrorCodes.INTERNAL_ERROR.recoveryAction
      ),
    };
  }
}

/**
 * Checks if an account is locked and returns lockout information
 */
export async function checkAccountLockout(email: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  attemptCount?: number;
}> {
  const user = await storage.getUserByEmail(email);
  
  if (!user) {
    return { isLocked: false };
  }
  
  const isLocked = await storage.isAccountLocked(user.id);
  
  return {
    isLocked,
    lockedUntil: user.accountLockedUntil || undefined,
    attemptCount: user.failedLoginAttempts || 0,
  };
}

/**
 * Manually unlocks an account (for admin use)
 */
export async function unlockAccount(userId: string): Promise<void> {
  await storage.unlockAccount(userId);
  console.log(`[AUTH] Account ${userId} manually unlocked`);
}
