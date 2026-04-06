import { AppError, ErrorCodes } from '@shared/errors';

export interface RetryOptions {
  maxAttempts?: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry handler for executing operations with exponential backoff
 */
export class RetryHandler {
  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      backoff = 'exponential',
      initialDelay = 1000,
      maxDelay = 10000,
      onRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry if this is the last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, backoff, initialDelay, maxDelay);
        console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay`);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw lastError!;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(error: unknown): boolean {
    // AppError instances
    if (error instanceof AppError) {
      // Network errors are retryable
      if (error.code === ErrorCodes.NETWORK_ERROR.code || 
          error.code === ErrorCodes.CONNECTION_TIMEOUT.code) {
        return true;
      }

      // Timeout errors are retryable
      if (error.code === ErrorCodes.TIMEOUT_ERROR.code) {
        return true;
      }

      // External API errors (5xx) are retryable
      if (error.code === ErrorCodes.EXTERNAL_API_ERROR.code) {
        return true;
      }

      // Rate limit errors are NOT retryable (need to wait for reset)
      if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED.code) {
        return false;
      }

      // 4xx errors are NOT retryable (client errors)
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }

      // 5xx errors are retryable
      if (error.statusCode >= 500) {
        return true;
      }
    }

    // Type guard for error-like objects
    const err = error as { code?: string; response?: { status?: number } };

    // Network error codes
    if (err.code === 'ECONNRESET' || 
        err.code === 'ETIMEDOUT' || 
        err.code === 'ENOTFOUND' ||
        err.code === 'ECONNREFUSED') {
      return true;
    }

    // HTTP status codes
    if (err.response?.status) {
      const status = err.response.status;
      
      // 5xx errors are retryable
      if (status >= 500) {
        return true;
      }
      
      // 429 (rate limit) is not retryable without waiting
      if (status === 429) {
        return false;
      }
      
      // 4xx errors are not retryable
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // Default: don't retry unknown errors
    return false;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(
    attempt: number,
    backoff: 'linear' | 'exponential',
    initialDelay: number,
    maxDelay: number
  ): number {
    let delay: number;

    if (backoff === 'exponential') {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      delay = initialDelay * Math.pow(2, attempt - 1);
    } else {
      // Linear backoff: 1s, 2s, 3s, 4s, etc.
      delay = initialDelay * attempt;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay; // ±30% jitter
    delay = delay + jitter;

    // Cap at max delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const retryHandler = new RetryHandler();
