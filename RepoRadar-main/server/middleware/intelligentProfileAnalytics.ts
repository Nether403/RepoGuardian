import { Request, Response, NextFunction } from 'express';
import { getGlobalPerformanceMonitor } from '../performance/index.js';
import { trackEvent } from './analytics';

interface AuthenticatedRequest extends Request {
  user?: {
    claims?: {
      sub?: string;
    };
  };
}

/**
 * Middleware to track performance metrics for intelligent profile endpoints
 * Monitors API response times and tracks feature usage by tier
 */
export function intelligentProfilePerformanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.claims?.sub;
  
  // Store original end function
  const originalEnd = res.end;

  // Override end function to track after response
  res.end = function(this: Response, ...args: any[]): Response {
    // Restore original end
    res.end = originalEnd;

    // Call original end
    const result = originalEnd.apply(this, args);

    // Track performance asynchronously (don't block response)
    setImmediate(async () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const path = req.path;

      // Record performance metric
      try {
        const performanceMonitor = getGlobalPerformanceMonitor();
        await performanceMonitor.recordAPIMetric({
          endpoint: path,
          statusCode,
          responseTime: duration,
          requestSize: parseInt(req.headers?.['content-length'] || '0'),
          responseSize: parseInt(res.getHeader?.('content-length')?.toString() || '0'),
        });
      } catch (error) {
        console.error('Error recording API metric:', error);
      }

      // Track feature usage by tier if user is authenticated
      if (userId && statusCode === 200) {
        try {
          const { storage } = await import('../storage');
          const user = await storage.getUser(userId);
          
          if (user) {
            // Determine feature from path
            let feature = 'unknown';
            if (path.includes('/bookmarks')) feature = 'bookmarks';
            else if (path.includes('/tags')) feature = 'tags';
            else if (path.includes('/preferences')) feature = 'preferences';
            else if (path.includes('/recommendations')) feature = 'recommendations';

            // Track feature usage by tier
            await trackEvent(req, 'intelligent_profile_feature_used', 'profile', {
              feature,
              tier: user.subscriptionTier || 'free',
              duration,
              method: req.method,
            });
          }
        } catch (error) {
          console.error('Error tracking feature usage by tier:', error);
        }
      }

      // Log slow requests (over 1 second)
      if (duration > 1000) {
        console.warn(`[Performance] Slow intelligent profile request: ${req.method} ${path} took ${duration}ms`);
      }
    });

    return result;
  };

  next();
}

/**
 * Track recommendation generation performance
 */
export async function trackRecommendationPerformance(
  userId: string,
  duration: number,
  recommendationCount: number,
  source: 'cache' | 'ai'
): Promise<void> {
  try {
    const performanceMonitor = getGlobalPerformanceMonitor();
    
    // Record recommendation generation time as an API metric
    await performanceMonitor.recordAPIMetric({
      endpoint: '/api/recommendations',
      statusCode: 200,
      responseTime: duration,
      requestSize: 0,
      responseSize: recommendationCount * 1000, // Approximate size
    });
  } catch (error) {
    console.error('Error recording recommendation performance:', error);
  }

  // Log if generation took too long (over 3 seconds)
  if (source === 'ai' && duration > 3000) {
    console.warn(`[Performance] Slow recommendation generation for user ${userId}: ${duration}ms`);
  }
}
