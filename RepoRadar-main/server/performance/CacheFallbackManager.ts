import { ICacheManager, CacheEntry, CacheStats, CacheConfig } from './interfaces';

/**
 * Configuration for cache fallback behavior
 */
export interface CacheFallbackConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  fallbackToDirectRetrieval: boolean;
  enableRecovery: boolean;
  healthCheckIntervalMs: number;
}

/**
 * Statistics for cache fallback operations
 */
export interface CacheFallbackStats {
  totalOperations: number;
  fallbackOperations: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  currentlyFallenBack: boolean;
  lastFailureTime: Date | null;
  lastRecoveryTime: Date | null;
}

/**
 * Cache manager wrapper that provides graceful degradation and recovery
 * for cache failures with exponential backoff
 */
export class CacheFallbackManager implements ICacheManager {
  private primaryCache: ICacheManager;
  private dataRetriever?: (key: string) => Promise<any>;
  private config: CacheFallbackConfig;
  private stats: CacheFallbackStats;
  private isHealthy = true;
  private recoveryTimer?: NodeJS.Timeout;
  private lastHealthCheck = new Date();

  constructor(
    primaryCache: ICacheManager,
    dataRetriever?: (key: string) => Promise<any>,
    config?: Partial<CacheFallbackConfig>
  ) {
    this.primaryCache = primaryCache;
    this.dataRetriever = dataRetriever;
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitterFactor: 0.1,
      fallbackToDirectRetrieval: true,
      enableRecovery: true,
      healthCheckIntervalMs: 60000,
      ...config,
    };
    this.stats = {
      totalOperations: 0,
      fallbackOperations: 0,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      currentlyFallenBack: false,
      lastFailureTime: null,
      lastRecoveryTime: null,
    };

    if (this.config.enableRecovery) {
      this.startRecoveryProcess();
    }
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      // Cache is unhealthy, skip caching but don't fail
      return;
    }

    try {
      await this.executeWithRetry(() => this.primaryCache.set(key, data, ttl));
    } catch (error) {
      await this.handleCacheFailure('set', error);
      // Don't throw error for set operations - graceful degradation
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      return await this.fallbackGet<T>(key);
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.get<T>(key));
    } catch (error) {
      await this.handleCacheFailure('get', error);
      return await this.fallbackGet<T>(key);
    }
  }

  async has(key: string): Promise<boolean> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      // If cache is unhealthy, assume key doesn't exist
      return false;
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.has(key));
    } catch (error) {
      await this.handleCacheFailure('has', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      // Cache is unhealthy, assume deletion succeeded
      return true;
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.delete(key));
    } catch (error) {
      await this.handleCacheFailure('delete', error);
      return true; // Graceful degradation - assume deletion succeeded
    }
  }

  async clear(): Promise<void> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      return;
    }

    try {
      await this.executeWithRetry(() => this.primaryCache.clear());
    } catch (error) {
      await this.handleCacheFailure('clear', error);
      // Don't throw error - graceful degradation
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!this.isHealthy) {
      // Return empty stats when cache is unhealthy
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 1,
        evictionCount: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.getStats());
    } catch (error) {
      await this.handleCacheFailure('getStats', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 1,
        evictionCount: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    this.stats.totalOperations++;

    if (!this.isHealthy) {
      return 0;
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.invalidatePattern(pattern));
    } catch (error) {
      await this.handleCacheFailure('invalidatePattern', error);
      return 0;
    }
  }

  configure(config: Partial<CacheConfig>): void {
    if (this.isHealthy) {
      try {
        this.primaryCache.configure(config);
      } catch (error) {
        // Ignore configuration errors during fallback
      }
    }
  }

  async cleanup(): Promise<number> {
    if (!this.isHealthy) {
      return 0;
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.cleanup());
    } catch (error) {
      await this.handleCacheFailure('cleanup', error);
      return 0;
    }
  }

  async getMetadata(key: string): Promise<Omit<CacheEntry, 'data'> | null> {
    if (!this.isHealthy) {
      return null;
    }

    try {
      return await this.executeWithRetry(() => this.primaryCache.getMetadata(key));
    } catch (error) {
      await this.handleCacheFailure('getMetadata', error);
      return null;
    }
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(): CacheFallbackStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger cache health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Try a simple operation to test cache health
      await this.primaryCache.has('__health_check__');
      
      if (!this.isHealthy) {
        // Cache recovered
        this.isHealthy = true;
        this.stats.successfulRecoveries++;
        this.stats.lastRecoveryTime = new Date();
        this.stats.currentlyFallenBack = false;
      }
      
      this.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      if (this.isHealthy) {
        // Cache just failed
        await this.handleCacheFailure('healthCheck', error);
      }
      return false;
    }
  }

  /**
   * Destroy the fallback manager and cleanup resources
   */
  destroy(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError!;
  }

  private async fallbackGet<T>(key: string): Promise<T | null> {
    this.stats.fallbackOperations++;

    if (this.config.fallbackToDirectRetrieval && this.dataRetriever) {
      try {
        return await this.dataRetriever(key);
      } catch (error) {
        // Even fallback failed, return null
        return null;
      }
    }

    return null;
  }

  private async handleCacheFailure(operation: string, error: any): Promise<void> {
    if (this.isHealthy) {
      this.isHealthy = false;
      this.stats.currentlyFallenBack = true;
      this.stats.lastFailureTime = new Date();
    }

    // Log the failure (in a real implementation, use proper logging)
    console.warn(`Cache operation '${operation}' failed, falling back:`, error.message);
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.baseDelayMs * Math.pow(2, attempt);
    const jitter = baseDelay * this.config.jitterFactor * Math.random();
    const delay = Math.min(baseDelay + jitter, this.config.maxDelayMs);
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startRecoveryProcess(): void {
    this.recoveryTimer = setInterval(async () => {
      if (!this.isHealthy) {
        this.stats.recoveryAttempts++;
        await this.checkHealth();
      }
    }, this.config.healthCheckIntervalMs);
  }
}

/**
 * Factory function to create a cache fallback manager
 */
export function createCacheFallbackManager(
  primaryCache: ICacheManager,
  dataRetriever?: (key: string) => Promise<any>,
  config?: Partial<CacheFallbackConfig>
): CacheFallbackManager {
  return new CacheFallbackManager(primaryCache, dataRetriever, config);
}