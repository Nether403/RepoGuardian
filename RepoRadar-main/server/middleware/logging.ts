import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger, correlationStorage } from '../monitoring/Logger.js';
import { metricsService } from '../monitoring/MetricsService.js';

/**
 * Logging Middleware
 * Adds correlation IDs and tracks request/response metrics
 */

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  startTime?: number;
}

/**
 * Correlation ID middleware
 * Generates or extracts correlation ID and sets it in async context
 */
export function correlationIdMiddleware(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Get correlation ID from header or generate new one
  const correlationId = 
    (req.headers['x-correlation-id'] as string) || 
    (req.headers['x-request-id'] as string) ||
    uuidv4();
  
  // Store in request
  req.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-Id', correlationId);
  
  // Run rest of request in correlation context
  correlationStorage.run(correlationId, () => {
    next();
  });
}

/**
 * Request logging middleware
 * Logs incoming requests with context
 */
export function requestLoggingMiddleware(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Record start time
  req.startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    correlationId: req.correlationId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  
  next();
}

/**
 * Response logging middleware
 * Logs outgoing responses with metrics
 */
export function responseLoggingMiddleware(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function
  res.end = function(this: Response, ...args: any[]): Response {
    // Calculate duration
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    // Log response
    logger.info('Outgoing response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      correlationId: req.correlationId,
    });
    
    // Record metrics
    metricsService.recordResponseTime({
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
    });
    
    // Record error if status code indicates error
    if (res.statusCode >= 400) {
      metricsService.recordError({
        path: req.path,
        method: req.method,
        errorCode: res.statusCode.toString(),
        errorMessage: res.statusMessage || 'Unknown error',
        timestamp: new Date(),
      });
    }
    
    // Call original end
    return originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Error logging middleware
 * Logs errors with full context
 */
export function errorLoggingMiddleware(
  err: Error,
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
    statusCode: res.statusCode,
  });
  
  // Record error metric
  metricsService.recordError({
    path: req.path,
    method: req.method,
    errorCode: (err as any).code || 'UNKNOWN_ERROR',
    errorMessage: err.message,
    timestamp: new Date(),
  });
  
  // Pass to next error handler
  next(err);
}

/**
 * Combined logging middleware
 * Applies all logging middleware in correct order
 */
export function loggingMiddleware() {
  return [
    correlationIdMiddleware,
    requestLoggingMiddleware,
    responseLoggingMiddleware,
  ];
}
