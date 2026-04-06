import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseFallbackManager, DatabaseFallbackConfig } from '../DatabaseFallbackManager';
import { IConnectionPool } from '../interfaces';

// Mock connection object
const createMockConnection = () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  release: vi.fn(),
});

describe('DatabaseFallbackManager Integration Tests', () => {
  let fallbackManager: DatabaseFallbackManager;
  let mockPrimaryPool: IConnectionPool;
  const connectionString = 'postgresql://test:test@localhost:5432/test';

  beforeEach(() => {
    // Mock primary pool
    mockPrimaryPool = {
      initialize: vi.fn().mockResolvedValue(undefined),
      acquire: vi.fn().mockResolvedValue(createMockConnection()),
      release: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({
        totalConnections: 5,
        activeConnections: 2,
        idleConnections: 3,
        waitingRequests: 0,
        totalCreated: 10,
        totalDestroyed: 5,
        totalAcquired: 20,
        totalReleased: 18,
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      drain: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const config: Partial<DatabaseFallbackConfig> = {
      maxRetries: 2,
      baseDelayMs: 50, // Shorter delays for testing
      maxDelayMs: 500,
      jitterFactor: 0.1,
      enableDirectConnection: false, // Disable for simpler testing
      enablePoolRecreation: true,
      healthCheckIntervalMs: 100,
      poolRecreationDelayMs: 100,
      directConnectionTimeoutMs: 5000,
    };

    fallbackManager = new DatabaseFallbackManager(
      mockPrimaryPool,
      connectionString,
      {},
      config
    );
  });

  afterEach(async () => {
    if (fallbackManager) {
      await fallbackManager.drain();
      fallbackManager.cleanup();
    }
  });

  describe('Normal Operation', () => {
    it('should initialize successfully when primary pool is healthy', async () => {
      await expect(fallbackManager.initialize()).resolves.not.toThrow();
      expect(mockPrimaryPool.initialize).toHaveBeenCalledOnce();
    });

    it('should acquire connections from primary pool when healthy', async () => {
      await fallbackManager.initialize();
      
      const connection = await fallbackManager.acquire();
      
      expect(connection).toBeDefined();
      expect(mockPrimaryPool.acquire).toHaveBeenCalledOnce();
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.fallbackOperations).toBe(0);
    });

    it('should release connections to primary pool when healthy', async () => {
      await fallbackManager.initialize();
      const connection = await fallbackManager.acquire();
      
      await fallbackManager.release(connection);
      
      expect(mockPrimaryPool.release).toHaveBeenCalledWith(connection);
    });

    it('should return primary pool stats when healthy', async () => {
      await fallbackManager.initialize();
      
      const stats = fallbackManager.getStats();
      
      expect(stats.totalConnections).toBe(5);
      expect(stats.activeConnections).toBe(2);
      expect(mockPrimaryPool.getStats).toHaveBeenCalledOnce();
    });
  });

  describe('Pool Failure Scenarios', () => {
    it('should handle primary pool acquire failures gracefully', async () => {
      await fallbackManager.initialize();
      
      // Make primary pool fail
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool connection failed'));
      
      // Should throw since direct connection is disabled
      await expect(fallbackManager.acquire()).rejects.toThrow();
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.currentlyUsingFallback).toBe(true);
      expect(stats.lastPoolFailureTime).toBeInstanceOf(Date);
    });

    it('should handle primary pool initialization failures', async () => {
      mockPrimaryPool.initialize = vi.fn().mockRejectedValue(new Error('Pool init failed'));
      
      // Should throw since direct connection is disabled
      await expect(fallbackManager.initialize()).rejects.toThrow();
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.currentlyUsingFallback).toBe(true);
    });

    it('should retry operations with exponential backoff', async () => {
      await fallbackManager.initialize();
      
      let callCount = 0;
      mockPrimaryPool.acquire = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(createMockConnection());
      });
      
      const startTime = Date.now();
      const connection = await fallbackManager.acquire();
      const endTime = Date.now();
      
      expect(connection).toBeDefined();
      expect(mockPrimaryPool.acquire).toHaveBeenCalledTimes(3);
      // Should have some delay due to backoff
      expect(endTime - startTime).toBeGreaterThan(50);
    });
  });

  describe('Pool Recovery', () => {
    it('should detect pool recovery and switch back to primary pool', async () => {
      await fallbackManager.initialize();
      
      // Force fallback mode
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool failed'));
      mockPrimaryPool.healthCheck = vi.fn().mockResolvedValue(false);
      
      // Trigger fallback
      try {
        await fallbackManager.acquire();
      } catch (error) {
        // Expected to fail since direct connection is disabled
      }
      expect(fallbackManager.getFallbackStats().currentlyUsingFallback).toBe(true);
      
      // Simulate pool recovery
      mockPrimaryPool.acquire = vi.fn().mockResolvedValue(createMockConnection());
      mockPrimaryPool.healthCheck = vi.fn().mockResolvedValue(true);
      
      // Trigger health check
      const isHealthy = await fallbackManager.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(fallbackManager.getFallbackStats().currentlyUsingFallback).toBe(false);
      expect(fallbackManager.getFallbackStats().successfulRecreations).toBe(1);
    });

    it('should manually recreate pool successfully', async () => {
      await fallbackManager.initialize();
      
      // Force fallback mode
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool failed'));
      try {
        await fallbackManager.acquire();
      } catch (error) {
        // Expected to fail
      }
      
      // Simulate pool recovery
      mockPrimaryPool.clear = vi.fn().mockResolvedValue(undefined);
      mockPrimaryPool.initialize = vi.fn().mockResolvedValue(undefined);
      mockPrimaryPool.healthCheck = vi.fn().mockResolvedValue(true);
      
      const success = await fallbackManager.recreatePool();
      
      expect(success).toBe(true);
      expect(mockPrimaryPool.clear).toHaveBeenCalledOnce();
      expect(mockPrimaryPool.initialize).toHaveBeenCalledOnce(); // Only called in recreate, not in constructor for this test
      expect(fallbackManager.getFallbackStats().poolRecreations).toBe(1);
      expect(fallbackManager.getFallbackStats().successfulRecreations).toBe(1);
    });

    it('should handle failed pool recreation', async () => {
      await fallbackManager.initialize();
      
      // Force fallback mode
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool failed'));
      try {
        await fallbackManager.acquire();
      } catch (error) {
        // Expected to fail
      }
      
      // Simulate failed pool recreation
      mockPrimaryPool.clear = vi.fn().mockRejectedValue(new Error('Clear failed'));
      
      const success = await fallbackManager.recreatePool();
      
      expect(success).toBe(false);
      expect(fallbackManager.getFallbackStats().poolRecreations).toBe(1);
      expect(fallbackManager.getFallbackStats().successfulRecreations).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection release errors gracefully', async () => {
      await fallbackManager.initialize();
      const connection = await fallbackManager.acquire();
      
      // Make primary pool release fail
      mockPrimaryPool.release = vi.fn().mockRejectedValue(new Error('Release failed'));
      
      // Should not throw, should fallback to direct connection release
      await expect(fallbackManager.release(connection)).resolves.not.toThrow();
      expect(connection.release).toHaveBeenCalled();
    });

    it('should return minimal stats when pool is unhealthy', async () => {
      await fallbackManager.initialize();
      
      // Force fallback mode
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool failed'));
      mockPrimaryPool.getStats = vi.fn().mockImplementation(() => {
        throw new Error('Stats failed');
      });
      
      try {
        await fallbackManager.acquire();
      } catch (error) {
        // Expected to fail
      }
      
      const stats = fallbackManager.getStats();
      
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled pool recreation configuration', async () => {
      const configWithoutRecreation: Partial<DatabaseFallbackConfig> = {
        enablePoolRecreation: false,
      };
      
      const manager = new DatabaseFallbackManager(
        mockPrimaryPool,
        connectionString,
        {},
        configWithoutRecreation
      );
      
      const success = await manager.recreatePool();
      expect(success).toBe(false);
      
      await manager.drain();
      manager.cleanup();
    });
  });

  describe('Statistics', () => {
    it('should track fallback statistics correctly', async () => {
      await fallbackManager.initialize();
      
      // Normal operation
      await fallbackManager.acquire();
      await fallbackManager.acquire();
      
      // Force fallback
      mockPrimaryPool.acquire = vi.fn().mockRejectedValue(new Error('Pool failed'));
      try {
        await fallbackManager.acquire();
        await fallbackManager.acquire();
      } catch (error) {
        // Expected to fail since direct connection is disabled
      }
      
      const stats = fallbackManager.getFallbackStats();
      
      expect(stats.totalOperations).toBe(3); // Only 3 operations since one acquire call is in beforeEach
      expect(stats.fallbackOperations).toBe(1); // Only the failed acquire operations count as fallback
      expect(stats.currentlyUsingFallback).toBe(true);
      expect(stats.lastPoolFailureTime).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly on drain', async () => {
      await fallbackManager.initialize();
      
      await fallbackManager.drain();
      
      expect(mockPrimaryPool.drain).toHaveBeenCalledOnce();
    });

    it('should cleanup resources properly on clear', async () => {
      await fallbackManager.initialize();
      
      await fallbackManager.clear();
      
      expect(mockPrimaryPool.clear).toHaveBeenCalledOnce();
    });

    it('should stop recovery timer on cleanup', async () => {
      await fallbackManager.initialize();
      
      // Spy on clearInterval
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      fallbackManager.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});