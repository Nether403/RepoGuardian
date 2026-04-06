/**
 * Integration tests for error handling wrappers
 * Tests error handling and logging integration with performance components
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ErrorHandledCacheManager,
  ErrorHandledConnectionPool,
  ErrorHandledCompressionMiddleware,
  ErrorHandledGitHubOptimizer,
  createErrorHandledCacheManager,
  createErrorHandledConnectionPool,
  createErrorHandledCompressionMiddleware,
  createErrorHandledGitHubOptimizer,
} from '../ErrorHandlingWrappers';
import {
  ICacheManager,
  IConnectionPool,
  ICompressionMiddleware,
  IGitHubOptimizer,
  CacheStats,
  ConnectionPoolStats,
  CompressionStats,
  GitHubOptimizationStats,
  GitHubRequestConfig,
  GitHubRateLimit,
} from '../interfaces';
import { getPerformanceErrorHandler } from '../PerformanceErrorHandler';
import {
  PerformanceErrorCategory,
  PerformanceErrorSeverity,
} from '../ErrorHandling';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', mockConsole);

describe('Error Handling Wrappers Integration', () => {
  let errorHandler: ReturnType<typeof getPerformanceErrorHandler>;

  beforeEach(() => {
    errorHandler = getPerformanceErrorHandler({
      enableLogging: true,
      logLevel: 'debug',
      maxLogEntries: 100,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ErrorHandledCacheManager', () => {
    let mockCacheManager: ICacheManager;
    let errorHandledCache: ICacheManager;

    beforeEach(() => {
      mockCacheManager = {
        set: vi.fn(),
        get: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn(),
        invalidatePattern: vi.fn(),
        configure: vi.fn(),
        cleanup: vi.fn(),
        getMetadata: vi.fn(),
      };

      errorHandledCache = createErrorHandledCacheManager(mockCacheManager, 'TestCacheManager');
    });

    it('should handle successful cache operations and log timing', async () => {
      mockCacheManager.set = vi.fn().mockResolvedValue(undefined);
      mockCacheManager.get = vi.fn().mockResolvedValue('cached-value');

      await errorHandledCache.set('test-key', 'test-value', 300);
      const result = await errorHandledCache.get('test-key');

      expect(result).toBe('cached-value');
      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-value', 300);
      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');

      // Check that timing logs were created
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.operation === 'set' && 
        log.component === 'TestCacheManager' &&
        log.metadata?.duration !== undefined
      )).toBe(true);
    });

    it('should handle cache errors and log them appropriately', async () => {
      const cacheError = new Error('Cache connection failed');
      mockCacheManager.set = vi.fn().mockRejectedValue(cacheError);

      await expect(errorHandledCache.set('test-key', 'test-value')).rejects.toThrow('Cache connection failed');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.CACHE,
        severity: PerformanceErrorSeverity.MEDIUM,
        operation: 'set',
        component: 'TestCacheManager',
        message: 'Cache connection failed',
      });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE] TestCacheManager.set: Cache connection failed'),
        expect.any(Object)
      );
    });

    it('should handle cache stats retrieval errors', async () => {
      const statsError = new Error('Stats unavailable');
      mockCacheManager.getStats = vi.fn().mockRejectedValue(statsError);

      await expect(errorHandledCache.getStats()).rejects.toThrow('Stats unavailable');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.CACHE,
        severity: PerformanceErrorSeverity.LOW,
        operation: 'getStats',
      });
    });

    it('should log successful invalidation operations', async () => {
      mockCacheManager.invalidatePattern = vi.fn().mockResolvedValue(5);

      const count = await errorHandledCache.invalidatePattern('user:*');

      expect(count).toBe(5);
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.message.includes('Invalidated 5 entries matching pattern: user:*')
      )).toBe(true);
    });
  });

  describe('ErrorHandledConnectionPool', () => {
    let mockConnectionPool: IConnectionPool;
    let errorHandledPool: IConnectionPool;

    beforeEach(() => {
      mockConnectionPool = {
        initialize: vi.fn(),
        acquire: vi.fn(),
        release: vi.fn(),
        destroy: vi.fn(),
        getStats: vi.fn(),
        healthCheck: vi.fn(),
        drain: vi.fn(),
        clear: vi.fn(),
      };

      errorHandledPool = createErrorHandledConnectionPool(mockConnectionPool, 'TestConnectionPool');
    });

    it('should handle successful pool operations and log timing', async () => {
      const mockConnection = { id: 'conn-123' };
      mockConnectionPool.initialize = vi.fn().mockResolvedValue(undefined);
      mockConnectionPool.acquire = vi.fn().mockResolvedValue(mockConnection);

      await errorHandledPool.initialize();
      const connection = await errorHandledPool.acquire();

      expect(connection).toBe(mockConnection);
      expect(mockConnectionPool.initialize).toHaveBeenCalled();
      expect(mockConnectionPool.acquire).toHaveBeenCalled();

      // Check initialization success log
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.message === 'Connection pool initialized successfully'
      )).toBe(true);
    });

    it('should handle pool initialization errors as critical', async () => {
      const initError = new Error('Database connection failed');
      mockConnectionPool.initialize = vi.fn().mockRejectedValue(initError);

      await expect(errorHandledPool.initialize()).rejects.toThrow('Database connection failed');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.DATABASE,
        severity: PerformanceErrorSeverity.CRITICAL,
        operation: 'initialize',
        component: 'TestConnectionPool',
      });
    });

    it('should handle connection acquisition errors as high severity', async () => {
      const acquireError = new Error('Pool exhausted');
      mockConnectionPool.acquire = vi.fn().mockRejectedValue(acquireError);

      await expect(errorHandledPool.acquire()).rejects.toThrow('Pool exhausted');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.DATABASE,
        severity: PerformanceErrorSeverity.HIGH,
        operation: 'acquire',
      });
    });

    it('should log health check warnings for unhealthy pools', async () => {
      mockConnectionPool.healthCheck = vi.fn().mockResolvedValue(false);

      const isHealthy = await errorHandledPool.healthCheck();

      expect(isHealthy).toBe(false);
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.level === 'warn' && 
        log.message === 'Connection pool health check failed'
      )).toBe(true);
    });
  });

  describe('ErrorHandledCompressionMiddleware', () => {
    let mockCompressionMiddleware: ICompressionMiddleware;
    let errorHandledCompression: ICompressionMiddleware;

    beforeEach(() => {
      mockCompressionMiddleware = {
        compress: vi.fn(),
        shouldCompress: vi.fn(),
        getBestAlgorithm: vi.fn(),
        getStats: vi.fn(),
        configure: vi.fn(),
        resetStats: vi.fn(),
      };

      errorHandledCompression = createErrorHandledCompressionMiddleware(mockCompressionMiddleware, 'TestCompressionMiddleware');
    });

    it('should handle successful compression and log metrics', async () => {
      const compressionResult = {
        data: Buffer.from('compressed-data'),
        encoding: 'gzip',
        originalSize: 1000,
        compressedSize: 300,
        compressionTime: 15,
      };

      mockCompressionMiddleware.compress = vi.fn().mockResolvedValue(compressionResult);

      const result = await errorHandledCompression.compress('test data', ['gzip', 'deflate']);

      expect(result).toBe(compressionResult);
      expect(mockCompressionMiddleware.compress).toHaveBeenCalledWith('test data', ['gzip', 'deflate']);

      // Check that compression metrics were logged
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.operation === 'compress' &&
        log.metadata?.originalSize === 1000 &&
        log.metadata?.compressedSize === 300 &&
        log.metadata?.compressionRatio === 0.3
      )).toBe(true);
    });

    it('should handle compression errors', async () => {
      const compressionError = new Error('Compression algorithm not supported');
      mockCompressionMiddleware.compress = vi.fn().mockRejectedValue(compressionError);

      await expect(errorHandledCompression.compress('test data', ['unsupported'])).rejects.toThrow('Compression algorithm not supported');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.COMPRESSION,
        severity: PerformanceErrorSeverity.MEDIUM,
        operation: 'compress',
        metadata: expect.objectContaining({
          acceptedEncodings: ['unsupported'],
        }),
      });
    });

    it('should log configuration changes', () => {
      const config = { threshold: 2048, level: 6 };
      mockCompressionMiddleware.configure = vi.fn();

      errorHandledCompression.configure(config);

      expect(mockCompressionMiddleware.configure).toHaveBeenCalledWith(config);
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.message === 'Compression configuration updated' &&
        log.metadata?.threshold === 2048
      )).toBe(true);
    });
  });

  describe('ErrorHandledGitHubOptimizer', () => {
    let mockGitHubOptimizer: IGitHubOptimizer;
    let errorHandledGitHub: IGitHubOptimizer;

    beforeEach(() => {
      mockGitHubOptimizer = {
        request: vi.fn(),
        batchRequest: vi.fn(),
        getRateLimit: vi.fn(),
        shouldCache: vi.fn(),
        getStats: vi.fn(),
        configure: vi.fn(),
        clearCache: vi.fn(),
        resetStats: vi.fn(),
      };

      errorHandledGitHub = createErrorHandledGitHubOptimizer(mockGitHubOptimizer, 'TestGitHubOptimizer');
    });

    it('should handle successful API requests and log timing', async () => {
      const requestConfig: GitHubRequestConfig = {
        url: '/repos/test/repo',
        method: 'GET',
        cacheable: true,
      };

      const responseData = { name: 'test-repo', stars: 100 };
      mockGitHubOptimizer.request = vi.fn().mockResolvedValue(responseData);

      const result = await errorHandledGitHub.request(requestConfig);

      expect(result).toBe(responseData);
      expect(mockGitHubOptimizer.request).toHaveBeenCalledWith(requestConfig);

      // Check timing log
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.operation === 'request' &&
        log.metadata?.url === '/repos/test/repo' &&
        log.metadata?.cacheable === true
      )).toBe(true);
    });

    it('should handle API request errors as high severity', async () => {
      const requestConfig: GitHubRequestConfig = {
        url: '/repos/test/repo',
        method: 'GET',
      };

      const apiError = new Error('API rate limit exceeded');
      mockGitHubOptimizer.request = vi.fn().mockRejectedValue(apiError);

      await expect(errorHandledGitHub.request(requestConfig)).rejects.toThrow('API rate limit exceeded');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.GITHUB_API,
        severity: PerformanceErrorSeverity.HIGH,
        operation: 'request',
        metadata: expect.objectContaining({
          url: '/repos/test/repo',
          method: 'GET',
        }),
      });
    });

    it('should warn about low rate limits', async () => {
      const lowRateLimit: GitHubRateLimit = {
        limit: 5000,
        remaining: 50,
        reset: Date.now() + 3600000,
        used: 4950,
        resource: 'core',
      };

      mockGitHubOptimizer.getRateLimit = vi.fn().mockResolvedValue(lowRateLimit);

      const rateLimit = await errorHandledGitHub.getRateLimit();

      expect(rateLimit).toBe(lowRateLimit);
      const logs = errorHandler.getRecentLogs(10);
      expect(logs.some(log => 
        log.level === 'warn' &&
        log.message.includes('GitHub API rate limit running low: 50/5000')
      )).toBe(true);
    });

    it('should handle batch request errors', async () => {
      const batchConfigs: GitHubRequestConfig[] = [
        { url: '/repos/test/repo1', method: 'GET' },
        { url: '/repos/test/repo2', method: 'GET' },
      ];

      const batchError = new Error('Batch request failed');
      mockGitHubOptimizer.batchRequest = vi.fn().mockRejectedValue(batchError);

      await expect(errorHandledGitHub.batchRequest(batchConfigs)).rejects.toThrow('Batch request failed');

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.GITHUB_API,
        severity: PerformanceErrorSeverity.HIGH,
        operation: 'batchRequest',
        metadata: expect.objectContaining({
          batchSize: 2,
        }),
      });
    });
  });

  describe('Error Handler Integration', () => {
    it('should accumulate errors and logs across all wrapped components', async () => {
      const mockCache = {
        set: vi.fn().mockRejectedValue(new Error('Cache error')),
        get: vi.fn(), has: vi.fn(), delete: vi.fn(), clear: vi.fn(),
        getStats: vi.fn(), invalidatePattern: vi.fn(), configure: vi.fn(),
        cleanup: vi.fn(), getMetadata: vi.fn(),
      };

      const mockPool = {
        initialize: vi.fn(), acquire: vi.fn().mockRejectedValue(new Error('Pool error')),
        release: vi.fn(), destroy: vi.fn(), getStats: vi.fn(),
        healthCheck: vi.fn(), drain: vi.fn(), clear: vi.fn(),
      };

      const errorHandledCache = createErrorHandledCacheManager(mockCache);
      const errorHandledPool = createErrorHandledConnectionPool(mockPool);

      // Generate errors from different components
      try { await errorHandledCache.set('key', 'value'); } catch {}
      try { await errorHandledPool.acquire(); } catch {}

      const errors = errorHandler.getRecentErrors(10);
      expect(errors).toHaveLength(2);
      
      const cacheError = errors.find(e => e.category === PerformanceErrorCategory.CACHE);
      const dbError = errors.find(e => e.category === PerformanceErrorCategory.DATABASE);
      
      expect(cacheError).toBeDefined();
      expect(dbError).toBeDefined();

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByCategory[PerformanceErrorCategory.CACHE]).toBe(1);
      expect(stats.errorsByCategory[PerformanceErrorCategory.DATABASE]).toBe(1);
    });

    it('should handle fallback logging from multiple components', async () => {
      const mockCache = {
        set: vi.fn(), get: vi.fn(), has: vi.fn(), delete: vi.fn(), clear: vi.fn(),
        getStats: vi.fn(), invalidatePattern: vi.fn(), configure: vi.fn(),
        cleanup: vi.fn(), getMetadata: vi.fn(),
      };

      const errorHandledCache = createErrorHandledCacheManager(mockCache);

      // Simulate successful operations that would log info
      mockCache.set = vi.fn().mockResolvedValue(undefined);
      mockCache.invalidatePattern = vi.fn().mockResolvedValue(3);

      await errorHandledCache.set('key', 'value');
      await errorHandledCache.invalidatePattern('pattern:*');

      const logs = errorHandler.getRecentLogs(10);
      expect(logs.length).toBeGreaterThan(0);
      
      // Should have timing logs and operation logs
      const timingLogs = logs.filter(log => log.metadata?.duration !== undefined);
      const operationLogs = logs.filter(log => log.message.includes('Invalidated'));
      
      expect(timingLogs.length).toBeGreaterThan(0);
      expect(operationLogs.length).toBeGreaterThan(0);
    });
  });
});