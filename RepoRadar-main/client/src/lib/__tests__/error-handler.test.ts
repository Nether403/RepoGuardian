import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler } from '../error-handler';
import { AppError } from '@/../../shared/errors';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('handle', () => {
    it('should return AppError as-is', () => {
      const appError = new AppError(
        'TEST_ERROR',
        'Internal message',
        'User message',
        500
      );

      const result = errorHandler.handle(appError);

      expect(result).toBe(appError);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Something went wrong');

      const result = errorHandler.handle(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.userMessage).toBe('An unexpected error occurred. Please try again.');
    });

    it('should add recovery action if missing', () => {
      const appError = new AppError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limit exceeded',
        'Too many requests',
        429
      );
      appError.recoveryAction = undefined;

      const result = errorHandler.handle(appError);

      expect(result.recoveryAction).toBeDefined();
      expect(result.recoveryAction).toContain('rate limit');
    });
  });

  describe('convertToAppError', () => {
    it('should detect rate limit errors', () => {
      const error = new Error('API rate limit exceeded');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.statusCode).toBe(429);
      expect(result.userMessage).toContain('rate limit');
    });

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.statusCode).toBe(504);
      expect(result.userMessage).toContain('too long');
    });

    it('should detect not found errors', () => {
      const error = new Error('Resource not found');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('NOT_FOUND');
      expect(result.statusCode).toBe(404);
      expect(result.userMessage).toContain('not found');
    });

    it('should detect unauthorized errors', () => {
      const error = new Error('401 unauthorized');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('UNAUTHORIZED');
      expect(result.statusCode).toBe(401);
      expect(result.userMessage).toContain('Authentication');
    });

    it('should detect forbidden errors', () => {
      const error = new Error('403 forbidden');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('FORBIDDEN');
      expect(result.statusCode).toBe(403);
      expect(result.userMessage).toContain('permission');
    });

    it('should detect network errors by code', () => {
      const error = new Error('Connection failed') as any;
      error.code = 'ECONNRESET';

      const result = errorHandler.handle(error);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.userMessage).toContain('network');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Random error');

      const result = errorHandler.handle(error);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.userMessage).toContain('unexpected error');
    });
  });

  describe('isRetryable', () => {
    it('should mark network errors as retryable', () => {
      const error = new AppError(
        'NETWORK_ERROR',
        'Network failed',
        'Network error',
        0
      );

      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should mark 5xx errors as retryable', () => {
      const error = new AppError(
        'INTERNAL_ERROR',
        'Server error',
        'Server error',
        500
      );

      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should mark timeout errors as retryable', () => {
      const error = new AppError(
        'TIMEOUT_ERROR',
        'Timeout',
        'Timeout',
        504
      );

      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should not mark rate limit errors as retryable', () => {
      const error = new AppError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limit',
        'Rate limit',
        429
      );

      expect(errorHandler.isRetryable(error)).toBe(false);
    });

    it('should not mark 4xx errors as retryable', () => {
      const error = new AppError(
        'NOT_FOUND',
        'Not found',
        'Not found',
        404
      );

      expect(errorHandler.isRetryable(error)).toBe(false);
    });

    it('should mark errors with network error codes as retryable', () => {
      const error = new Error('Connection failed') as any;
      error.code = 'ECONNRESET';

      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should handle ETIMEDOUT error code', () => {
      const error = new Error('Timeout') as any;
      error.code = 'ETIMEDOUT';

      expect(errorHandler.isRetryable(error)).toBe(true);
    });
  });

  describe('getRecoveryAction', () => {
    it('should provide recovery action for rate limit', () => {
      const error = new AppError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limit',
        'Rate limit',
        429
      );

      const result = errorHandler.handle(error);

      expect(result.recoveryAction).toContain('rate limit');
    });

    it('should provide recovery action for network error', () => {
      const error = new AppError(
        'NETWORK_ERROR',
        'Network error',
        'Network error',
        0
      );

      const result = errorHandler.handle(error);

      expect(result.recoveryAction).toContain('connection');
    });

    it('should provide default recovery action for unknown errors', () => {
      const error = new AppError(
        'CUSTOM_ERROR',
        'Custom error',
        'Custom error',
        500
      );

      const result = errorHandler.handle(error);

      expect(result.recoveryAction).toContain('try again');
    });
  });
});
