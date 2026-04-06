import { ICacheManager, CacheEntry, CacheStats, CacheConfig } from './interfaces';

/**
 * In-memory cache manager with TTL and size limits
 * Implements LRU eviction strategy when size limits are exceeded
 */
export class InMemoryCacheManager implements ICacheManager {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // For LRU tracking
  private accessCounter = 0;
  private config: CacheConfig = {
    key: 'default',
    ttl: 300000, // 5 minutes default
    invalidationStrategy: 'time',
    compressionEnabled: false,
    maxSize: 100 * 1024 * 1024, // 100MB default
  };
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.configure(config);
    }
  }

  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.config.ttl;
    const serializedData = JSON.stringify(data);
    const size = Buffer.byteLength(serializedData, 'utf8');
    
    // Check if adding this entry would exceed size limit
    if (this.config.maxSize && size > this.config.maxSize) {
      throw new Error(`Cache entry size (${size}) exceeds maximum allowed size (${this.config.maxSize})`);
    }

    // Evict entries if necessary to make room
    await this.evictIfNecessary(size);

    const entry: CacheEntry = {
      key,
      data: serializedData,
      timestamp: new Date(),
      ttl: effectiveTtl,
      hits: 0,
      size,
      compressed: false,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.hits++;
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.hits++;

    try {
      return JSON.parse(entry.data) as T;
    } catch (error) {
      // If parsing fails, remove the corrupted entry
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.accessCounter = 0;
  }

  async getStats(): Promise<CacheStats> {
    // Clean up expired entries first
    await this.cleanup();

    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    
    const timestamps = entries.map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : null;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : null;

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      evictionCount: this.stats.evictions,
      oldestEntry,
      newestEntry,
    };
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  async getMetadata(key: string): Promise<Omit<CacheEntry, 'data'> | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    const { data, ...metadata } = entry;
    return metadata;
  }

  private isExpired(entry: CacheEntry, now: Date = new Date()): boolean {
    return now.getTime() - entry.timestamp.getTime() > entry.ttl;
  }

  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    if (!this.config.maxSize) {
      return;
    }

    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    
    if (currentSize + newEntrySize <= this.config.maxSize) {
      return;
    }

    // Sort entries by access order (LRU first)
    const entriesByAccess = Array.from(this.cache.entries())
      .sort(([keyA], [keyB]) => {
        const accessA = this.accessOrder.get(keyA) ?? 0;
        const accessB = this.accessOrder.get(keyB) ?? 0;
        return accessA - accessB;
      });

    let freedSize = 0;
    for (const [key, entry] of entriesByAccess) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      freedSize += entry.size;
      this.stats.evictions++;

      if (currentSize - freedSize + newEntrySize <= this.config.maxSize) {
        break;
      }
    }
  }
}

/**
 * Factory function to create cache manager instances
 */
export function createCacheManager(config?: Partial<CacheConfig>): ICacheManager {
  return new InMemoryCacheManager(config);
}