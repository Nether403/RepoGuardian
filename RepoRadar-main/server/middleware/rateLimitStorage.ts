import { redisManager, RedisClientType } from '../redis';
import { db } from '../db';
import { rateLimits } from '../../shared/schema';
import { eq, lt } from 'drizzle-orm';
import { RateLimitStorage } from './rateLimiter';

/**
 * In-memory rate limit storage
 * Used for development and as fallback
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime < now) {
      const data = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, data);
      return data;
    }

    existing.count++;
    return existing;
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const data = this.store.get(key);
    if (!data) return null;

    const now = Date.now();
    if (data.resetTime < now) {
      this.store.delete(key);
      return null;
    }

    return data;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (data.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Redis rate limit storage
 * Used for production with distributed systems
 */
export class RedisRateLimitStorage implements RateLimitStorage {
  private client: RedisClientType | null = null;

  async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = await redisManager.getClient();
    }
    return this.client;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    try {
      const client = await this.getClient();
      const now = Date.now();
      const resetTime = now + windowMs;
      const ttlSeconds = Math.ceil(windowMs / 1000);

      // Use Redis INCR for atomic increment
      const count = await client.incr(key);

      // Set expiry on first increment
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }

      return { count, resetTime };
    } catch (error) {
      console.error('Redis rate limit increment error:', error);
      throw error;
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const client = await this.getClient();
      const count = await client.get(key);
      
      if (!count) return null;

      const ttl = await client.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);

      return {
        count: parseInt(count, 10),
        resetTime,
      };
    } catch (error) {
      console.error('Redis rate limit get error:', error);
      return null;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(key);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Redis handles cleanup automatically via TTL
  }
}

/**
 * PostgreSQL rate limit storage
 * Used as fallback when Redis is not available
 */
export class PostgresRateLimitStorage implements RateLimitStorage {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    try {
      // Try to get existing record
      const existing = await db.query.rateLimits.findFirst({
        where: eq(rateLimits.key, key),
      });

      if (!existing || new Date(existing.resetAt) < now) {
        // Create new record or reset expired one
        if (existing) {
          await db.delete(rateLimits).where(eq(rateLimits.key, key));
        }

        const [newRecord] = await db.insert(rateLimits).values({
          key,
          count: 1,
          resetAt,
        }).returning();

        return {
          count: newRecord.count,
          resetTime: newRecord.resetAt.getTime(),
        };
      }

      // Increment existing record
      const [updated] = await db
        .update(rateLimits)
        .set({ count: existing.count + 1 })
        .where(eq(rateLimits.key, key))
        .returning();

      return {
        count: updated.count,
        resetTime: updated.resetAt.getTime(),
      };
    } catch (error) {
      console.error('PostgreSQL rate limit increment error:', error);
      throw error;
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const record = await db.query.rateLimits.findFirst({
        where: eq(rateLimits.key, key),
      });

      if (!record) return null;

      const now = new Date();
      if (new Date(record.resetAt) < now) {
        await this.reset(key);
        return null;
      }

      return {
        count: record.count,
        resetTime: record.resetAt.getTime(),
      };
    } catch (error) {
      console.error('PostgreSQL rate limit get error:', error);
      return null;
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await db.delete(rateLimits).where(eq(rateLimits.key, key));
    } catch (error) {
      console.error('PostgreSQL rate limit reset error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      const now = new Date();
      await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
    } catch (error) {
      console.error('PostgreSQL rate limit cleanup error:', error);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Factory function to create appropriate storage backend
 */
export async function createRateLimitStorage(): Promise<RateLimitStorage> {
  const storageType = process.env.RATE_LIMIT_STORAGE || 'auto';

  // Auto-detect best storage option
  if (storageType === 'auto') {
    // Try Redis first
    if (redisManager.isRedisEnabled()) {
      try {
        await redisManager.getClient();
        console.log('Rate limiting: Using Redis storage');
        return new RedisRateLimitStorage();
      } catch (error) {
        console.warn('Rate limiting: Redis unavailable, falling back to PostgreSQL');
      }
    }

    // Fall back to PostgreSQL
    console.log('Rate limiting: Using PostgreSQL storage');
    return new PostgresRateLimitStorage();
  }

  // Explicit storage type
  switch (storageType) {
    case 'redis':
      console.log('Rate limiting: Using Redis storage');
      return new RedisRateLimitStorage();
    
    case 'postgres':
      console.log('Rate limiting: Using PostgreSQL storage');
      return new PostgresRateLimitStorage();
    
    case 'memory':
      console.log('Rate limiting: Using in-memory storage');
      return new MemoryRateLimitStorage();
    
    default:
      console.warn(`Unknown storage type: ${storageType}, using in-memory`);
      return new MemoryRateLimitStorage();
  }
}
