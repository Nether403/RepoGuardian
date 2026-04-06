import { Request, Response, NextFunction } from 'express';
import { redisManager, RedisClientType } from '../redis';
import { config } from '../config';

// Rate limit storage interface
export interface RateLimitStorage {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  reset(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Redis-backed rate limit storage for distributed rate limiting
 * Requirement 12.4: Use Redis for distributed rate limiting when available
 */
export class RedisRateLimitStorage implements RateLimitStorage {
  private keyPrefix: string;

  constructor(keyPrefix = 'ratelimit:') {
    this.keyPrefix = keyPrefix;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const client = await redisManager.tryGetClient();
    
    if (!client) {
      throw new Error('Redis client not available');
    }

    const redisKey = `${this.keyPrefix}${key}`;
    const now = Date.now();
    const resetTime = now + windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = client.multi();
      
      // Increment counter
      pipeline.incr(redisKey);
      
      // Set expiration if key is new
      pipeline.pExpire(redisKey, windowMs);
      
      // Get TTL to calculate reset time
      pipeline.pTTL(redisKey);
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const count = Number(results[0]) || 0;
      const ttl = Number(results[2]) || windowMs;
      
      // Calculate actual reset time based on TTL
      const actualResetTime = ttl > 0 ? now + ttl : resetTime;

      return {
        count,
        resetTime: actualResetTime,
      };
    } catch (error) {
      console.error('Redis rate limit increment error:', error);
      throw error;
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const client = await redisManager.tryGetClient();
    
    if (!client) {
      return null;
    }

    const redisKey = `${this.keyPrefix}${key}`;
    const now = Date.now();

    try {
      const pipeline = client.multi();
      pipeline.get(redisKey);
      pipeline.pTTL(redisKey);
      
      const results = await pipeline.exec();
      
      if (!results) {
        return null;
      }

      const countStr = String(results[0] || '');
      const ttl = Number(results[1]) || 0;

      if (!countStr || ttl <= 0) {
        return null;
      }

      return {
        count: parseInt(countStr, 10),
        resetTime: now + ttl,
      };
    } catch (error) {
      console.error('Redis rate limit get error:', error);
      return null;
    }
  }

  async reset(key: string): Promise<void> {
    const client = await redisManager.tryGetClient();
    
    if (!client) {
      return;
    }

    const redisKey = `${this.keyPrefix}${key}`;

    try {
      await client.del(redisKey);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Redis automatically handles cleanup via TTL
    // No manual cleanup needed
  }
}

/**
 * Memory-backed rate limit storage for single-instance deployments
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.resetTime > now) {
      // Increment existing counter
      existing.count++;
      return existing;
    } else {
      // Create new counter
      const data = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, data);
      return data;
    }
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const now = Date.now();
    const data = this.store.get(key);

    if (!data || data.resetTime <= now) {
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
      if (data.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  private startCleanup(): void {
    // Run cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, 60000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Subscription tiers for rate limiting
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// Rate limit configuration by tier
export interface TierLimits {
  free: { limit: number; window: number };
  pro: { limit: number; window: number };
  enterprise: { limit: number; window: number };
}

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  storage?: RateLimitStorage; // Custom storage backend
  tierLimits?: TierLimits; // Tier-based limits
  message?: string; // Custom error message
}

// Helper to get user tier from request
function getUserTier(req: Request): SubscriptionTier {
  const user = (req as any).user;
  return user?.subscriptionTier || 'free';
}

// Helper to get tier-specific limits
function getTierLimit(tierLimits: TierLimits | undefined, tier: SubscriptionTier): { limit: number; window: number } | null {
  if (!tierLimits) return null;
  return tierLimits[tier];
}

export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    storage,
    tierLimits,
    message = 'Too many requests, please try again later',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();

      // Determine limits based on tier if configured
      let effectiveLimit = maxRequests;
      let effectiveWindow = windowMs;
      
      if (tierLimits) {
        const tier = getUserTier(req);
        const tierLimit = getTierLimit(tierLimits, tier);
        
        if (tierLimit) {
          effectiveLimit = tierLimit.limit;
          effectiveWindow = tierLimit.window;
          
          // Enterprise tier gets unlimited access
          if (tier === 'enterprise' && tierLimit.limit === -1) {
            // Still add headers to indicate unlimited access
            res.set({
              'X-RateLimit-Limit': 'unlimited',
              'X-RateLimit-Remaining': 'unlimited',
              'X-RateLimit-Reset': new Date(now + effectiveWindow).toISOString(),
            });
            return next();
          }
        }
      }

      // Use storage backend if provided, otherwise use in-memory
      let limitData: { count: number; resetTime: number };
      
      if (storage) {
        limitData = await storage.increment(key, effectiveWindow);
      } else {
        // Fallback to in-memory storage (legacy behavior)
        const windowStart = now - effectiveWindow;
        
        if (!store[key] || store[key].resetTime < windowStart) {
          store[key] = {
            count: 1,
            resetTime: now + effectiveWindow,
          };
        } else {
          store[key].count++;
        }
        
        limitData = store[key];
      }

      // Check if limit exceeded
      if (limitData.count > effectiveLimit) {
        const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);
        const exceedBy = limitData.count - effectiveLimit;
        
        // Log rate limit violation for security monitoring
        const violation: RateLimitViolation = {
          key,
          limit: effectiveLimit,
          count: limitData.count,
          exceedBy,
          ip: req.ip || 'unknown',
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
          timestamp: new Date().toISOString(),
        };
        
        logRateLimitViolation(violation);
        console.warn('Rate limit exceeded:', violation);
        
        // Implement progressive delay for repeated failures
        // Add a small delay that increases with each violation
        const progressiveDelay = Math.min(exceedBy * 100, 2000); // Max 2 seconds
        await new Promise(resolve => setTimeout(resolve, progressiveDelay));
        
        // Add standard rate limit headers
        // Requirement 12.4: Add rate limit headers to responses
        res.set({
          'X-RateLimit-Limit': effectiveLimit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(limitData.resetTime).toISOString(),
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Policy': `${effectiveLimit};w=${Math.floor(effectiveWindow / 1000)}`,
        });
        
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter,
          limit: effectiveLimit,
          resetAt: new Date(limitData.resetTime).toISOString(),
        });
      }

      // Add rate limit headers to successful responses
      // Requirement 12.4: Add rate limit headers to responses
      const remaining = Math.max(0, effectiveLimit - limitData.count);
      res.set({
        'X-RateLimit-Limit': effectiveLimit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(limitData.resetTime).toISOString(),
        'X-RateLimit-Policy': `${effectiveLimit};w=${Math.floor(effectiveWindow / 1000)}`,
      });

      // Handle response to potentially skip counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function(body) {
          const statusCode = res.statusCode;
          
          // Decrement counter if we should skip this request
          if (
            (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
            (skipFailedRequests && statusCode >= 400)
          ) {
            if (storage) {
              // For storage backends, we'd need to implement decrement
              // For now, we'll skip this optimization
            } else if (store[key]) {
              store[key].count--;
            }
          }
          
          return originalSend.call(this, body);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request through but log it
      next();
    }
  };
}

// In-memory store for legacy support
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Track rate limit violations for security monitoring
interface RateLimitViolation {
  key: string;
  limit: number;
  count: number;
  exceedBy: number;
  ip: string;
  path: string;
  method: string;
  userAgent?: string;
  timestamp: string;
}

const violations: RateLimitViolation[] = [];
const MAX_VIOLATIONS_STORED = 1000;

export function logRateLimitViolation(violation: RateLimitViolation): void {
  violations.push(violation);
  
  // Keep only the most recent violations
  if (violations.length > MAX_VIOLATIONS_STORED) {
    violations.shift();
  }
}

export function getRateLimitViolations(limit = 100): RateLimitViolation[] {
  return violations.slice(-limit);
}

export function clearRateLimitViolations(): void {
  violations.length = 0;
}

/**
 * Get rate limit storage based on configuration
 * Requirement 12.4: Use Redis for distributed rate limiting when available
 */
function getRateLimitStorage(): RateLimitStorage | undefined {
  try {
    const rateLimitConfig = config.getRateLimit();
    const cacheConfig = config.getCache();
    
    // Use Redis storage if configured and available
    if (rateLimitConfig.storage === 'redis' && redisManager.isConnected()) {
      console.log('Using Redis-backed rate limiting');
      return new RedisRateLimitStorage(cacheConfig.redis.keyPrefix + 'ratelimit:');
    }
    
    // Fall back to memory storage
    console.log('Using memory-backed rate limiting');
    return new MemoryRateLimitStorage();
  } catch (error) {
    console.error('Error initializing rate limit storage:', error);
    // Return memory storage as fallback
    return new MemoryRateLimitStorage();
  }
}

// Initialize storage backend
let rateLimitStorage: RateLimitStorage | undefined;

/**
 * Initialize rate limit storage
 * Should be called after Redis connection is established
 */
export function initializeRateLimitStorage(): void {
  rateLimitStorage = getRateLimitStorage();
}

/**
 * Get current rate limit storage
 */
export function getRateLimitStorageInstance(): RateLimitStorage | undefined {
  if (!rateLimitStorage) {
    rateLimitStorage = getRateLimitStorage();
  }
  return rateLimitStorage;
}

// Predefined rate limiters with production configuration
// Requirement 12.4: Configure different limits for free/pro tiers

/**
 * Authentication rate limiter - IP-based for login/signup
 * Protects against brute force attacks
 */
export function createAuthRateLimit() {
  const rateLimitConfig = config.getRateLimit();
  return createRateLimit({
    windowMs: rateLimitConfig.auth.login.window,
    maxRequests: rateLimitConfig.auth.login.limit,
    keyGenerator: (req) => `auth:${req.ip || 'unknown'}`,
    message: 'Too many authentication attempts. Please try again later.',
    storage: getRateLimitStorageInstance(),
  });
}

/**
 * Password reset rate limiter - email-based
 * Prevents abuse of password reset functionality
 */
export function createResetRateLimit() {
  const rateLimitConfig = config.getRateLimit();
  return createRateLimit({
    windowMs: rateLimitConfig.auth.reset.window,
    maxRequests: rateLimitConfig.auth.reset.limit,
    keyGenerator: (req) => {
      const email = req.body?.email || 'unknown';
      return `reset:${email}`;
    },
    message: 'Too many password reset requests. Please try again later.',
    storage: getRateLimitStorageInstance(),
  });
}

/**
 * API rate limiter with tier support - user-based
 * Requirement 12.4: Configure different limits for free/pro tiers
 */
export function createApiRateLimit() {
  const rateLimitConfig = config.getRateLimit();
  return createRateLimit({
    windowMs: rateLimitConfig.api.free.window,
    maxRequests: rateLimitConfig.api.free.limit,
    keyGenerator: (req) => {
      const user = (req as any).user;
      return `api:${user?.claims?.sub || req.ip || 'unknown'}`;
    },
    tierLimits: {
      free: { 
        limit: rateLimitConfig.api.free.limit, 
        window: rateLimitConfig.api.free.window 
      },
      pro: { 
        limit: rateLimitConfig.api.pro.limit, 
        window: rateLimitConfig.api.pro.window 
      },
      enterprise: { limit: -1, window: 0 }, // unlimited
    },
    message: 'API rate limit exceeded. Please upgrade your plan for higher limits.',
    storage: getRateLimitStorageInstance(),
  });
}

/**
 * Analysis rate limiter with tier support
 * Requirement 12.4: Configure different limits for free/pro tiers
 */
export function createAnalysisRateLimit() {
  const rateLimitConfig = config.getRateLimit();
  return createRateLimit({
    windowMs: rateLimitConfig.analysis.free.window,
    maxRequests: rateLimitConfig.analysis.free.limit,
    keyGenerator: (req) => {
      const user = (req as any).user;
      return `analysis:${user?.claims?.sub || req.ip || 'unknown'}`;
    },
    tierLimits: {
      free: { 
        limit: rateLimitConfig.analysis.free.limit, 
        window: rateLimitConfig.analysis.free.window 
      },
      pro: { 
        limit: rateLimitConfig.analysis.pro.limit, 
        window: rateLimitConfig.analysis.pro.window 
      },
      enterprise: { limit: -1, window: 0 }, // unlimited
    },
    message: 'Analysis limit exceeded. Please upgrade your plan for more analyses.',
    storage: getRateLimitStorageInstance(),
  });
}

/**
 * Search rate limiter
 * Prevents abuse of search functionality
 */
export function createSearchRateLimit() {
  return createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 searches per minute
    keyGenerator: (req) => {
      const user = (req as any).user;
      return `search:${user?.claims?.sub || req.ip || 'unknown'}`;
    },
    storage: getRateLimitStorageInstance(),
  });
}

/**
 * General API rate limiter (legacy)
 * Used for endpoints without specific rate limiting
 */
export function createGeneralApiRateLimit() {
  return createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    storage: getRateLimitStorageInstance(),
  });
}

// Export lazy-initialized rate limiters
export const authRateLimit = createAuthRateLimit();
export const resetRateLimit = createResetRateLimit();
export const apiRateLimit = createApiRateLimit();
export const analysisRateLimit = createAnalysisRateLimit();
export const searchRateLimit = createSearchRateLimit();
export const generalApiRateLimit = createGeneralApiRateLimit();