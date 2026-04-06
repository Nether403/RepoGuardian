import type { Request, Response } from 'express';
import { storage } from '../storage';

/**
 * Session metadata interface
 */
export interface SessionMetadata {
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastAccessedAt: Date;
  userId?: string;
}

/**
 * Session service for managing user sessions with security features
 */
export class SessionService {
  /**
   * Regenerate session ID to prevent session fixation attacks
   * Should be called on login and authentication state changes
   */
  static async regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!req.session) {
        return reject(new Error('Session not initialized'));
      }

      // Store old session data
      const oldSessionData = { ...req.session };
      
      // Regenerate session ID
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return reject(err);
        }

        // Restore session data (except session ID)
        Object.assign(req.session, oldSessionData);
        
        resolve();
      });
    });
  }

  /**
   * Create session metadata from request
   */
  static createSessionMetadata(req: Request): SessionMetadata {
    const ip = this.getClientIp(req);
    const userAgent = req.get('user-agent') || 'unknown';
    
    return {
      ip,
      userAgent,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      userId: req.session?.userId,
    };
  }

  /**
   * Initialize session with metadata on login
   */
  static async initializeSession(req: Request, userId: string): Promise<void> {
    if (!req.session) {
      throw new Error('Session not initialized');
    }

    // Regenerate session ID to prevent fixation
    await this.regenerateSession(req);

    // Set user ID
    req.session.userId = userId;

    // Store session metadata
    const metadata = this.createSessionMetadata(req);
    req.session.metadata = metadata;

    // Update last login information in database
    const ip = this.getClientIp(req);
    await storage.updateUserLastLogin(userId, ip);

    console.log(`Session initialized for user ${userId} from IP ${ip}`);
  }

  /**
   * Update session metadata on each request
   */
  static updateSessionMetadata(req: Request): void {
    if (!req.session || !req.session.metadata) {
      return;
    }

    req.session.metadata.lastAccessedAt = new Date();
  }

  /**
   * Validate session metadata for security checks
   */
  static validateSessionMetadata(req: Request): boolean {
    if (!req.session || !req.session.metadata) {
      return false;
    }

    const currentIp = this.getClientIp(req);
    const currentUserAgent = req.get('user-agent') || 'unknown';
    const metadata = req.session.metadata;

    // Check if IP address changed (potential session hijacking)
    if (metadata.ip !== currentIp) {
      console.warn(`Session IP mismatch: expected ${metadata.ip}, got ${currentIp}`);
      return false;
    }

    // Check if user agent changed (potential session hijacking)
    if (metadata.userAgent !== currentUserAgent) {
      console.warn(`Session user agent mismatch: expected ${metadata.userAgent}, got ${currentUserAgent}`);
      return false;
    }

    return true;
  }

  /**
   * Destroy session on logout
   */
  static async destroySession(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!req.session) {
        return resolve();
      }

      const userId = req.session.userId;

      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return reject(err);
        }

        // Clear session cookie
        res.clearCookie('reporadar.sid', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        });

        if (userId) {
          console.log(`Session destroyed for user ${userId}`);
        }

        resolve();
      });
    });
  }

  /**
   * Invalidate all sessions for a user (logout all devices)
   * This requires storing session IDs in the database
   */
  static async invalidateAllUserSessions(userId: string): Promise<void> {
    // This would require a session store that supports querying by user ID
    // For now, we'll mark the user as requiring re-authentication
    await storage.invalidateUserSessions(userId);
    console.log(`All sessions invalidated for user ${userId}`);
  }

  /**
   * Get client IP address from request
   */
  private static getClientIp(req: Request): string {
    // Check for proxy headers first
    const forwarded = req.get('x-forwarded-for');
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }

    const realIp = req.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // Fallback to socket address
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Check if session has timed out
   */
  static isSessionTimedOut(req: Request, timeoutMs: number = 30 * 60 * 1000): boolean {
    if (!req.session || !req.session.metadata) {
      return true;
    }

    const lastAccessed = new Date(req.session.metadata.lastAccessedAt);
    const now = new Date();
    const timeSinceLastAccess = now.getTime() - lastAccessed.getTime();

    return timeSinceLastAccess > timeoutMs;
  }

  /**
   * Refresh session to extend its lifetime
   * Should be called on user activity to implement sliding window expiration
   */
  static async refreshSession(req: Request): Promise<void> {
    if (!req.session || !req.session.metadata) {
      return;
    }

    // Update last accessed time
    req.session.metadata.lastAccessedAt = new Date();

    // Touch the session to update its expiration in the store
    return new Promise((resolve, reject) => {
      req.session.touch();
      req.session.save((err) => {
        if (err) {
          console.error('Session refresh error:', err);
          return reject(err);
        }
        resolve();
      });
    });
  }

  /**
   * Check if session needs refresh (within refresh window)
   * Returns true if session is close to expiring and should be refreshed
   */
  static shouldRefreshSession(req: Request, timeoutMs: number = 30 * 60 * 1000, refreshWindowMs: number = 5 * 60 * 1000): boolean {
    if (!req.session || !req.session.metadata) {
      return false;
    }

    const lastAccessed = new Date(req.session.metadata.lastAccessedAt);
    const now = new Date();
    const timeSinceLastAccess = now.getTime() - lastAccessed.getTime();

    // Refresh if we're within the refresh window before timeout
    return timeSinceLastAccess > (timeoutMs - refreshWindowMs) && timeSinceLastAccess < timeoutMs;
  }

  /**
   * Detect suspicious activity based on session metadata
   */
  static detectSuspiciousActivity(req: Request): boolean {
    if (!req.session || !req.session.metadata) {
      return false;
    }

    // Check for metadata validation failures
    if (!this.validateSessionMetadata(req)) {
      return true;
    }

    // Check for session timeout
    if (this.isSessionTimedOut(req)) {
      return true;
    }

    // Additional checks can be added here:
    // - Unusual access patterns
    // - Geographic location changes
    // - Multiple rapid requests
    // - etc.

    return false;
  }

  /**
   * Handle suspicious activity by invalidating session
   */
  static async handleSuspiciousActivity(req: Request, res: Response): Promise<void> {
    const userId = req.session?.userId;
    
    if (userId) {
      console.warn(`Suspicious activity detected for user ${userId}`);
    }

    await this.destroySession(req, res);
  }
}

/**
 * Extend express-session types
 */
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    metadata?: SessionMetadata;
  }
}
