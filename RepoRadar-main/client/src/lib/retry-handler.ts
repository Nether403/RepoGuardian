import { AppError } from '@/../../shared/errors';
import { errorHandler } from './error-handler';

export interface RetryOptions {
  maxAttempts?: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Handler for retrying failed operations with exponential backoff
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

    let lastError: Error | AppError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt === maxAttempts || !errorHandler.isRetryable(lastError)) {
          throw errorHandler.handle(lastError);
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, backoff, initialDelay, maxDelay);

        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Log retry attempt
        if (import.meta.env.DEV) {
          console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw errorHandler.handle(lastError!);
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(
    attempt: number,
    backoff: 'linear' | 'exponential',
    initialDelay: number,
    maxDelay: number
  ): number {
    if (backoff === 'exponential') {
      // Exponential backoff: delay * 2^(attempt-1)
      const delay = initialDelay * Math.pow(2, attempt - 1);
      return Math.min(delay, maxDelay);
    }

    // Linear backoff: delay * attempt
    const delay = initialDelay * attempt;
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new AppError(
                'TIMEOUT_ERROR',
                timeoutMessage,
                'The request took too long to complete.',
                504,
                'Please try again or try a smaller request'
              )
            ),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Execute with retry and timeout
   */
  async executeWithRetryAndTimeout<T>(
    fn: () => Promise<T>,
    retryOptions: RetryOptions = {},
    timeoutMs: number = 30000
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.executeWithTimeout(fn, timeoutMs),
      retryOptions
    );
  }
}

// Export singleton instance
export const retryHandler = new RetryHandler();
