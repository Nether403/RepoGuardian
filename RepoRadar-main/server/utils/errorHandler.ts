import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '@shared/errors';

// Legacy error classes for backward compatibility
export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  isOperational = true;
  resetTime?: Date;

  constructor(message: string = 'Too many requests', resetTime?: Date) {
    super(message);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  isOperational = true;

  constructor(message: string = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Centralized error handling middleware
 * Converts all errors to AppError format and sends appropriate responses
 */
export function createErrorHandler() {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    // Convert to AppError if not already
    let appError: AppError;
    
    if (err instanceof AppError) {
      appError = err;
    } else if (err instanceof RateLimitError) {
      appError = new AppError(
        ErrorCodes.RATE_LIMIT_EXCEEDED.code,
        err.message,
        ErrorCodes.RATE_LIMIT_EXCEEDED.userMessage,
        ErrorCodes.RATE_LIMIT_EXCEEDED.statusCode,
        ErrorCodes.RATE_LIMIT_EXCEEDED.recoveryAction,
        err.resetTime ? { resetTime: err.resetTime.toISOString() } : undefined
      );
    } else if (err instanceof NotFoundError) {
      appError = new AppError(
        ErrorCodes.NOT_FOUND.code,
        err.message,
        ErrorCodes.NOT_FOUND.userMessage,
        ErrorCodes.NOT_FOUND.statusCode,
        ErrorCodes.NOT_FOUND.recoveryAction
      );
    } else if (err instanceof UnauthorizedError) {
      appError = new AppError(
        ErrorCodes.UNAUTHORIZED.code,
        err.message,
        ErrorCodes.UNAUTHORIZED.userMessage,
        ErrorCodes.UNAUTHORIZED.statusCode,
        ErrorCodes.UNAUTHORIZED.recoveryAction
      );
    } else if (err instanceof ValidationError) {
      appError = new AppError(
        ErrorCodes.INVALID_INPUT.code,
        err.message,
        ErrorCodes.INVALID_INPUT.userMessage,
        ErrorCodes.INVALID_INPUT.statusCode,
        ErrorCodes.INVALID_INPUT.recoveryAction
      );
    } else if (err instanceof ServiceUnavailableError) {
      appError = new AppError(
        ErrorCodes.EXTERNAL_API_ERROR.code,
        err.message,
        ErrorCodes.EXTERNAL_API_ERROR.userMessage,
        ErrorCodes.EXTERNAL_API_ERROR.statusCode,
        ErrorCodes.EXTERNAL_API_ERROR.recoveryAction
      );
    } else {
      // Unknown error - convert to generic AppError
      appError = AppError.fromError(err as Error);
    }

    // Log error details for debugging
    console.error('Error occurred:', {
      code: appError.code,
      message: appError.message,
      userMessage: appError.userMessage,
      statusCode: appError.statusCode,
      stack: appError.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: appError.details,
    });

    // Track error in analytics (if available)
    // TODO: Integrate with analytics service when implemented
    
    // Don't leak sensitive error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Send error response in AppError format
    res.status(appError.statusCode).json({
      error: {
        code: appError.code,
        message: appError.userMessage,
        recoveryAction: appError.recoveryAction,
        details: appError.details,
        ...(isDevelopment && {
          technicalMessage: appError.message,
          stack: appError.stack,
        }),
      },
    });
  };
}

export function asyncHandler<T = void>(fn: (req: Request, res: Response, next?: NextFunction) => Promise<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequired(fields: Record<string, unknown>, requiredFields: string[]) {
  const missing = requiredFields.filter(field => !fields[field]);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function handleDatabaseError(error: unknown): AppError {
  // Handle common database errors
  const err = error as { code?: string; message?: string };
  if (err.code === '23505') { // Unique constraint violation
    return new AppError(
      ErrorCodes.INVALID_INPUT.code,
      'Resource already exists',
      'This resource already exists in the database',
      ErrorCodes.INVALID_INPUT.statusCode,
      'Use a different identifier or update the existing resource'
    );
  }
  
  if (err.code === '23503') { // Foreign key constraint violation
    return new AppError(
      ErrorCodes.INVALID_INPUT.code,
      'Referenced resource does not exist',
      'The referenced resource does not exist',
      ErrorCodes.INVALID_INPUT.statusCode,
      'Ensure the referenced resource exists before creating this resource'
    );
  }
  
  if (err.code === '23502') { // Not null constraint violation
    return new AppError(
      ErrorCodes.INVALID_INPUT.code,
      'Required field is missing',
      'A required field is missing',
      ErrorCodes.INVALID_INPUT.statusCode,
      'Provide all required fields'
    );
  }

  // Default to internal server error
  return new AppError(
    ErrorCodes.INTERNAL_ERROR.code,
    `Database operation failed: ${err.message || 'Unknown error'}`,
    ErrorCodes.INTERNAL_ERROR.userMessage,
    ErrorCodes.INTERNAL_ERROR.statusCode,
    ErrorCodes.INTERNAL_ERROR.recoveryAction
  );
}

export function handleExternalServiceError(serviceName: string, error: unknown): AppError {
  console.error(`${serviceName} service error:`, error);
  const err = error as { message?: string; status?: number; response?: { status?: number } };
  
  if (err.response?.status === 404) {
    return new AppError(
      ErrorCodes.NOT_FOUND.code,
      `Resource not found in ${serviceName}`,
      ErrorCodes.NOT_FOUND.userMessage,
      ErrorCodes.NOT_FOUND.statusCode,
      ErrorCodes.NOT_FOUND.recoveryAction
    );
  }
  
  if (err.response?.status === 401 || err.response?.status === 403) {
    return new AppError(
      ErrorCodes.EXTERNAL_API_ERROR.code,
      `${serviceName} authentication failed`,
      ErrorCodes.EXTERNAL_API_ERROR.userMessage,
      ErrorCodes.EXTERNAL_API_ERROR.statusCode,
      ErrorCodes.EXTERNAL_API_ERROR.recoveryAction
    );
  }
  
  if (err.response?.status === 429) {
    return new AppError(
      ErrorCodes.RATE_LIMIT_EXCEEDED.code,
      `${serviceName} rate limit exceeded`,
      ErrorCodes.RATE_LIMIT_EXCEEDED.userMessage,
      ErrorCodes.RATE_LIMIT_EXCEEDED.statusCode,
      ErrorCodes.RATE_LIMIT_EXCEEDED.recoveryAction
    );
  }

  return new AppError(
    ErrorCodes.EXTERNAL_API_ERROR.code,
    `${serviceName} is temporarily unavailable`,
    ErrorCodes.EXTERNAL_API_ERROR.userMessage,
    ErrorCodes.EXTERNAL_API_ERROR.statusCode,
    ErrorCodes.EXTERNAL_API_ERROR.recoveryAction
  );
}