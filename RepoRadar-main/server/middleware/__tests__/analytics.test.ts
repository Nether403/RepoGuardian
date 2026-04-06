import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { analyticsMiddleware, trackEvent } from '../analytics';
import { analyticsService } from '../../analytics';

// Mock the analytics service
vi.mock('../../analytics', () => ({
  analyticsService: {
    trackEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Analytics Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      cookies: {},
    };

    mockRes = {
      statusCode: 200,
      end: vi.fn(function(this: Response, ...args: any[]) {
        return this;
      }) as any,
    };

    mockNext = vi.fn();
  });

  it('should track API request event', async () => {
    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Call the mocked end function
    mockRes.end!();

    // Wait for async tracking
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'api_request',
        category: 'api',
        properties: expect.objectContaining({
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
        }),
      })
    );
  });

  it('should track API error event for 4xx status codes', async () => {
    mockRes.statusCode = 404;

    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'api_error',
        category: 'error',
        properties: expect.objectContaining({
          statusCode: 404,
        }),
      })
    );
  });

  it('should track API error event for 5xx status codes', async () => {
    mockRes.statusCode = 500;

    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'api_error',
        category: 'error',
      })
    );
  });

  it('should use session ID from cookie', async () => {
    mockReq.cookies = { sessionId: 'test-session-123' };

    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'test-session-123',
      })
    );
  });

  it('should use session ID from header', async () => {
    mockReq.headers = { 'x-session-id': 'header-session-456' };

    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'header-session-456',
      })
    );
  });

  it('should extract user ID from authenticated request', async () => {
    const authReq = {
      ...mockReq,
      user: {
        claims: {
          sub: 'user-123',
        },
      },
    };

    analyticsMiddleware(authReq as Request, mockRes as Response, mockNext);
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
      })
    );
  });

  it('should call next middleware', () => {
    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not throw if analytics tracking fails', async () => {
    vi.mocked(analyticsService.trackEvent).mockRejectedValueOnce(new Error('Tracking failed'));

    analyticsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
    
    mockRes.end!();

    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Should not throw - middleware should continue
  });
});

describe('trackEvent helper', () => {
  let mockReq: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      headers: { 'x-session-id': 'test-session' },
      cookies: {},
    };
  });

  it('should track custom event', async () => {
    await trackEvent(
      mockReq as Request,
      'test_event',
      'test_category',
      { key: 'value' }
    );

    expect(analyticsService.trackEvent).toHaveBeenCalledWith({
      name: 'test_event',
      category: 'test_category',
      properties: { key: 'value' },
      sessionId: 'test-session',
      userId: undefined,
    });
  });

  it('should include user ID if authenticated', async () => {
    const authReq = {
      ...mockReq,
      user: {
        claims: {
          sub: 'user-456',
        },
      },
    };

    await trackEvent(
      authReq as Request,
      'test_event',
      'test_category'
    );

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-456',
      })
    );
  });
});
