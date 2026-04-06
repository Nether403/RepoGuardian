import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { healthCheck, readinessCheck, livenessCheck } from '../health';
import { db } from '../db';
import { redisManager } from '../redis';
import { jobQueue } from '../jobs/JobQueue';

// Mock dependencies
vi.mock('../db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('../redis', () => ({
  redisManager: {
    getHealthStatus: vi.fn(),
  },
}));

vi.mock('../jobs/JobQueue', () => ({
  jobQueue: {
    getStats: vi.fn(),
  },
}));

vi.mock('../stripe', () => ({
  isStripeEnabled: vi.fn(() => false),
}));

vi.mock('../gemini', () => ({
  isGeminiEnabled: vi.fn(() => true),
}));

describe('Health Check Endpoints', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {};
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are up', async () => {
      // Mock all services as healthy
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          checks: expect.objectContaining({
            database: expect.objectContaining({ status: 'up' }),
            cache: expect.objectContaining({ status: 'up' }),
            api: expect.objectContaining({ status: 'up' }),
            queue: expect.objectContaining({ status: 'up' }),
          }),
        })
      );
    });

    it('should return degraded status when some services are degraded', async () => {
      // Mock database as slow (degraded)
      vi.mocked(db.execute).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined as any), 150))
      );
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          checks: expect.objectContaining({
            database: expect.objectContaining({ 
              status: 'degraded',
              message: 'High database latency',
            }),
          }),
        })
      );
    });

    it('should return unhealthy status when database is down', async () => {
      // Mock database as down
      vi.mocked(db.execute).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          checks: expect.objectContaining({
            database: expect.objectContaining({ 
              status: 'down',
              message: 'Connection refused',
            }),
          }),
        })
      );
    });

    it('should return unhealthy status when Redis is down', async () => {
      // Mock Redis as down
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'down',
        responseTime: 0,
        message: 'Redis client not connected',
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          checks: expect.objectContaining({
            cache: expect.objectContaining({ 
              status: 'down',
              message: 'Redis client not connected',
            }),
          }),
        })
      );
    });

    it('should return degraded status when job queue has high depth', async () => {
      // Mock job queue with high depth
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 800,
        active: 150,
        completed: 1000,
        failed: 10,
        delayed: 100,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          checks: expect.objectContaining({
            queue: expect.objectContaining({ 
              status: 'degraded',
              message: expect.stringContaining('High queue depth'),
            }),
          }),
        })
      );
    });

    it('should return degraded status when job queue has high failure rate', async () => {
      // Mock job queue with high failure rate
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 20, // 20% failure rate
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          checks: expect.objectContaining({
            queue: expect.objectContaining({ 
              status: 'degraded',
              message: expect.stringContaining('High failure rate'),
            }),
          }),
        })
      );
    });

    it('should complete within 2 seconds', async () => {
      // Mock all services as healthy
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      const startTime = Date.now();
      await healthCheck(mockReq as Request, mockRes as Response);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should handle timeout gracefully', async () => {
      // Mock database with long delay (> 2 seconds)
      vi.mocked(db.execute).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined as any), 3000))
      );
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
        })
      );
    });

    it('should include uptime in response', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          uptime: expect.any(Number),
        })
      );
    });

    it('should include timestamp in response', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });
      vi.mocked(jobQueue.getStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
      });

      await healthCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('readinessCheck', () => {
    it('should return ready when database and cache are up', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });

      await readinessCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          checks: expect.objectContaining({
            database: expect.objectContaining({ status: 'up' }),
            cache: expect.objectContaining({ status: 'up' }),
          }),
        })
      );
    });

    it('should return not ready when database is down', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });

      await readinessCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          checks: expect.objectContaining({
            database: expect.objectContaining({ status: 'down' }),
          }),
        })
      );
    });

    it('should return not ready when cache is down', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'down',
        responseTime: 0,
        message: 'Redis client not connected',
      });

      await readinessCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          checks: expect.objectContaining({
            cache: expect.objectContaining({ status: 'down' }),
          }),
        })
      );
    });

    it('should complete within 2 seconds', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });

      const startTime = Date.now();
      await readinessCheck(mockReq as Request, mockRes as Response);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should handle timeout gracefully', async () => {
      // Mock database with long delay (> 2 seconds)
      vi.mocked(db.execute).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined as any), 3000))
      );
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });

      await readinessCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
        })
      );
    });

    it('should include timestamp in response', async () => {
      vi.mocked(db.execute).mockResolvedValue(undefined as any);
      vi.mocked(redisManager.getHealthStatus).mockResolvedValue({
        status: 'up',
        responseTime: 50,
      });

      await readinessCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('livenessCheck', () => {
    it('should always return alive status', async () => {
      await livenessCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
        })
      );
    });

    it('should include uptime in response', async () => {
      await livenessCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          uptime: expect.any(Number),
        })
      );
    });

    it('should include memory usage in response', async () => {
      await livenessCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryUsage: expect.objectContaining({
            heapUsed: expect.any(Number),
            heapTotal: expect.any(Number),
            external: expect.any(Number),
            rss: expect.any(Number),
          }),
        })
      );
    });

    it('should include timestamp in response', async () => {
      await livenessCheck(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it('should be very fast (< 100ms)', async () => {
      const startTime = Date.now();
      await livenessCheck(mockReq as Request, mockRes as Response);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
