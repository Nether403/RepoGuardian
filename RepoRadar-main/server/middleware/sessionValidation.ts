import type { Request, Response, NextFunction } from 'express';
import { SessionService } from '../auth/sessionService';

/**
 * Middleware to validate session metadata and detect suspicious activity
 */
export function sessionValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip validation for public routes
  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    // Update session metadata (last accessed time)
    SessionService.updateSessionMetadata(req);

    // Check for suspicious activity
    if (SessionService.detectSuspiciousActivity(req)) {
      console.warn('Suspicious activity detected, invalidating session');
      
      // Invalidate session asynchronously
      void SessionService.handleSuspiciousActivity(req, res)
        .then(() => {
          void res.status(401).json({ 
            error: 'Session invalidated due to suspicious activity',
            code: 'SESSION_INVALIDATED'
          });
        })
        .catch((error) => {
          console.error('Error handling suspicious activity:', error);
          void res.status(500).json({ error: 'Internal server error' });
        });
      
      return;
    }

    // Session is valid, continue
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next(error);
  }
}

/**
 * Middleware to enforce session timeout with sliding window
 * This is already handled by express-session's rolling option,
 * but we add an additional check for custom timeout logic
 */
export function sessionTimeoutMiddleware(timeoutMs: number = 30 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip timeout check for public routes
    if (!req.session || !req.session.userId) {
      return next();
    }

    try {
      // Check if session has timed out
      if (SessionService.isSessionTimedOut(req, timeoutMs)) {
        console.log('Session timed out, destroying session');
        
        // Destroy session asynchronously
        void SessionService.destroySession(req, res)
          .then(() => {
            void res.status(401).json({ 
              error: 'Session expired due to inactivity',
              code: 'SESSION_TIMEOUT'
            });
          })
          .catch((error) => {
            console.error('Error destroying timed out session:', error);
            void res.status(500).json({ error: 'Internal server error' });
          });
        
        return;
      }

      // Session is still valid, continue
      next();
    } catch (error) {
      console.error('Session timeout check error:', error);
      next(error);
    }
  };
}

/**
 * Middleware to validate session metadata matches current request
 * This helps prevent session hijacking
 */
export function sessionMetadataValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip validation for public routes
  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    // Validate session metadata
    if (!SessionService.validateSessionMetadata(req)) {
      console.warn('Session metadata validation failed, possible session hijacking');
      
      // Invalidate session asynchronously
      void SessionService.destroySession(req, res)
        .then(() => {
          void res.status(401).json({ 
            error: 'Session validation failed',
            code: 'SESSION_VALIDATION_FAILED'
          });
        })
        .catch((error) => {
          console.error('Error destroying invalid session:', error);
          void res.status(500).json({ error: 'Internal server error' });
        });
      
      return;
    }

    // Metadata is valid, continue
    next();
  } catch (error) {
    console.error('Session metadata validation error:', error);
    next(error);
  }
}

/**
 * Combined session security middleware
 * Applies all session validation checks in one middleware
 */
export function sessionSecurityMiddleware(options: {
  timeoutMs?: number;
  validateMetadata?: boolean;
  detectSuspicious?: boolean;
} = {}) {
  const {
    timeoutMs = 30 * 60 * 1000, // 30 minutes default
    validateMetadata = true,
    detectSuspicious = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip validation for public routes
    if (!req.session || !req.session.userId) {
      return next();
    }

    try {
      // Update session metadata (last accessed time)
      SessionService.updateSessionMetadata(req);

      // Check session timeout
      if (SessionService.isSessionTimedOut(req, timeoutMs)) {
        console.log('[Session] Session timed out, destroying session');
        await SessionService.destroySession(req, res);
        res.status(401).json({ 
          error: 'Session expired due to inactivity',
          code: 'SESSION_TIMEOUT'
        });
        return;
      }

      // Refresh session if it's close to expiring (sliding window)
      if (SessionService.shouldRefreshSession(req, timeoutMs)) {
        console.log('[Session] Refreshing session to extend lifetime');
        await SessionService.refreshSession(req);
      }

      // Validate session metadata if enabled
      if (validateMetadata && !SessionService.validateSessionMetadata(req)) {
        console.warn('[Session] Session metadata validation failed, possible session hijacking');
        await SessionService.destroySession(req, res);
        res.status(401).json({ 
          error: 'Session validation failed',
          code: 'SESSION_VALIDATION_FAILED'
        });
        return;
      }

      // Detect suspicious activity if enabled
      if (detectSuspicious && SessionService.detectSuspiciousActivity(req)) {
        console.warn('[Session] Suspicious activity detected, invalidating session');
        await SessionService.handleSuspiciousActivity(req, res);
        res.status(401).json({ 
          error: 'Session invalidated due to suspicious activity',
          code: 'SESSION_INVALIDATED'
        });
        return;
      }

      // All checks passed, continue
      next();
    } catch (error) {
      console.error('[Session] Session security middleware error:', error);
      next(error);
    }
  };
}
