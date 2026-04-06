import { redisManager } from './redis.js';
import { logger } from './instanceId.js';

/**
 * Cache Service with Redis and Memory Fallback
 * Provides a unified caching interface that gracefully falls back to memory cache
 * when Redis is unavailable
 * 
 * Requirements:
 * - 3.1: Graceful fallback to memory cache when Redis unavailable
 * - 3.2: Non-blocking Redis operations
 */

interface CacheEntry {
  value: string;
  expiresAt: number;
}

class CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 3600; // 1 hour in seconds
  private readonly maxMemoryCacheSize = 1000; // Maximum entries in memory cache

  constructor() {
    // Start cleanup interval for memory cache
    this.startCleanupInterval();
    logger.info('Cache: Service initialized');
  }

  /**
   * Start periodic cleanup of expired memory cache entries
   */
  private startCleanupInterval(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache: Cleaned ${cleaned} expired entries from memory cache`);
    }

    // If memory cache is too large, remove oldest entries
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      const entriesToRemove = this.memoryCache.size - this.maxMemoryCacheSize;
      const keys = Array.from(this.memoryCache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.memoryCache.delete(keys[i]);
      }
      logger.debug(`Cache: Removed ${entriesToRemove} entries to maintain size limit`);
    }
  }

  /**
   * Get value from cache (tries Redis first, falls back to memory)
   */
  async get(key: string): Promise<string | null> {
    try {
      // Try Redis first if available
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const redisClient = await redisManager.getClient();
        const value = await redisClient.get(key);
        
        if (value !== null) {
          logger.debug(`Cache: Hit (Redis) - ${key}`);
          return value;
        }
      }
    } catch (error) {
      logger.warn(`Cache: Redis get failed for key ${key}, falling back to memory`, { error });
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        logger.debug(`Cache: Hit (Memory) - ${key}`);
        return entry.value;
      } else {
        // Entry expired, remove it
        this.memoryCache.delete(key);
      }
    }

    logger.debug(`Cache: Miss - ${key}`);
    return null;
  }

  /**
   * Set value in cache (tries Redis first, always sets in memory as backup)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    const expiresAt = Date.now() + (ttl * 1000);

    try {
      // Try Redis first if available
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const redisClient = await redisManager.getClient();
        await redisClient.setEx(key, ttl, value);
        logger.debug(`Cache: Set (Redis) - ${key} (TTL: ${ttl}s)`);
      }
    } catch (error) {
      logger.warn(`Cache: Redis set failed for key ${key}, using memory only`, { error });
    }

    // Always set in memory cache as backup
    this.memoryCache.set(key, { value, expiresAt });
    logger.debug(`Cache: Set (Memory) - ${key} (TTL: ${ttl}s)`);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      // Try Redis first if available
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const redisClient = await redisManager.getClient();
        await redisClient.del(key);
        logger.debug(`Cache: Delete (Redis) - ${key}`);
      }
    } catch (error) {
      logger.warn(`Cache: Redis delete failed for key ${key}`, { error });
    }

    // Always delete from memory cache
    this.memoryCache.delete(key);
    logger.debug(`Cache: Delete (Memory) - ${key}`);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      // Try Redis first if available
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const redisClient = await redisManager.getClient();
        const exists = await redisClient.exists(key);
        return exists > 0;
      }
    } catch (error) {
      logger.warn(`Cache: Redis exists check failed for key ${key}, checking memory`, { error });
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return true;
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      // Try Redis first if available
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const redisClient = await redisManager.getClient();
        await redisClient.flushDb();
        logger.info('Cache: Cleared (Redis)');
      }
    } catch (error) {
      logger.warn('Cache: Redis clear failed', { error });
    }

    // Always clear memory cache
    this.memoryCache.clear();
    logger.info('Cache: Cleared (Memory)');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    redisEnabled: boolean;
    redisConnected: boolean;
  } {
    return {
      memorySize: this.memoryCache.size,
      redisEnabled: redisManager.isRedisEnabled(),
      redisConnected: redisManager.isConnected(),
    };
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded';
    backend: 'redis' | 'memory';
    memorySize: number;
    redisStatus?: 'up' | 'down' | 'degraded';
  }> {
    const stats = this.getStats();
    
    let redisStatus: 'up' | 'down' | 'degraded' | undefined;
    if (stats.redisEnabled) {
      const redisHealth = await redisManager.getHealthStatus();
      redisStatus = redisHealth.status;
    }

    return {
      status: stats.redisConnected ? 'healthy' : 'degraded',
      backend: stats.redisConnected ? 'redis' : 'memory',
      memorySize: stats.memorySize,
      redisStatus,
    };
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
    logger.info('Cache: Service shutdown');
  }
}

// Export singleton instance
export const cacheService = new CacheService();
