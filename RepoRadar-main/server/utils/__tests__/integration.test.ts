import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError, ErrorCodes } from '@shared/errors';
import { retryHandler } from '../retryHandler';

describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle GitHub API rate limit error with retry', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.RATE_LIMIT_EXCEEDED.code,
          'Rate limit exceeded',
          ErrorCodes.RATE_LIMIT_EXCEEDED.userMessage,
          429,
          ErrorCodes.RATE_LIMIT_EXCEEDED.recoveryAction,
          { resetTime: new Date('2025-10-03T18:00:00Z').toISOString() }
        )
      );

    // Rate limit errors should not be retried
    await expect(
      retryHandler.executeWithRetry(mockFetch, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toThrow('Rate limit exceeded');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors and succeed', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.NETWORK_ERROR.code,
          'Network error',
          ErrorCodes.NETWORK_ERROR.userMessage,
          0
        )
      )
      .mockResolvedValue({ data: 'success' });

    const result = await retryHandler.executeWithRetry(mockFetch, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 5xx errors and succeed', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.EXTERNAL_API_ERROR.code,
          'Service unavailable',
          ErrorCodes.EXTERNAL_API_ERROR.userMessage,
          502
        )
      )
      .mockResolvedValue({ data: 'success' });

    const result = await retryHandler.executeWithRetry(mockFetch, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should not retry on 4xx client errors', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValue(
        new AppError(
          ErrorCodes.INVALID_INPUT.code,
          'Invalid input',
          ErrorCodes.INVALID_INPUT.userMessage,
          400
        )
      );

    await expect(
      retryHandler.executeWithRetry(mockFetch, {
        maxAttempts: 3,
        initialDelay: 10,
      })
    ).rejects.toThrow('Invalid input');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout errors with retry', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.TIMEOUT_ERROR.code,
          'Request timeout',
          ErrorCodes.TIMEOUT_ERROR.userMessage,
          504
        )
      )
      .mockResolvedValue({ data: 'success' });

    const result = await retryHandler.executeWithRetry(mockFetch, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should preserve error details through retry attempts', async () => {
    const errorDetails = { 
      resetTime: '2025-10-03T18:00:00Z',
      additionalInfo: 'test'
    };
    
    const error = new AppError(
      ErrorCodes.RATE_LIMIT_EXCEEDED.code,
      'Rate limit',
      ErrorCodes.RATE_LIMIT_EXCEEDED.userMessage,
      429,
      ErrorCodes.RATE_LIMIT_EXCEEDED.recoveryAction,
      errorDetails
    );

    const mockFetch = vi.fn().mockRejectedValue(error);

    try {
      await retryHandler.executeWithRetry(mockFetch, {
        maxAttempts: 3,
        initialDelay: 10,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).details).toEqual(errorDetails);
    }
  });

  it('should handle mixed error types correctly', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.NETWORK_ERROR.code,
          'Network error',
          'Network error',
          0
        )
      )
      .mockRejectedValueOnce(
        new AppError(
          ErrorCodes.TIMEOUT_ERROR.code,
          'Timeout',
          'Timeout',
          504
        )
      )
      .mockResolvedValue({ data: 'success' });

    const result = await retryHandler.executeWithRetry(mockFetch, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
