import { AppError } from '@/../../shared/errors';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized error handler for classifying and converting errors
 */
export class ErrorHandler {
  /**
   * Handle an error and convert it to an AppError
   */
  handle(error: Error | AppError, context?: ErrorContext): AppError {
    // Log error with context
    this.logError(error, context);

    // Convert to AppError if needed
    const appError = this.convertToAppError(error);

    // Ensure recovery action is set
    if (!appError.recoveryAction) {
      appError.recoveryAction = this.getRecoveryAction(appError);
    }

    return appError;
  }

  /**
   * Convert any error to AppError
   */
  private convertToAppError(error: Error | AppError): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Check for network errors
    if (this.isNetworkError(error)) {
      return new AppError(
        'NETWORK_ERROR',
        error.message,
        'A network error occurred. Please check your connection.',
        0,
        'Check your internet connection and retry'
      );
    }

    // Check for rate limit errors
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return new AppError(
        'RATE_LIMIT_EXCEEDED',
        error.message,
        'GitHub API rate limit exceeded. Please try again later.',
        429,
        'Wait for rate limit to reset or use authentication'
      );
    }

    // Check for timeout errors
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return new AppError(
        'TIMEOUT_ERROR',
        error.message,
        'The request took too long to complete.',
        504,
        'Please try again or try a smaller request'
      );
    }

    // Check for not found errors
    if (error.message.includes('404') || error.message.includes('not found')) {
      return new AppError(
        'NOT_FOUND',
        error.message,
        'The requested resource was not found.',
        404,
        'Verify the repository exists and is accessible'
      );
    }

    // Check for authentication errors
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      return new AppError(
        'UNAUTHORIZED',
        error.message,
        'Authentication required to access this resource.',
        401,
        'Please sign in and try again'
      );
    }

    // Check for permission errors
    if (error.message.includes('403') || error.message.includes('forbidden')) {
      return new AppError(
        'FORBIDDEN',
        error.message,
        'You do not have permission to access this resource.',
        403,
        'Check your permissions or contact an administrator'
      );
    }

    // Default error
    return new AppError(
      'UNKNOWN_ERROR',
      error.message,
      'An unexpected error occurred. Please try again.',
      500,
      'Please try again or contact support'
    );
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.message.includes('network') ||
      error.message.includes('fetch failed')
    );
  }

  /**
   * Get recovery action for an error
   */
  private getRecoveryAction(error: AppError): string {
    const recoveryActions: Record<string, string> = {
      RATE_LIMIT_EXCEEDED: 'Wait for rate limit to reset or use authentication',
      NETWORK_ERROR: 'Check your internet connection and retry',
      TIMEOUT_ERROR: 'Please try again or try a smaller request',
      INVALID_INPUT: 'Please check your input and try again',
      NOT_FOUND: 'Verify the repository exists and is accessible',
      UNAUTHORIZED: 'Please sign in and try again',
      FORBIDDEN: 'Check your permissions or contact an administrator',
      DATABASE_ERROR: 'If the problem persists, contact support',
      EXTERNAL_API_ERROR: 'Please try again in a few moments',
      ANALYSIS_FAILED: 'Try again with a different repository or contact support',
      EXPORT_FAILED: 'Try again or try a different export format',
    };

    return recoveryActions[error.code] || 'Please try again or contact support';
  }

  /**
   * Log error with context
   */
  private logError(error: Error | AppError, context?: ErrorContext): void {
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(error instanceof AppError && {
        code: error.code,
        userMessage: error.userMessage,
        statusCode: error.statusCode,
      }),
      context,
      timestamp: new Date().toISOString(),
    };

    // In development, log to console
    if (import.meta.env.DEV) {
      console.error('Error occurred:', errorInfo);
    }

    // In production, you would send to error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: Error | AppError): boolean {
    if (error instanceof AppError) {
      // Network errors are retryable
      if (error.code === 'NETWORK_ERROR' || error.code === 'CONNECTION_TIMEOUT') {
        return true;
      }

      // 5xx errors are retryable
      if (error.statusCode >= 500 && error.statusCode < 600) {
        return true;
      }

      // Timeout errors are retryable
      if (error.code === 'TIMEOUT_ERROR') {
        return true;
      }

      // Unknown errors are retryable (could be transient)
      if (error.code === 'UNKNOWN_ERROR') {
        return true;
      }

      // Rate limit errors are not retryable (need to wait)
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return false;
      }

      // 4xx errors (except 429) are not retryable
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
    }

    // Check for network error codes
    const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    if ('code' in error && networkErrorCodes.includes(error.code as string)) {
      return true;
    }

    // By default, regular errors are retryable
    return true;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
