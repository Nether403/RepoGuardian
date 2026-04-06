import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { createRateLimit } from '../middleware/rateLimiter';
import { MemoryRateLimitStorage } from '../middleware/rateLimitStorage';

describe('Rate Limiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: ReturnType<typeof vi.fn>;
  let storage: MemoryRateLimitStorage;

  beforeEach(() => {
    storage = new MemoryRateLimitStorage();
    
    mockReq = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }),
    };

    const headers: Record<string, string> = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn((headerObj: Record<string, string>) => {
        Object.assign(headers, headerObj);
        return mockRes;
      }),
      send: vi.fn(),
    };

    nextFn = vi.fn();
  });

  it('should allow requests within limit', async () => {
    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 5,
      storage,
    });

    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
  });

  it('should block requests exceeding limit', async () => {
    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 2,
      storage,
    });

    // First two requests should pass
    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);
    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);

    // Third request should be blocked
    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'RATE_LIMIT_EXCEEDED',
      })
    );
  });

  it('should set rate limit headers', async () => {
    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 5,
      storage,
    });

    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': expect.any(String),
        'X-RateLimit-Reset': expect.any(String),
      })
    );
  });

  it('should use custom key generator', async () => {
    const customKeyGen = vi.fn(() => 'custom-key');
    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 5,
      keyGenerator: customKeyGen,
      storage,
    });

    await rateLimiter(mockReq as Request, mockRes as Response, nextFn);

    expect(customKeyGen).toHaveBeenCalledWith(mockReq);
  });

  it('should support tier-based limits', async () => {
    const mockReqWithUser = {
      ...mockReq,
      user: { subscriptionTier: 'pro' },
    };

    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 10,
      tierLimits: {
        free: { limit: 10, window: 60000 },
        pro: { limit: 100, window: 60000 },
        enterprise: { limit: -1, window: 0 },
      },
      storage,
    });

    await rateLimiter(mockReqWithUser as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'X-RateLimit-Limit': '100', // Pro tier limit
      })
    );
  });

  it('should allow unlimited access for enterprise tier', async () => {
    const mockReqWithUser = {
      ...mockReq,
      user: { subscriptionTier: 'enterprise' },
    };

    const rateLimiter = createRateLimit({
      windowMs: 60000,
      maxRequests: 10,
      tierLimits: {
        free: { limit: 10, window: 60000 },
        pro: { limit: 100, window: 60000 },
        enterprise: { limit: -1, window: 0 },
      },
      storage,
    });

    // Should allow any number of requests
    for (let i = 0; i < 20; i++) {
      await rateLimiter(mockReqWithUser as Request, mockRes as Response, nextFn);
    }

    expect(nextFn).toHaveBeenCalledTimes(20);
    expect(mockRes.status).not.toHaveBeenCalledWith(429);
  });
});

describe('MemoryRateLimitStorage', () => {
  let storage: MemoryRateLimitStorage;

  beforeEach(() => {
    storage = new MemoryRateLimitStorage();
  });

  it('should increment counter', async () => {
    const result1 = await storage.increment('test-key', 60000);
    expect(result1.count).toBe(1);

    const result2 = await storage.increment('test-key', 60000);
    expect(result2.count).toBe(2);
  });

  it('should reset counter after window expires', async () => {
    const result1 = await storage.increment('test-key', 100); // 100ms window
    expect(result1.count).toBe(1);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const result2 = await storage.increment('test-key', 100);
    expect(result2.count).toBe(1); // Should reset
  });

  it('should get existing counter', async () => {
    await storage.increment('test-key', 60000);
    const result = await storage.get('test-key');

    expect(result).not.toBeNull();
    expect(result?.count).toBe(1);
  });

  it('should return null for non-existent key', async () => {
    const result = await storage.get('non-existent');
    expect(result).toBeNull();
  });

  it('should reset counter', async () => {
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
