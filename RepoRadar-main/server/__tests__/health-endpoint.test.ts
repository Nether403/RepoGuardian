import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { healthCheck, readinessCheck, livenessCheck } from '../health';

describe('Health Check Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.get('/health', healthCheck);
    app.get('/ready', readinessCheck);
    app.get('/live', livenessCheck);
  });

  describe('GET /health', () => {
    it('should return health status with all required checks', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThanOrEqual(503);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('checks');
      
      // Verify all required checks are present
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('cpu');
    });

    it('should include database connectivity check with latency', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks.database).toHaveProperty('status');
      expect(response.body.checks.database).toHaveProperty('latency');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.checks.database.status
      );
    });

    it('should include Redis connectivity check (non-blocking)', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks.redis).toHaveProperty('status');
      expect(response.body.checks.redis).toHaveProperty('latency');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.checks.redis.status
      );
    });

    it('should include memory usage metrics', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks.memory).toHaveProperty('status');
      expect(response.body.checks.memory).toHaveProperty('usage');
      expect(typeof response.body.checks.memory.usage).toBe('number');
      expect(response.body.checks.memory.usage).toBeGreaterThanOrEqual(0);
      expect(response.body.checks.memory.usage).toBeLessThanOrEqual(100);
    });

    it('should include CPU usage metrics', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks.cpu).toHaveProperty('status');
      expect(response.body.checks.cpu).toHaveProperty('usage');
      expect(typeof response.body.checks.cpu.usage).toBe('number');
      expect(response.body.checks.cpu.usage).toBeGreaterThanOrEqual(0);
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

    it('should have uptime as a number', async () => {
      const response = await request(app).get('/health');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should have timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/ready');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(['ready', 'not ready']).toContain(response.body.status);
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
    });
  });

  describe('GET /live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('alive');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memoryUsage');
    });
  });
});
