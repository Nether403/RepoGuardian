import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryHandler } from '../retry-handler';
import { AppError } from '@/../../shared/errors';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10, // Use small delay for tests
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const error = new Error('Persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryHandler.executeWithRetry(fn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new AppError(
        'NOT_FOUND',
        'Not found',
        'Resource not found',
        404
      );
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryHandler.executeWithRetry(fn, {
          maxAttempts: 3,
        })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff by default', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        backoff: 'exponential',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use linear backoff when specified', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        backoff: 'linear',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 15,
        backoff: 'exponential',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const error = new Error('Fail');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(fn, {
        maxAttempts: 2,
        initialDelay: 10,
        onRetry,
      });

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error);
    });
  });

  describe('executeWithTimeout', () => {
    it('should succeed before timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithTimeout(fn, 1000);

      expect(result).toBe('success');
    });

    it('should throw timeout error', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('success'), 2000);
          })
      );

      await expect(
        retryHandler.executeWithTimeout(fn, 100, 'Custom timeout')
      ).rejects.toThrow(AppError);
    });

    it('should use custom timeout message', async () => {
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('success'), 2000);
          })
      );

      await expect(
        retryHandler.executeWithTimeout(fn, 100, 'Operation took too long')
      ).rejects.toMatchObject({
        message: 'Operation took too long',
      });
    });
  });

  describe('executeWithRetryAndTimeout', () => {
    it('should combine retry and timeout logic', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetryAndTimeout(
        fn,
        { maxAttempts: 3, initialDelay: 10 },
        5000
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on timeout', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            callCount++;
            if (callCount < 2) {
              setTimeout(() => resolve('success'), 2000);
            } else {
              resolve('success');
            }
          })
      );

      const result = await retryHandler.executeWithRetryAndTimeout(
        fn,
        { maxAttempts: 3, initialDelay: 10 },
        100
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const handler = new RetryHandler();
      
      // Access private method through type assertion
      const calculateDelay = (handler as any).calculateDelay.bind(handler);

      expect(calculateDelay(1, 'exponential', 1000, 10000)).toBe(1000); // 1000 * 2^0
      expect(calculateDelay(2, 'exponential', 1000, 10000)).toBe(2000); // 1000 * 2^1
      expect(calculateDelay(3, 'exponential', 1000, 10000)).toBe(4000); // 1000 * 2^2
      expect(calculateDelay(4, 'exponential', 1000, 10000)).toBe(8000); // 1000 * 2^3
      expect(calculateDelay(5, 'exponential', 1000, 10000)).toBe(10000); // capped at maxDelay
    });

    it('should calculate linear backoff correctly', () => {
      const handler = new RetryHandler();
      const calculateDelay = (handler as any).calculateDelay.bind(handler);

      expect(calculateDelay(1, 'linear', 1000, 10000)).toBe(1000); // 1000 * 1
      expect(calculateDelay(2, 'linear', 1000, 10000)).toBe(2000); // 1000 * 2
      expect(calculateDelay(3, 'linear', 1000, 10000)).toBe(3000); // 1000 * 3
      expect(calculateDelay(11, 'linear', 1000, 10000)).toBe(10000); // capped at maxDelay
    });
  });
});
