import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  correlationIdMiddleware,
  requestLoggingMiddleware,
  responseLoggingMiddleware,
  errorLoggingMiddleware,
  loggingMiddleware,
} from '../logging';
import { logger } from '../../monitoring/Logger';
import { metricsService } from '../../monitoring/MetricsService';

describe('Logging Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      query: {},
      headers: {},
      ip: '127.0.0.1',
    };

    mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200,
      statusMessage: 'OK',
    };

    mockNext = vi.fn();

    metricsService.clear();
    vi.clearAllMocks();
  });

  describe('correlationIdMiddleware', () => {
    it('should generate correlation ID if not provided', () => {
      correlationIdMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        expect.any(String)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing correlation ID from header', () => {
      const correlationId = 'existing-correlation-id';
      mockReq.headers = { 'x-correlation-id': correlationId };

      correlationIdMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        correlationId
      );
    });

    it('should use request ID as correlation ID', () => {
      const requestId = 'existing-request-id';
      mockReq.headers = { 'x-request-id': requestId };

      correlationIdMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        requestId
      );
    });

    it('should store correlation ID in request', () => {
      correlationIdMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).correlationId).toBeDefined();
    });
  });

  describe('requestLoggingMiddleware', () => {
    it('should log incoming request', () => {
      const logSpy = vi.spyOn(logger, 'info');

      requestLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should record start time', () => {
      requestLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).startTime).toBeDefined();
      expect(typeof (mockReq as any).startTime).toBe('number');
    });
  });

  describe('responseLoggingMiddleware', () => {
    it('should log outgoing response', () => {
      const logSpy = vi.spyOn(logger, 'info');
      (mockReq as any).startTime = Date.now();

      responseLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Trigger response end
      (mockRes.end as any)();

      expect(logSpy).toHaveBeenCalledWith(
        'Outgoing response',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
          duration: expect.any(Number),
        })
      );
    });

    it('should record response time metric', () => {
      (mockReq as any).startTime = Date.now();

      responseLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Trigger response end
      (mockRes.end as any)();

      const metrics = metricsService.getResponseTimeMetrics();
      expect(metrics.count).toBe(1);
    });

    it('should record error metric for 4xx status codes', () => {
      (mockReq as any).startTime = Date.now();
      mockRes.statusCode = 404;
      mockRes.statusMessage = 'Not Found';

      responseLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Trigger response end
      (mockRes.end as any)();

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalErrors).toBe(1);
    });

    it('should record error metric for 5xx status codes', () => {
      (mockReq as any).startTime = Date.now();
      mockRes.statusCode = 500;
      mockRes.statusMessage = 'Internal Server Error';

      responseLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Trigger response end
      (mockRes.end as any)();

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalErrors).toBe(1);
    });

    it('should not record error metric for 2xx status codes', () => {
      (mockReq as any).startTime = Date.now();
      mockRes.statusCode = 200;

      responseLoggingMiddleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Trigger response end
      (mockRes.end as any)();

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalErrors).toBe(0);
    });
  });

  describe('errorLoggingMiddleware', () => {
    it('should log error with context', () => {
      const logSpy = vi.spyOn(logger, 'error');
      const error = new Error('Test error');

      errorLoggingMiddleware(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Request error',
        error,
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should record error metric', () => {
      const error = new Error('Test error');

      errorLoggingMiddleware(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalErrors).toBe(1);
    });

    it('should use error code if available', () => {
      const error = new Error('Test error') as any;
      error.code = 'CUSTOM_ERROR';

      errorLoggingMiddleware(
        error,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.errorsByCode['CUSTOM_ERROR']).toBe(1);
    });
  });

  describe('loggingMiddleware', () => {
    it('should return array of middleware functions', () => {
      const middleware = loggingMiddleware();

      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware.length).toBe(3);
      expect(middleware[0]).toBe(correlationIdMiddleware);
      expect(middleware[1]).toBe(requestLoggingMiddleware);
      expect(middleware[2]).toBe(responseLoggingMiddleware);
    });
  });

  describe('Integration', () => {
    it('should work with all middleware in sequence', () => {
      const middleware = loggingMiddleware();
      const logSpy = vi.spyOn(logger, 'info');

      // Apply all middleware
      middleware.forEach(mw => {
        mw(mockReq as Request, mockRes as Response, mockNext);
      });

      expect((mockReq as any).correlationId).toBeDefined();
      expect((mockReq as any).startTime).toBeDefined();
      expect(logSpy).toHaveBeenCalled();
    });

    it('should track correlation ID through request lifecycle', () => {
      const middleware = loggingMiddleware();
      const correlationId = 'test-correlation-id';
      mockReq.headers = { 'x-correlation-id': correlationId };

      // Apply correlation middleware
      middleware[0](mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).correlationId).toBe(correlationId);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Correlation-Id',
        correlationId
      );
    });
  });
});
