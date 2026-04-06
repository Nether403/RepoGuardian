import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryCacheManager, createCacheManager } from '../CacheManager';
import type { CacheConfig } from '../interfaces';

describe('InMemoryCacheManager', () => {
  let cacheManager: InMemoryCacheManager;

  beforeEach(() => {
    cacheManager = new InMemoryCacheManager();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve data', async () => {
      const testData = { message: 'Hello, World!' };
      await cacheManager.set('test-key', testData);
      
      const retrieved = await cacheManager.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      await cacheManager.set('test-key', 'test-value');
      
      expect(await cacheManager.has('test-key')).toBe(true);
      expect(await cacheManager.has('non-existent')).toBe(false);
    });

    it('should delete keys', async () => {
      await cacheManager.set('test-key', 'test-value');
      expect(await cacheManager.has('test-key')).toBe(true);
      
      const deleted = await cacheManager.delete('test-key');
      expect(deleted).toBe(true);
      expect(await cacheManager.has('test-key')).toBe(false);
    });

    it('should clear all entries', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      
      await cacheManager.clear();
      
      expect(await cacheManager.has('key1')).toBe(false);
      expect(await cacheManager.has('key2')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should expire entries after TTL', async () => {
      await cacheManager.set('test-key', 'test-value', 1000); // 1 second TTL
      
      expect(await cacheManager.has('test-key')).toBe(true);
      
      // Advance time by 1.5 seconds
      vi.advanceTimersByTime(1500);
      
      expect(await cacheManager.has('test-key')).toBe(false);
      expect(await cacheManager.get('test-key')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const config: Partial<CacheConfig> = { ttl: 2000 };
      cacheManager.configure(config);
      
      await cacheManager.set('test-key', 'test-value');
      
      // Should still exist after 1 second
      vi.advanceTimersByTime(1000);
      expect(await cacheManager.has('test-key')).toBe(true);
      
      // Should expire after 2.5 seconds
      vi.advanceTimersByTime(1500);
      expect(await cacheManager.has('test-key')).toBe(false);
    });

    it('should cleanup expired entries', async () => {
      await cacheManager.set('key1', 'value1', 1000);
      await cacheManager.set('key2', 'value2', 2000);
      await cacheManager.set('key3', 'value3', 3000);
      
      // Advance time to expire first two entries
      vi.advanceTimersByTime(2500);
      
      const cleanedCount = await cacheManager.cleanup();
      expect(cleanedCount).toBe(2);
      
      expect(await cacheManager.has('key1')).toBe(false);
      expect(await cacheManager.has('key2')).toBe(false);
      expect(await cacheManager.has('key3')).toBe(true);
    });
  });

  describe('Size Management and LRU Eviction', () => {
    it('should enforce size limits with LRU eviction', async () => {
      const smallSizeConfig: Partial<CacheConfig> = { maxSize: 100 }; // 100 bytes
      cacheManager.configure(smallSizeConfig);
      
      // Add entries that will exceed the size limit
      await cacheManager.set('key1', 'a'.repeat(30)); // ~30 bytes
      await cacheManager.set('key2', 'b'.repeat(30)); // ~30 bytes
      await cacheManager.set('key3', 'c'.repeat(30)); // ~30 bytes
      
      // Access key1 to make it more recently used
      await cacheManager.get('key1');
      
      // Add another entry that should trigger eviction
      await cacheManager.set('key4', 'd'.repeat(30)); // ~30 bytes
      
      // key2 should be evicted (least recently used)
      expect(await cacheManager.has('key1')).toBe(true);
      expect(await cacheManager.has('key2')).toBe(false);
      expect(await cacheManager.has('key3')).toBe(true);
      expect(await cacheManager.has('key4')).toBe(true);
    });

    it('should reject entries larger than max size', async () => {
      const smallSizeConfig: Partial<CacheConfig> = { maxSize: 50 };
      cacheManager.configure(smallSizeConfig);
      
      await expect(
        cacheManager.set('large-key', 'x'.repeat(100))
      ).rejects.toThrow('Cache entry size');
    });
  });

  describe('Statistics', () => {
    it('should track hit and miss rates', async () => {
      await cacheManager.set('key1', 'value1');
      
      // Generate some hits and misses
      await cacheManager.get('key1'); // hit
      await cacheManager.get('key1'); // hit
      await cacheManager.get('non-existent'); // miss
      
      const stats = await cacheManager.getStats();
      expect(stats.hitRate).toBe(2/3); // 2 hits out of 3 requests
      expect(stats.missRate).toBe(1/3); // 1 miss out of 3 requests
      expect(stats.totalEntries).toBe(1);
    });

    it('should track entry timestamps', async () => {
      vi.useFakeTimers();
      const now = new Date();
      vi.setSystemTime(now);
      
      await cacheManager.set('key1', 'value1');
      
      vi.advanceTimersByTime(1000);
      await cacheManager.set('key2', 'value2');
      
      const stats = await cacheManager.getStats();
      expect(stats.oldestEntry).toEqual(now);
      expect(stats.newestEntry).toEqual(new Date(now.getTime() + 1000));
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate entries matching pattern', async () => {
      await cacheManager.set('user:123', 'user data');
      await cacheManager.set('user:456', 'user data');
      await cacheManager.set('post:789', 'post data');
      
      const deletedCount = await cacheManager.invalidatePattern('^user:');
      expect(deletedCount).toBe(2);
      
      expect(await cacheManager.has('user:123')).toBe(false);
      expect(await cacheManager.has('user:456')).toBe(false);
      expect(await cacheManager.has('post:789')).toBe(true);
    });

    it('should handle complex regex patterns', async () => {
      await cacheManager.set('api:v1:users', 'data');
      await cacheManager.set('api:v1:posts', 'data');
      await cacheManager.set('api:v2:users', 'data');
      
      const deletedCount = await cacheManager.invalidatePattern('api:v1:.*');
      expect(deletedCount).toBe(2);
      
      expect(await cacheManager.has('api:v2:users')).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('should return entry metadata', async () => {
      const now = new Date();
      vi.setSystemTime(now);
      
      await cacheManager.set('test-key', 'test-value', 5000);
      await cacheManager.get('test-key'); // Increment hit count
      
      const metadata = await cacheManager.getMetadata('test-key');
      expect(metadata).toMatchObject({
        key: 'test-key',
        timestamp: now,
        ttl: 5000,
        hits: 1,
        compressed: false,
      });
      expect(metadata?.size).toBeGreaterThan(0);
    });

    it('should return null for non-existent keys', async () => {
      const metadata = await cacheManager.getMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should apply configuration changes', async () => {
      const newConfig: Partial<CacheConfig> = {
        ttl: 10000,
        maxSize: 1024,
        compressionEnabled: true,
      };
      
      cacheManager.configure(newConfig);
      
      // Test that new TTL is applied
      await cacheManager.set('test-key', 'test-value');
      
      vi.useFakeTimers();
      vi.advanceTimersByTime(5000); // Less than new TTL
      expect(await cacheManager.has('test-key')).toBe(true);
      
      vi.advanceTimersByTime(6000); // More than new TTL
      expect(await cacheManager.has('test-key')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted data gracefully', async () => {
      // Manually corrupt cache data
      const cache = (cacheManager as any).cache;
      cache.set('corrupted-key', {
        key: 'corrupted-key',
        data: 'invalid-json{',
        timestamp: new Date(),
        ttl: 300000,
        hits: 0,
        size: 100,
      });
      
      const result = await cacheManager.get('corrupted-key');
      expect(result).toBeNull();
      expect(await cacheManager.has('corrupted-key')).toBe(false);
    });
  });
});

describe('createCacheManager factory', () => {
  it('should create cache manager with default config', () => {
    const manager = createCacheManager();
    expect(manager).toBeInstanceOf(InMemoryCacheManager);
  });

  it('should create cache manager with custom config', () => {
    const config: Partial<CacheConfig> = { ttl: 60000, maxSize: 1024 };
    const manager = createCacheManager(config);
    expect(manager).toBeInstanceOf(InMemoryCacheManager);
  });
});