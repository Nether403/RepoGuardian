/**
 * Performance Tracking Middleware
 * Tracks request duration and records metrics
 * Requirements: 10.5
 */

import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../performance/metrics';

/**
 * Middleware to track request duration
 */
export function trackRequestDuration(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override the end function to record metrics
  res.end = function(this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;
    
    // Record request metric
    metricsCollector.recordRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: Date.now(),
      userId: (req as any).user?.id,
    });
    
    // Call the original end function
    return originalEnd.apply(this, args);
  };
  
  next();
}
