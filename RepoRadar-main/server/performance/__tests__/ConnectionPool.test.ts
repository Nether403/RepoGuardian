import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ConnectionPool } from '../ConnectionPool';
import { Pool, PoolClient } from '@neondatabase/serverless';

// Mock the @neondatabase/serverless module
vi.mock('@neondatabase/serverless', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  return {
    Pool: vi.fn(() => mockPool),
    PoolClient: vi.fn(() => mockClient),
  };
});

describe('ConnectionPool', () => {
  let connectionPool: ConnectionPool;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };

    (Pool as Mock).mockImplementation(() => mockPool);

    connectionPool = new ConnectionPool('postgresql://test:test@localhost:5432/test', {
      minConnections: 1,
      maxConnections: 5,
      idleTimeoutMs: 10000,
      connectionTimeoutMs: 2000,
      healthCheckIntervalMs: 30000,
      maxRetries: 2,
    });
  });

  afterEach(async () => {
    await connectionPool.clear();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid connection', async () => {
      await expect(connectionPool.initialize()).resolves.not.toThrow();
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if connection test fails', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(connectionPool.initialize()).rejects.toThrow('Failed to initialize connection pool');
    });

    it('should not reinitialize if already initialized', async () => {
      await connectionPool.initialize();
      mockPool.connect.mockClear();
      
      await connectionPool.initialize();
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe('acquire', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
      vi.clearAllMocks(); // Clear mocks after initialization
    });

    it('should acquire connection successfully', async () => {
      const client = await connectionPool.acquire();
      
      expect(client).toBe(mockClient);
      expect(mockPool.connect).toHaveBeenCalled();
      
      const stats = connectionPool.getStats();
      expect(stats.totalAcquired).toBe(1);
    });

    it('should retry on connection failure', async () => {
      mockPool.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockClient);
      
      const client = await connectionPool.acquire();
      
      expect(client).toBe(mockClient);
      expect(mockPool.connect).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(connectionPool.acquire()).rejects.toThrow('Failed to acquire connection after 2 retries');
      expect(mockPool.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('release', () => {
    let client: PoolClient;

    beforeEach(async () => {
      await connectionPool.initialize();
      vi.clearAllMocks(); // Clear mocks after initialization
      client = await connectionPool.acquire();
      vi.clearAllMocks(); // Clear mocks after acquire
    });

    it('should release connection successfully', async () => {
      await connectionPool.release(client);
      
      expect(mockClient.release).toHaveBeenCalledWith();
      
      const stats = connectionPool.getStats();
      expect(stats.totalReleased).toBe(1);
    });

    it('should destroy connection if release fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock release to fail first, then succeed on destroy
      mockClient.release
        .mockImplementationOnce(() => {
          throw new Error('Release failed');
        })
        .mockImplementationOnce(() => {}); // Second call for destroy should succeed
      
      await connectionPool.release(client);
      
      expect(mockClient.release).toHaveBeenCalledTimes(2); // Once for release, once for destroy (with true)
      expect(mockClient.release).toHaveBeenLastCalledWith(true);
      const stats = connectionPool.getStats();
      expect(stats.totalDestroyed).toBe(1);
      
      consoleSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    let client: PoolClient;

    beforeEach(async () => {
      await connectionPool.initialize();
      client = await connectionPool.acquire();
    });

    it('should destroy connection successfully', async () => {
      await connectionPool.destroy(client);
      
      expect(mockClient.release).toHaveBeenCalledWith(true);
      
      const stats = connectionPool.getStats();
      expect(stats.totalDestroyed).toBe(1);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    it('should return correct initial stats', () => {
      const stats = connectionPool.getStats();
      
      expect(stats).toEqual({
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        totalCreated: 0,
        totalDestroyed: 0,
        totalAcquired: 0,
        totalReleased: 0,
      });
    });

    it('should update stats after acquiring connection', async () => {
      await connectionPool.acquire();
      
      const stats = connectionPool.getStats();
      expect(stats.totalAcquired).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });

    it('should update stats after releasing connection', async () => {
      const client = await connectionPool.acquire();
      await connectionPool.release(client);
      
      const stats = connectionPool.getStats();
      expect(stats.totalAcquired).toBe(1);
      expect(stats.totalReleased).toBe(1);
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
      vi.clearAllMocks(); // Clear mocks after initialization
    });

    it('should return true for successful health check', async () => {
      const isHealthy = await connectionPool.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false for failed health check', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create a separate connection pool for this test to avoid interference
      const testPool = new ConnectionPool('postgresql://test:test@localhost:5432/test');
      
      // Mock the pool's connect method to fail
      const testMockPool = {
        connect: vi.fn().mockRejectedValue(new Error('Health check failed')),
        end: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
      };
      
      // Replace the pool instance
      (testPool as any).pool = testMockPool;
      
      const isHealthy = await testPool.healthCheck();
      
      expect(isHealthy).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('drain', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
      vi.clearAllMocks(); // Clear mocks after initialization
    });

    it('should drain pool successfully', async () => {
      await connectionPool.drain();
      
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
      vi.clearAllMocks(); // Clear mocks after initialization
    });

    it('should clear pool and reset stats', async () => {
      // Acquire a connection to have some stats
      await connectionPool.acquire();
      
      await connectionPool.clear();
      
      expect(mockPool.end).toHaveBeenCalled();
      
      const stats = connectionPool.getStats();
      expect(stats.totalAcquired).toBe(0);
      expect(stats.totalReleased).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const pool = new ConnectionPool('postgresql://test:test@localhost:5432/test');
      
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@localhost:5432/test',
        max: 10, // default maxConnections
        idleTimeoutMillis: 30000, // default idleTimeoutMs
        connectionTimeoutMillis: 5000, // default connectionTimeoutMs
      });
    });

    it('should use custom configuration when provided', () => {
      const customConfig = {
        maxConnections: 20,
        idleTimeoutMs: 60000,
        connectionTimeoutMs: 10000,
      };
      
      const pool = new ConnectionPool('postgresql://test:test@localhost:5432/test', customConfig);
      
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@localhost:5432/test',
        max: 20,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
      });
    });
  });

  describe('event listeners', () => {
    it('should set up event listeners on pool creation', () => {
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});