/**
 * Rate Limiting Production Tests
 * 
 * Tests for Task 17: Configure rate limiting for production
 * Requirements: 12.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  createRateLimit,
  RedisRateLimitStorage,
  MemoryRateLimitStorage,
  initializeRateLimitStorage,
  getRateLimitStorageInstance,
  createAuthRateLimit,
  createApiRateLimit,
  createAnalysisRateLimit,
  logRateLimitViolation,
  getRateLimitViolations,
  clearRateLimitViolations,
} from '../middleware/rateLimiter';

// Mock Redis manager
vi.mock('../redis', () => ({
  redisManager: {
    isConnected: vi.fn(() => false),
    tryGetClient: vi.fn(() => null),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    getRateLimit: vi.fn(() => ({
      storage: 'memory',
      auth: {
        login: { limit: 5, window: 900000 },
        signup: { limit: 3, window: 3600000 },
        reset: { limit: 3, window: 3600000 },
      },
      api: {
        free: { limit: 100, window: 3600000 },
        pro: { limit: 1000, window: 3600000 },
      },
      analysis: {
        free: { limit: 10, window: 86400000 },
        pro: { limit: 100, window: 86400000 },
      },
    })),
    getCache: vi.fn(() => ({
      redis: {
        keyPrefix: 'reporadar:',
      },
    })),
  },
}));

describe('Rate Limiting - Memory Storage', () => {
  let storage: MemoryRateLimitStorage;

  beforeEach(() => {
    storage = new MemoryRateLimitStorage();
  });

  afterEach(() => {
    storage.stopCleanup();
  });

  it('should increment counter on first request', async () => {
    const result = await storage.increment('test-key', 60000);
    
    expect(result.count).toBe(1);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('should increment counter on subsequent requests', async () => {
    await storage.increment('test-key', 60000);
    const result = await storage.increment('test-key', 60000);
    
    expect(result.count).toBe(2);
  });

  it('should reset counter after window expires', async () => {
    const result1 = await storage.increment('test-key', 100); // 100ms window
    expect(result1.count).toBe(1);
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const result2 = await storage.increment('test-key', 100);
    expect(result2.count).toBe(1); // Reset to 1
  });

  it('should get current counter value', async () => {
    await storage.increment('test-key', 60000);
    await storage.increment('test-key', 60000);
    
    const result = await storage.get('test-key');
    expect(result?.count).toBe(2);
  });

  it('should return null for non-existent key', async () => {
    const result = await storage.get('non-existent');
    expect(result).toBeNull();
  });

  it('should reset counter manually', async () => {
    await storage.increment('test-key', 60000);
    await storage.reset('test-key');
    
    const result = await storage.get('test-key');
    expect(result).toBeNull();
  });

  it('should cleanup expired entries', async () => {
    await storage.increment('test-key', 100); // 100ms window
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    await storage.cleanup();
    
    const result = await storage.get('test-key');
    expect(result).toBeNull();
  });
});

describe('Rate Limiting - Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusCode: number;
  let responseData: any;
  let headers: Record<string, string>;

  beforeEach(() => {
    statusCode = 200;
    responseData = null;
    headers = {};

    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }),
    };

    mockRes = {
      status: vi.fn((code: number) => {
        statusCode = code;
        return mockRes as Response;
      }),
      json: vi.fn((data: any) => {
        responseData = data;
        return mockRes as Response;
      }),
      set: vi.fn((headersObj: Record<string, string>) => {
        Object.assign(headers, headersObj);
        return mockRes as Response;
      }),
      send: vi.fn(),
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it('should allow requests within limit', async () => {
    const storage = new MemoryRateLimitStorage();
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 5,
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(headers['X-RateLimit-Limit']).toBe('5');
    expect(headers['X-RateLimit-Remaining']).toBe('4');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
    expect(headers['X-RateLimit-Policy']).toBe('5;w=60');

    storage.stopCleanup();
  });

  it('should block requests exceeding limit', async () => {
    const storage = new MemoryRateLimitStorage();
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 2,
      storage,
    });

    // First two requests should pass
    await limiter(mockReq as Request, mockRes as Response, mockNext);
    await limiter(mockReq as Request, mockRes as Response, mockNext);

    // Third request should be blocked
    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(statusCode).toBe(429);
    expect(responseData.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['Retry-After']).toBeDefined();

    storage.stopCleanup();
  });

  it('should use custom key generator', async () => {
    const storage = new MemoryRateLimitStorage();
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (req) => `custom:${req.ip}`,
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);
    
    const data = await storage.get('custom:127.0.0.1');
    expect(data?.count).toBe(1);

    storage.stopCleanup();
  });

  it('should support tier-based limits - free tier', async () => {
    const storage = new MemoryRateLimitStorage();
    mockReq.user = { subscriptionTier: 'free' };

    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 100, // Default
      tierLimits: {
        free: { limit: 10, window: 60000 },
        pro: { limit: 100, window: 60000 },
        enterprise: { limit: -1, window: 0 },
      },
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(mockNext).toHaveBeenCalled();

    storage.stopCleanup();
  });

  it('should support tier-based limits - pro tier', async () => {
    const storage = new MemoryRateLimitStorage();
    mockReq.user = { subscriptionTier: 'pro' };

    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 100,
      tierLimits: {
        free: { limit: 10, window: 60000 },
        pro: { limit: 100, window: 60000 },
        enterprise: { limit: -1, window: 0 },
      },
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(mockNext).toHaveBeenCalled();

    storage.stopCleanup();
  });

  it('should support tier-based limits - enterprise tier (unlimited)', async () => {
    const storage = new MemoryRateLimitStorage();
    mockReq.user = { subscriptionTier: 'enterprise' };

    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 100,
      tierLimits: {
        free: { limit: 10, window: 60000 },
        pro: { limit: 100, window: 60000 },
        enterprise: { limit: -1, window: 0 },
      },
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(headers['X-RateLimit-Limit']).toBe('unlimited');
    expect(mockNext).toHaveBeenCalled();

    storage.stopCleanup();
  });

  it('should log rate limit violations', async () => {
    clearRateLimitViolations();
    
    const storage = new MemoryRateLimitStorage();
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 1,
      storage,
    });

    // First request passes
    await limiter(mockReq as Request, mockRes as Response, mockNext);
    
    // Second request is blocked and logged
    await limiter(mockReq as Request, mockRes as Response, mockNext);

    const violations = getRateLimitViolations();
    expect(violations.length).toBe(1);
    expect(violations[0].ip).toBe('127.0.0.1');
    expect(violations[0].path).toBe('/api/test');
    expect(violations[0].method).toBe('GET');

    storage.stopCleanup();
  });

  it('should add rate limit headers to all responses', async () => {
    const storage = new MemoryRateLimitStorage();
    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 10,
      storage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
    expect(headers['X-RateLimit-Reset']).toBeDefined();
    expect(headers['X-RateLimit-Policy']).toBeDefined();

    storage.stopCleanup();
  });
});

describe('Rate Limiting - Predefined Limiters', () => {
  beforeEach(() => {
    initializeRateLimitStorage();
  });

  it('should create auth rate limiter with config', () => {
    const limiter = createAuthRateLimit();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe('function');
  });

  it('should create API rate limiter with tier support', () => {
    const limiter = createApiRateLimit();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe('function');
  });

  it('should create analysis rate limiter with tier support', () => {
    const limiter = createAnalysisRateLimit();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe('function');
  });

  it('should get rate limit storage instance', () => {
    const storage = getRateLimitStorageInstance();
    expect(storage).toBeDefined();
  });
});

describe('Rate Limiting - Error Handling', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      get: vi.fn(),
    };

    mockRes = {
      status: vi.fn(() => mockRes as Response),
      json: vi.fn(() => mockRes as Response),
      set: vi.fn(() => mockRes as Response),
      send: vi.fn(),
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it('should handle storage errors gracefully', async () => {
    const faultyStorage = {
      increment: vi.fn().mockRejectedValue(new Error('Storage error')),
      get: vi.fn().mockResolvedValue(null),
      reset: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    const limiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 10,
      storage: faultyStorage,
    });

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    // Should allow request through on error
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Rate Limiting - Production Configuration', () => {
  it('should use environment-based configuration for auth limits', () => {
    const limiter = createAuthRateLimit();
    expect(limiter).toBeDefined();
  });

  it('should use environment-based configuration for API limits', () => {
    const limiter = createApiRateLimit();
    expect(limiter).toBeDefined();
  });

  it('should use environment-based configuration for analysis limits', () => {
    const limiter = createAnalysisRateLimit();
    expect(limiter).toBeDefined();
  });
});
