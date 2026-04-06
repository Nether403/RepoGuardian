import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Mock dependencies before importing health
vi.mock('../db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../redis', () => ({
  redisManager: {
    getHealthStatus: vi.fn().mockResolvedValue({
      status: 'up',
      responseTime: 50,
    }),
  },
}));

vi.mock('../jobs/JobQueue', () => ({
  jobQueue: {
    getStats: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 1,
      delayed: 0,
    }),
  },
}));

vi.mock('../stripe', () => ({
  isStripeEnabled: vi.fn(() => false),
}));

vi.mock('../gemini', () => ({
  isGeminiEnabled: vi.fn(() => true),
}));

import { healthCheck, readinessCheck, livenessCheck } from '../health';

describe('Health Check Endpoints Integration', () => {
  let app: Express;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Register health check routes
    app.get('/health', healthCheck);
    app.get('/health/ready', readinessCheck);
    app.get('/health/live', livenessCheck);
  });

  describe('GET /health', () => {
    it('should return health status with all checks', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('uptime');

      // Verify all required checks are present
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('api');
      expect(response.body.checks).toHaveProperty('queue');

      // Verify check structure
      expect(response.body.checks.database).toHaveProperty('status');
      expect(response.body.checks.database).toHaveProperty('responseTime');
    });

    it('should return status in valid format', async () => {
      const response = await request(app).get('/health');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should return numeric uptime', async () => {
      const response = await request(app).get('/health');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should complete within 2 seconds', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should return 200 for healthy or degraded status', async () => {
      const response = await request(app).get('/health');

      if (response.body.status === 'healthy' || response.body.status === 'degraded') {
        expect(response.status).toBe(200);
      }
    });

    it('should return 503 for unhealthy status', async () => {
      const response = await request(app).get('/health');

      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });

    it('should include response time for each check', async () => {
      const response = await request(app).get('/health');

      Object.values(response.body.checks).forEach((check: any) => {
        expect(check).toHaveProperty('responseTime');
        expect(typeof check.responseTime).toBe('number');
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');

      // Verify essential checks are present
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
    });

    it('should return status in valid format', async () => {
      const response = await request(app).get('/health/ready');

      expect(['ready', 'not ready']).toContain(response.body.status);
    });

    it('should return 200 when ready', async () => {
      const response = await request(app).get('/health/ready');

      if (response.body.status === 'ready') {
        expect(response.status).toBe(200);
      }
    });

    it('should return 503 when not ready', async () => {
      const response = await request(app).get('/health/ready');

      if (response.body.status === 'not ready') {
        expect(response.status).toBe(503);
      }
    });

    it('should complete within 2 seconds', async () => {
      const startTime = Date.now();
      await request(app).get('/health/ready');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app).get('/health/ready');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /health/live', () => {
    it('should always return alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memoryUsage');
    });

    it('should return memory usage details', async () => {
      const response = await request(app).get('/health/live');

      expect(response.body.memoryUsage).toHaveProperty('heapUsed');
      expect(response.body.memoryUsage).toHaveProperty('heapTotal');
      expect(response.body.memoryUsage).toHaveProperty('external');
      expect(response.body.memoryUsage).toHaveProperty('rss');

      // All memory values should be positive numbers
      Object.values(response.body.memoryUsage).forEach((value: any) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should return numeric uptime', async () => {
      const response = await request(app).get('/health/live');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should return timestamp in ISO format', async () => {
      const response = await request(app).get('/health/live');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should be very fast (< 100ms)', async () => {
      const startTime = Date.now();
      await request(app).get('/health/live');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should never fail', async () => {
      // Make multiple requests to ensure it's always available
      const requests = Array(5).fill(null).map(() => 
        request(app).get('/health/live').expect(200)
      );

      await Promise.all(requests);
    });
  });

  describe('Kubernetes Compatibility', () => {
    it('should be compatible with Kubernetes liveness probes', async () => {
      // Kubernetes expects a simple 200 OK response
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
    });

    it('should be compatible with Kubernetes readiness probes', async () => {
      // Kubernetes expects 200 for ready, 503 for not ready
      const response = await request(app).get('/health/ready');

      expect([200, 503]).toContain(response.status);
      expect(['ready', 'not ready']).toContain(response.body.status);
    });

    it('should support health check endpoint for general monitoring', async () => {
      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });
  });

  describe('Performance Requirements', () => {
    it('should handle concurrent health check requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should handle concurrent readiness check requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health/ready')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should handle concurrent liveness check requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health/live')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('alive');
      });
    });
  });
});

// Custom matcher for vitest
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
