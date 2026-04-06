/**
 * Error handling wrappers for performance optimization components
 * Provides consistent error handling and logging across all performance features
 */

import {
  ICacheManager,
  IConnectionPool,
  ICompressionMiddleware,
  IGitHubOptimizer,
  IPaginationMiddleware,
  IQueryMonitor,
  IIndexManager,
  CacheEntry,
  CacheStats,
  CacheConfig,
  ConnectionPoolStats,
  IndexInfo,
  QueryAnalysis,
  QueryMetrics,
  CompressionStats,
  CompressionConfig,
  GitHubRequestConfig,
  GitHubRateLimit,
  GitHubOptimizationStats,
} from './interfaces';
import {
  PerformanceErrorCategory,
  PerformanceErrorSeverity,
} from './ErrorHandling';
import { getPerformanceErrorHandler, getPerformanceLogger } from './PerformanceErrorHandler';

/**
 * Error handling wrapper for cache manager
 */
export class ErrorHandledCacheManager implements ICacheManager {
  private cacheManager: ICacheManager;
  private errorHandler = getPerformanceErrorHandler();
  private logger = getPerformanceLogger();
  private componentName: string;

  constructor(cacheManager: ICacheManager, componentName: string = 'CacheManager') {
    this.cacheManager = cacheManager;
    this.componentName = componentName;
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.CACHE, this.componentName, 'set');
    try {
      await this.cacheManager.set(key, data, ttl);
      await timer.end({ key, ttl });
    } catch (error) {
      await timer.endWithError(error as Error, { key, ttl });
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.MEDIUM,
        'set',
        this.componentName,
        error as Error,
        { key, ttl }
      );
      throw error;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.CACHE, this.componentName, 'get');
    try {
      const result = await this.cacheManager.get<T>(key);
      await timer.end({ key, hit: result !== null });
      return result;
    } catch (error) {
      await timer.endWithError(error as Error, { key });
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.MEDIUM,
        'get',
        this.componentName,
        error as Error,
        { key }
      );
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.cacheManager.has(key);
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.LOW,
        'has',
        this.componentName,
        error as Error,
        { key }
      );
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return await this.cacheManager.delete(key);
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.LOW,
        'delete',
        this.componentName,
        error as Error,
        { key }
      );
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cacheManager.clear();
      await this.logger.info(PerformanceErrorCategory.CACHE, this.componentName, 'clear', 'Cache cleared successfully');
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.HIGH,
        'clear',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      return await this.cacheManager.getStats();
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.LOW,
        'getStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const count = await this.cacheManager.invalidatePattern(pattern);
      await this.logger.info(
        PerformanceErrorCategory.CACHE,
        this.componentName,
        'invalidatePattern',
        `Invalidated ${count} entries matching pattern: ${pattern}`,
        { pattern, count }
      );
      return count;
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.MEDIUM,
        'invalidatePattern',
        this.componentName,
        error as Error,
        { pattern }
      );
      throw error;
    }
  }

  configure(config: Partial<CacheConfig>): void {
    try {
      this.cacheManager.configure(config);
      this.logger.info(PerformanceErrorCategory.CACHE, this.componentName, 'configure', 'Cache configuration updated', config);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.MEDIUM,
        'configure',
        this.componentName,
        error as Error,
        { config }
      );
      throw error;
    }
  }

  async cleanup(): Promise<number> {
    try {
      const count = await this.cacheManager.cleanup();
      await this.logger.info(
        PerformanceErrorCategory.CACHE,
        this.componentName,
        'cleanup',
        `Cleaned up ${count} expired entries`,
        { count }
      );
      return count;
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.LOW,
        'cleanup',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async getMetadata(key: string): Promise<Omit<CacheEntry, 'data'> | null> {
    try {
      return await this.cacheManager.getMetadata(key);
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.LOW,
        'getMetadata',
        this.componentName,
        error as Error,
        { key }
      );
      throw error;
    }
  }
}

/**
 * Error handling wrapper for connection pool
 */
export class ErrorHandledConnectionPool implements IConnectionPool {
  private connectionPool: IConnectionPool;
  private errorHandler = getPerformanceErrorHandler();
  private logger = getPerformanceLogger();
  private componentName: string;

  constructor(connectionPool: IConnectionPool, componentName: string = 'ConnectionPool') {
    this.connectionPool = connectionPool;
    this.componentName = componentName;
  }

  async initialize(): Promise<void> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.DATABASE, this.componentName, 'initialize');
    try {
      await this.connectionPool.initialize();
      await timer.end();
      await this.logger.info(PerformanceErrorCategory.DATABASE, this.componentName, 'initialize', 'Connection pool initialized successfully');
    } catch (error) {
      await timer.endWithError(error as Error);
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.CRITICAL,
        'initialize',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async acquire(): Promise<any> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.DATABASE, this.componentName, 'acquire');
    try {
      const connection = await this.connectionPool.acquire();
      await timer.end();
      return connection;
    } catch (error) {
      await timer.endWithError(error as Error);
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.HIGH,
        'acquire',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async release(connection: any): Promise<void> {
    try {
      await this.connectionPool.release(connection);
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.MEDIUM,
        'release',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async destroy(connection: any): Promise<void> {
    try {
      await this.connectionPool.destroy(connection);
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.MEDIUM,
        'destroy',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  getStats(): ConnectionPoolStats {
    try {
      return this.connectionPool.getStats();
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.LOW,
        'getStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.DATABASE, this.componentName, 'healthCheck');
    try {
      const isHealthy = await this.connectionPool.healthCheck();
      await timer.end({ healthy: isHealthy });
      if (!isHealthy) {
        await this.logger.warn(
          PerformanceErrorCategory.DATABASE,
          this.componentName,
          'healthCheck',
          'Connection pool health check failed'
        );
      }
      return isHealthy;
    } catch (error) {
      await timer.endWithError(error as Error);
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.HIGH,
        'healthCheck',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async drain(): Promise<void> {
    try {
      await this.connectionPool.drain();
      await this.logger.info(PerformanceErrorCategory.DATABASE, this.componentName, 'drain', 'Connection pool drained successfully');
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.HIGH,
        'drain',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.connectionPool.clear();
      await this.logger.info(PerformanceErrorCategory.DATABASE, this.componentName, 'clear', 'Connection pool cleared successfully');
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.HIGH,
        'clear',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }
}

/**
 * Error handling wrapper for compression middleware
 */
export class ErrorHandledCompressionMiddleware implements ICompressionMiddleware {
  private compressionMiddleware: ICompressionMiddleware;
  private errorHandler = getPerformanceErrorHandler();
  private logger = getPerformanceLogger();
  private componentName: string;

  constructor(compressionMiddleware: ICompressionMiddleware, componentName: string = 'CompressionMiddleware') {
    this.compressionMiddleware = compressionMiddleware;
    this.componentName = componentName;
  }

  async compress(data: Buffer | string, acceptedEncodings: string[]): Promise<{
    data: Buffer;
    encoding: string;
    originalSize: number;
    compressedSize: number;
    compressionTime: number;
  }> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.COMPRESSION, this.componentName, 'compress');
    try {
      const result = await this.compressionMiddleware.compress(data, acceptedEncodings);
      await timer.end({
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        encoding: result.encoding,
        compressionRatio: result.originalSize > 0 ? result.compressedSize / result.originalSize : 1,
      });
      return result;
    } catch (error) {
      await timer.endWithError(error as Error, { acceptedEncodings });
      await this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.MEDIUM,
        'compress',
        this.componentName,
        error as Error,
        { acceptedEncodings, dataSize: typeof data === 'string' ? data.length : data.length }
      );
      throw error;
    }
  }

  shouldCompress(size: number, contentType?: string): boolean {
    try {
      return this.compressionMiddleware.shouldCompress(size, contentType);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.LOW,
        'shouldCompress',
        this.componentName,
        error as Error,
        { size, contentType }
      );
      throw error;
    }
  }

  getBestAlgorithm(acceptedEncodings: string[]): string | null {
    try {
      return this.compressionMiddleware.getBestAlgorithm(acceptedEncodings);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.LOW,
        'getBestAlgorithm',
        this.componentName,
        error as Error,
        { acceptedEncodings }
      );
      throw error;
    }
  }

  getStats(): CompressionStats {
    try {
      return this.compressionMiddleware.getStats();
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.LOW,
        'getStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  configure(config: Partial<CompressionConfig>): void {
    try {
      this.compressionMiddleware.configure(config);
      this.logger.info(PerformanceErrorCategory.COMPRESSION, this.componentName, 'configure', 'Compression configuration updated', config);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.MEDIUM,
        'configure',
        this.componentName,
        error as Error,
        { config }
      );
      throw error;
    }
  }

  resetStats(): void {
    try {
      this.compressionMiddleware.resetStats();
      this.logger.info(PerformanceErrorCategory.COMPRESSION, this.componentName, 'resetStats', 'Compression statistics reset');
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.LOW,
        'resetStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }
}

/**
 * Error handling wrapper for GitHub optimizer
 */
export class ErrorHandledGitHubOptimizer implements IGitHubOptimizer {
  private githubOptimizer: IGitHubOptimizer;
  private errorHandler = getPerformanceErrorHandler();
  private logger = getPerformanceLogger();
  private componentName: string;

  constructor(githubOptimizer: IGitHubOptimizer, componentName: string = 'GitHubOptimizer') {
    this.githubOptimizer = githubOptimizer;
    this.componentName = componentName;
  }

  async request<T = any>(config: GitHubRequestConfig): Promise<T> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.GITHUB_API, this.componentName, 'request');
    try {
      const result = await this.githubOptimizer.request<T>(config);
      await timer.end({ url: config.url, method: config.method, cacheable: config.cacheable });
      return result;
    } catch (error) {
      await timer.endWithError(error as Error, { url: config.url, method: config.method });
      await this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.HIGH,
        'request',
        this.componentName,
        error as Error,
        { url: config.url, method: config.method, priority: config.priority }
      );
      throw error;
    }
  }

  async batchRequest<T = any>(configs: GitHubRequestConfig[]): Promise<T[]> {
    const timer = this.logger.createTimer(PerformanceErrorCategory.GITHUB_API, this.componentName, 'batchRequest');
    try {
      const results = await this.githubOptimizer.batchRequest<T>(configs);
      await timer.end({ batchSize: configs.length });
      return results;
    } catch (error) {
      await timer.endWithError(error as Error, { batchSize: configs.length });
      await this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.HIGH,
        'batchRequest',
        this.componentName,
        error as Error,
        { batchSize: configs.length }
      );
      throw error;
    }
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    try {
      const rateLimit = await this.githubOptimizer.getRateLimit();
      if (rateLimit.remaining < 100) {
        await this.logger.warn(
          PerformanceErrorCategory.GITHUB_API,
          this.componentName,
          'getRateLimit',
          `GitHub API rate limit running low: ${rateLimit.remaining}/${rateLimit.limit}`,
          { rateLimit }
        );
      }
      return rateLimit;
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.MEDIUM,
        'getRateLimit',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  shouldCache(config: GitHubRequestConfig): boolean {
    try {
      return this.githubOptimizer.shouldCache(config);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.LOW,
        'shouldCache',
        this.componentName,
        error as Error,
        { url: config.url, method: config.method }
      );
      throw error;
    }
  }

  getStats(): GitHubOptimizationStats {
    try {
      return this.githubOptimizer.getStats();
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.LOW,
        'getStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  configure(options: {
    token?: string;
    baseUrl?: string;
    batchSize?: number;
    batchDelay?: number;
    rateLimitBuffer?: number;
    defaultCacheTtl?: number;
  }): void {
    try {
      this.githubOptimizer.configure(options);
      this.logger.info(PerformanceErrorCategory.GITHUB_API, this.componentName, 'configure', 'GitHub optimizer configuration updated', options);
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.MEDIUM,
        'configure',
        this.componentName,
        error as Error,
        { options }
      );
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await this.githubOptimizer.clearCache();
      await this.logger.info(PerformanceErrorCategory.GITHUB_API, this.componentName, 'clearCache', 'GitHub API cache cleared');
    } catch (error) {
      await this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.MEDIUM,
        'clearCache',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  resetStats(): void {
    try {
      this.githubOptimizer.resetStats();
      this.logger.info(PerformanceErrorCategory.GITHUB_API, this.componentName, 'resetStats', 'GitHub optimizer statistics reset');
    } catch (error) {
      this.errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.LOW,
        'resetStats',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }
}

/**
 * Factory functions for creating error-handled components
 */
export function createErrorHandledCacheManager(cacheManager: ICacheManager, componentName?: string): ICacheManager {
  return new ErrorHandledCacheManager(cacheManager, componentName);
}

export function createErrorHandledConnectionPool(connectionPool: IConnectionPool, componentName?: string): IConnectionPool {
  return new ErrorHandledConnectionPool(connectionPool, componentName);
}

export function createErrorHandledCompressionMiddleware(compressionMiddleware: ICompressionMiddleware, componentName?: string): ICompressionMiddleware {
  return new ErrorHandledCompressionMiddleware(compressionMiddleware, componentName);
}

export function createErrorHandledGitHubOptimizer(githubOptimizer: IGitHubOptimizer, componentName?: string): IGitHubOptimizer {
  return new ErrorHandledGitHubOptimizer(githubOptimizer, componentName);
}