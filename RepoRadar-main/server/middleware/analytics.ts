import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../analytics';

/**
 * Generate a session ID from request
 * In production, this should use a proper session management system
 */
function getSessionId(req: Request): string {
  // Try to get session ID from cookie or header
  const sessionId = req.cookies?.sessionId || 
                   req.headers['x-session-id'] as string ||
                   `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return sessionId;
}

/**
 * Get user ID from authenticated request
 */
function getUserId(req: Request): string | undefined {
  const authReq = req as Request & { user?: { claims?: { sub?: string } } };
  return authReq.user?.claims?.sub;
}

/**
 * Analytics middleware to track API requests
 */
export function analyticsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const sessionId = getSessionId(req);
  const userId = getUserId(req);

  // Store original end function
  const originalEnd = res.end;

  // Override end function to track after response
  res.end = function(this: Response, ...args: any[]): Response {
    // Restore original end
    res.end = originalEnd;

    // Call original end
    const result = originalEnd.apply(this, args);

    // Track analytics asynchronously (don't block response)
    setImmediate(() => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Track API request event
      analyticsService.trackEvent({
        name: 'api_request',
        category: 'api',
        properties: {
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          userAgent: req.headers['user-agent'],
        },
        sessionId,
        userId,
      }).catch(error => {
        console.error('Error tracking API request:', error);
      });

      // Track errors separately
      if (statusCode >= 400) {
        analyticsService.trackEvent({
          name: 'api_error',
          category: 'error',
          properties: {
            method: req.method,
            path: req.path,
            statusCode,
            duration,
          },
          sessionId,
          userId,
        }).catch(error => {
          console.error('Error tracking API error:', error);
        });
      }
    });

    return result;
  };

  next();
}

/**
 * Track specific events from route handlers
 */
export async function trackEvent(
  req: Request,
  eventName: string,
  category: string,
  properties?: Record<string, any>
): Promise<void> {
  const sessionId = getSessionId(req);
  const userId = getUserId(req);

  await analyticsService.trackEvent({
    name: eventName,
    category,
    properties: properties || {},
    sessionId,
    userId,
  });
}
