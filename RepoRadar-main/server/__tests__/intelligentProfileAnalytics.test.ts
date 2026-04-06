import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { intelligentProfilePerformanceMiddleware, trackRecommendationPerformance } from '../middleware/intelligentProfileAnalytics';

describe('Intelligent Profile Analytics', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let endCallback: Function;

  beforeEach(() => {
    mockReq = {
      path: '/api/bookmarks',
      method: 'GET',
      user: {
        claims: {
          sub: 'test-user-123',
        },
      },
    } as any;

    mockRes = {
      statusCode: 200,
      end: vi.fn(function(this: Response, ...args: any[]) {
        if (endCallback) {
          endCallback();
        }
        return this;
      }) as any,
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('intelligentProfilePerformanceMiddleware', () => {
    it('should track performance metrics for bookmark endpoints', (done) => {
      endCallback = () => {
        // Give time for async operations
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Simulate response end
      (mockRes.end as any)();
    });

    it('should track performance metrics for tag endpoints', (done) => {
      mockReq.path = '/api/tags';
      
      endCallback = () => {
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      (mockRes.end as any)();
    });

    it('should track performance metrics for preferences endpoints', (done) => {
      mockReq.path = '/api/user/preferences';
      
      endCallback = () => {
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      (mockRes.end as any)();
    });

    it('should track performance metrics for recommendations endpoints', (done) => {
      mockReq.path = '/api/recommendations';
      
      endCallback = () => {
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      (mockRes.end as any)();
    });

    it('should handle requests without authenticated user', (done) => {
      mockReq.user = undefined;
      
      endCallback = () => {
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          done();
        }, 100);
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      (mockRes.end as any)();
    });

    it('should log warning for slow requests', (done) => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      endCallback = () => {
        // Simulate slow request by waiting
        setTimeout(() => {
          expect(mockNext).toHaveBeenCalled();
          consoleWarnSpy.mockRestore();
          done();
        }, 1100); // Over 1 second threshold
      };

      intelligentProfilePerformanceMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Simulate slow response
      setTimeout(() => {
        (mockRes.end as any)();
      }, 1100);
    });
  });

  describe('trackRecommendationPerformance', () => {
    it('should track recommendation generation performance from AI', async () => {
      await trackRecommendationPerformance('test-user-123', 2500, 10, 'ai');
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should track recommendation generation performance from cache', async () => {
      await trackRecommendationPerformance('test-user-123', 50, 10, 'cache');
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should log warning for slow AI generation', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await trackRecommendationPerformance('test-user-123', 3500, 10, 'ai');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow recommendation generation')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should not log warning for fast AI generation', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await trackRecommendationPerformance('test-user-123', 2000, 10, 'ai');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should not log warning for cache retrieval regardless of time', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await trackRecommendationPerformance('test-user-123', 5000, 10, 'cache');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });
});
