import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryHandler } from '../retryHandler';
import { AppError, ErrorCodes } from '@shared/errors';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler();
    vi.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new AppError(
          ErrorCodes.NETWORK_ERROR.code,
          'Network error',
          'Network error',
          0
        ))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new AppError(
        ErrorCodes.INVALID_INPUT.code,
        'Invalid input',
        'Invalid input',
        400
      );
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryHandler.executeWithRetry(fn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow(error);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max attempts', async () => {
      const error = new AppError(
        ErrorCodes.NETWORK_ERROR.code,
        'Network error',
        'Network error',
        0
      );
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryHandler.executeWithRetry(fn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow(error);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const error = new AppError(
        ErrorCodes.TIMEOUT_ERROR.code,
        'Timeout',
        'Timeout',
        504
      );
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error);
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const originalSleep = (retryHandler as any).sleep;
      (retryHandler as any).sleep = vi.fn((ms: number) => {
        delays.push(ms);
        return originalSleep.call(retryHandler, 0); // Don't actually wait
      });

      const error = new AppError(
        ErrorCodes.EXTERNAL_API_ERROR.code,
        'API error',
        'API error',
        502
      );
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 100,
      });

      // First delay should be around 100ms, second around 200ms (with jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(70);
      expect(delays[0]).toBeLessThanOrEqual(130);
      expect(delays[1]).toBeGreaterThanOrEqual(140);
      expect(delays[1]).toBeLessThanOrEqual(260);
    });

    it('should use linear backoff', async () => {
      const delays: number[] = [];
      const originalSleep = (retryHandler as any).sleep;
      (retryHandler as any).sleep = vi.fn((ms: number) => {
        delays.push(ms);
        return originalSleep.call(retryHandler, 0);
      });

      const error = new AppError(
        ErrorCodes.EXTERNAL_API_ERROR.code,
        'API error',
        'API error',
        502
      );
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        backoff: 'linear',
        initialDelay: 100,
      });

      // First delay should be around 100ms, second around 200ms (with jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(70);
      expect(delays[0]).toBeLessThanOrEqual(130);
      expect(delays[1]).toBeGreaterThanOrEqual(140);
      expect(delays[1]).toBeLessThanOrEqual(260);
    });

    it('should respect max delay', async () => {
      const delays: number[] = [];
      const originalSleep = (retryHandler as any).sleep;
      (retryHandler as any).sleep = vi.fn((ms: number) => {
        delays.push(ms);
        return originalSleep.call(retryHandler, 0);
      });

      const error = new AppError(
        ErrorCodes.EXTERNAL_API_ERROR.code,
        'API error',
        'API error',
        502
      );
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 1500,
      });

      // All delays should be capped at maxDelay + jitter
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(1950); // 1500 + 30% jitter
      });
    });

    it('should not retry rate limit errors', async () => {
      const error = new AppError(
        ErrorCodes.RATE_LIMIT_EXCEEDED.code,
        'Rate limit',
        'Rate limit',
        429
      );
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryHandler.executeWithRetry(fn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow(error);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry 5xx errors', async () => {
      const error = new AppError(
        ErrorCodes.INTERNAL_ERROR.code,
        'Internal error',
        'Internal error',
        500
      );
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry network error codes', async () => {
      const error = Object.assign(new Error('Connection reset'), {
        code: 'ECONNRESET',
      });
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
