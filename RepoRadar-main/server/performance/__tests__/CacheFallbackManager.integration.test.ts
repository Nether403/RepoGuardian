import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { CacheFallbackManager, createCacheFallbackManager } from '../CacheFallbackManager';
import { ICacheManager, CacheEntry, CacheStats, CacheConfig } from '../interfaces';

// Mock cache manager that can be made to fail
class MockCacheManager implements ICacheManager {
  private shouldFail = false;
  private failureCount = 0;
  private data = new Map<string, any>();

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
    if (fail) {
      this.failureCount = 0;
    }
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  private maybeThrow(): void {
    if (this.shouldFail) {
      this.failureCount++;
      throw new Error('Mock cache failure');
    }
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    this.maybeThrow();
    this.data.set(key, data);
  }

  async get<T = any>(key: string): Promise<T | null> {
    this.maybeThrow();
    return this.data.get(key) || null;
  }

  async has(key: string): Promise<boolean> {
    this.maybeThrow();
    return this.data.has(key);
  }

  async delete(key: string): Promise<boolean> {
    this.maybeThrow();
    return this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.maybeThrow();
    this.data.clear();
  }

  async getStats(): Promise<CacheStats> {
    this.maybeThrow();
    return {
      totalEntries: this.data.size,
      totalSize: 0,
      hitRate: 0.8,
      missRate: 0.2,
      evictionCount: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  async invalidatePattern(pattern: string): Promise<number> {
    this.maybeThrow();
    return 0;
  }

  configure(config: Partial<CacheConfig>): void {
    this.maybeThrow();
  }

  async cleanup(): Promise<number> {
    this.maybeThrow();
    return 0;
  }

  async getMetadata(key: string): Promise<Omit<CacheEntry, 'data'> | null> {
    this.maybeThrow();
    return null;
  }
}

describe('CacheFallbackManager Integration Tests', () => {
  let mockCache: MockCacheManager;
  let fallbackManager: CacheFallbackManager;
  let mockDataRetriever: Mock;

  beforeEach(() => {
    mockCache = new MockCacheManager();
    mockDataRetriever = vi.fn();
    fallbackManager = createCacheFallbackManager(
      mockCache,
      mockDataRetriever,
      {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        enableRecovery: false, // Disable for tests
      }
    );
  });

  afterEach(() => {
    fallbackManager.destroy();
  });

  describe('Cache Failure Scenarios', () => {
    it('should handle cache set failures gracefully', async () => {
      mockCache.setShouldFail(true);

      // Should not throw error even when cache fails
      await expect(fallbackManager.set('key1', 'value1')).resolves.toBeUndefined();

      const stats = fallbackManager.getFallbackStats();
      expect(stats.currentlyFallenBack).toBe(true);
      expect(stats.lastFailureTime).toBeTruthy();
    });

    it('should fallback to data retriever on cache get failures', async () => {
      mockDataRetriever.mockResolvedValue('fallback-value');
      mockCache.setShouldFail(true);

      const result = await fallbackManager.get('key1');

      expect(result).toBe('fallback-value');
      expect(mockDataRetriever).toHaveBeenCalledWith('key1');

      const stats = fallbackManager.getFallbackStats();
      expect(stats.fallbackOperations).toBe(1);
      expect(stats.currentlyFallenBack).toBe(true);
    });

    it('should return null when both cache and data retriever fail', async () => {
      mockDataRetriever.mockRejectedValue(new Error('Data retriever failed'));
      mockCache.setShouldFail(true);

      const result = await fallbackManager.get('key1');

      expect(result).toBeNull();
      expect(mockDataRetriever).toHaveBeenCalledWith('key1');
    });

    it('should return false for has() when cache fails', async () => {
      mockCache.setShouldFail(true);

      const result = await fallbackManager.has('key1');

      expect(result).toBe(false);
    });

    it('should return true for delete() when cache fails (graceful degradation)', async () => {
      mockCache.setShouldFail(true);

      const result = await fallbackManager.delete('key1');

      expect(result).toBe(true);
    });

    it('should return empty stats when cache fails', async () => {
      mockCache.setShouldFail(true);

      const stats = await fallbackManager.getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 1,
        evictionCount: 0,
        oldestEntry: null,
        newestEntry: null,
      });
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry failed operations with exponential backoff', async () => {
      const startTime = Date.now();
      mockCache.setShouldFail(true);

      await fallbackManager.get('key1');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have taken some time due to retries and backoff
      expect(duration).toBeGreaterThan(20); // At least 2 retries with 10ms base delay
      expect(mockCache.getFailureCount()).toBe(3); // Initial + 2 retries
    });

    it('should succeed if cache recovers during retries', async () => {
      let attemptCount = 0;
      const originalGet = mockCache.get.bind(mockCache);
      
      mockCache.get = vi.fn().mockImplementation(async (key: string) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        return originalGet(key);
      });

      await mockCache.set('key1', 'value1');
      mockCache.setShouldFail(false); // Cache is working for set

      const result = await fallbackManager.get('key1');

      expect(result).toBe('value1');
      expect(attemptCount).toBe(3); // Failed twice, succeeded on third attempt
    });
  });

  describe('Cache Recovery', () => {
    it('should detect cache recovery during health checks', async () => {
      // Create manager with recovery enabled
      const recoveryManager = createCacheFallbackManager(
        mockCache,
        mockDataRetriever,
        {
          enableRecovery: true,
          healthCheckIntervalMs: 50,
        }
      );

      try {
        // Cause initial failure
        mockCache.setShouldFail(true);
        await recoveryManager.get('key1');

        let stats = recoveryManager.getFallbackStats();
        expect(stats.currentlyFallenBack).toBe(true);

        // Fix the cache
        mockCache.setShouldFail(false);

        // Manually trigger health check to speed up test
        const isHealthy = await recoveryManager.checkHealth();
        expect(isHealthy).toBe(true);

        stats = recoveryManager.getFallbackStats();
        expect(stats.currentlyFallenBack).toBe(false);
        expect(stats.successfulRecoveries).toBe(1);
        expect(stats.lastRecoveryTime).toBeTruthy();
      } finally {
        recoveryManager.destroy();
      }
    }, 10000);

    it('should manually check cache health', async () => {
      mockCache.setShouldFail(true);
      await fallbackManager.get('key1'); // Cause failure

      let isHealthy = await fallbackManager.checkHealth();
      expect(isHealthy).toBe(false);

      mockCache.setShouldFail(false);
      isHealthy = await fallbackManager.checkHealth();
      expect(isHealthy).toBe(true);

      const stats = fallbackManager.getFallbackStats();
      expect(stats.successfulRecoveries).toBe(1);
    });
  });

  describe('Fallback Statistics', () => {
    it('should track fallback statistics correctly', async () => {
      mockDataRetriever.mockResolvedValue('fallback-value');

      // Normal operations
      await fallbackManager.set('key1', 'value1');
      await fallbackManager.get('key1');
      await fallbackManager.has('key1');

      let stats = fallbackManager.getFallbackStats();
      expect(stats.totalOperations).toBe(3);
      expect(stats.fallbackOperations).toBe(0);
      expect(stats.currentlyFallenBack).toBe(false);

      // Cause failures
      mockCache.setShouldFail(true);
      await fallbackManager.get('key2');
      await fallbackManager.get('key3');

      stats = fallbackManager.getFallbackStats();
      expect(stats.totalOperations).toBe(5);
      expect(stats.fallbackOperations).toBe(2);
      expect(stats.currentlyFallenBack).toBe(true);
      expect(stats.lastFailureTime).toBeTruthy();
    });
  });

  describe('Configuration Options', () => {
    it('should respect fallbackToDirectRetrieval configuration', async () => {
      const noFallbackManager = createCacheFallbackManager(
        mockCache,
        mockDataRetriever,
        {
          fallbackToDirectRetrieval: false,
          maxRetries: 1, // Reduce retries to speed up test
          baseDelayMs: 10,
        }
      );

      try {
        mockCache.setShouldFail(true);
        mockDataRetriever.mockResolvedValue('should-not-be-called');

        const result = await noFallbackManager.get('key1');

        expect(result).toBeNull();
        expect(mockDataRetriever).not.toHaveBeenCalled();
      } finally {
        noFallbackManager.destroy();
      }
    }, 10000);

    it('should handle jitter in backoff delays', async () => {
      const jitterManager = createCacheFallbackManager(
        mockCache,
        mockDataRetriever,
        {
          maxRetries: 1,
          baseDelayMs: 100,
          jitterFactor: 0.5,
        }
      );

      try {
        mockCache.setShouldFail(true);
        const startTime = Date.now();

        await jitterManager.get('key1');

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should have some delay due to backoff with jitter
        expect(duration).toBeGreaterThan(50); // At least some delay
        expect(duration).toBeLessThan(200); // But not too much due to jitter
      } finally {
        jitterManager.destroy();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations when cache is already in failed state', async () => {
      mockCache.setShouldFail(true);
      await fallbackManager.get('key1'); // Cause initial failure

      // Now cache is in failed state, operations should skip cache entirely
      mockDataRetriever.mockResolvedValue('direct-value');

      const result = await fallbackManager.get('key2');
      expect(result).toBe('direct-value');

      // Should not have attempted cache operation
      const initialFailureCount = mockCache.getFailureCount();
      await fallbackManager.set('key3', 'value3');
      expect(mockCache.getFailureCount()).toBe(initialFailureCount); // No additional failures
    });

    it('should handle undefined data retriever gracefully', async () => {
      const noRetrieverManager = createCacheFallbackManager(mockCache, undefined, {
        maxRetries: 1, // Reduce retries to speed up test
        baseDelayMs: 10,
      });

      try {
        mockCache.setShouldFail(true);

        const result = await noRetrieverManager.get('key1');
        expect(result).toBeNull();
      } finally {
        noRetrieverManager.destroy();
      }
    }, 10000);
  });
});