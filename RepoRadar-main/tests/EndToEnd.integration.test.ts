import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CacheManager } from '../server/performance/CacheManager';
import { CompressionMiddleware } from '../server/performance/CompressionMiddleware';
import { ConnectionPool } from '../server/performance/ConnectionPool';
import { MetricsCollector } from '../server/performance/MetricsCollector';
import { PerformanceMonitor } from '../server/performance/PerformanceMonitor';
import { AlertingSystem } from '../server/performance/AlertingSystem';

describe('End-to-End Performance Optimization Tests', () => {
  let app: express.Application;
  let cacheManager: CacheManager;
  let compressionMiddleware: CompressionMiddleware;
  let connectionPool: ConnectionPool;
  let metricsCollector: MetricsCollector;
  let performanceMonitor: PerformanceMonitor;
  let alertingSystem: AlertingSystem;

  beforeEach(async () => {
    app = express();
    
    // Initialize all components
    cacheManager = new CacheManager();
    compressionMiddleware = new CompressionMiddleware();
    connectionPool = new ConnectionPool({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
      min: 2,
      max: 10
    });
    metricsCollector = new MetricsCollector();
    performanceMonitor = new PerformanceMonitor(metricsCollector);
    alertingSystem = new AlertingSystem();

    // Setup complete application stack
    app.use(express.json());
    app.use(compressionMiddleware.middleware());
    
    // Complete workflow endpoints
    app.get('/api/complete-workflow', async (req, res) => {
      try {
        const startTime = Date.now();
        
        // Step 1: Check cache
        const cacheKey = `workflow-${req.query.id}`;
        const cachedResult = await cacheManager.get(cacheKey);
        
        if (cachedResult) {
          return res.json({
            ...cachedResult,
            cached: true,
            totalTime: Date.now() - startTime
          });
        }
        
        // Step 2: Database operations
        const connection = await connectionPool.getConnection();
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate DB query
        await connectionPool.releaseConnection(connection);
        
        // Step 3: Business logic
        const result = {
          id: req.query.id,
          data: `Processed data for ${req.query.id}`,
          timestamp: new Date().toISOString(),
          processingSteps: ['cache-miss', 'database-query', 'business-logic']
        };
        
        // Step 4: Cache result
        await cacheManager.set(cacheKey, result, 300);
        
        // Step 5: Record metrics
        const totalTime = Date.now() - startTime;
        metricsCollector.recordApiRequest('/api/complete-workflow', totalTime);
        
        res.json({
          ...result,
          cached: false,
          totalTime
        });
        
      } catch (error) {
        res.status(500).json({ error: 'Workflow failed' });
      }
    });

    app.get('/api/health', async (req, res) => {
      const metrics = await performanceMonitor.getMetrics();
      res.json({
        status: 'healthy',
        metrics,
        timestamp: new Date().toISOString()
      });
    });
  });

  afterEach(async () => {
    await connectionPool.close();
    await cacheManager.clear();
  });

  describe('Complete Application Workflow', () => {
    it('should execute full performance-optimized workflow', async () => {
      const workflowId = 'test-workflow-1';
      
      // First request - should hit database
      const response1 = await request(app)
        .get(`/api/complete-workflow?id=${workflowId}`)
        .expect(200);

      expect(response1.body).toHaveProperty('id', workflowId);
      expect(response1.body).toHaveProperty('cached', false);
      expect(response1.body).toHaveProperty('totalTime');
      expect(response1.body.processingSteps).toContain('database-query');

      // Second request - should hit cache
      const response2 = await request(app)
        .get(`/api/complete-workflow?id=${workflowId}`)
        .expect(200);

      expect(response2.body).toHaveProperty('cached', true);
      expect(response2.body.totalTime).toBeLessThan(response1.body.totalTime);
    });

    it('should maintain performance across multiple workflows', async () => {
      const workflowIds = ['wf-1', 'wf-2', 'wf-3', 'wf-4', 'wf-5'];
      
      // Execute multiple workflows concurrently
      const requests = workflowIds.map(id =>
        request(app)
          .get(`/api/complete-workflow?id=${id}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response, i) => {
        expect(response.body).toHaveProperty('id', workflowIds[i]);
        expect(response.body).toHaveProperty('totalTime');
      });

      // Verify health endpoint shows good metrics
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body).toHaveProperty('status', 'healthy');
      expect(healthResponse.body).toHaveProperty('metrics');
    });
  });

  describe('Performance Optimization Validation', () => {
    it('should demonstrate caching performance improvement', async () => {
      const testId = 'cache-test';
      
      // Measure uncached performance
      const uncachedStart = Date.now();
      await request(app)
        .get(`/api/complete-workflow?id=${testId}`)
        .expect(200);
      const uncachedTime = Date.now() - uncachedStart;

      // Measure cached performance
      const cachedStart = Date.now();
      const cachedResponse = await request(app)
        .get(`/api/complete-workflow?id=${testId}`)
        .expect(200);
      const cachedTime = Date.now() - cachedStart;

      expect(cachedResponse.body.cached).toBe(true);
      expect(cachedTime).toBeLessThan(uncachedTime * 0.5); // At least 50% faster
    });

    it('should validate compression effectiveness', async () => {
      const response = await request(app)
        .get('/api/complete-workflow?id=compression-test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.body).toHaveProperty('data');
    });

    it('should demonstrate connection pooling efficiency', async () => {
      const concurrentRequests = 15; // More than typical pool size
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get(`/api/complete-workflow?id=pool-test-${i}`)
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('id');
      });

      // Should complete efficiently with connection pooling
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('System Resilience Under Load', () => {
    it('should maintain stability under high load', async () => {
      const highLoadRequests = 100;
      
      const requests = Array.from({ length: highLoadRequests }, (_, i) =>
        request(app)
          .get(`/api/complete-workflow?id=load-${i}`)
      );

      const responses = await Promise.allSettled(requests);
      
      // Most requests should succeed
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(highLoadRequests * 0.9);

      // System should remain healthy
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    });

    it('should recover from component failures', async () => {
      // Simulate cache failure
      const originalGet = cacheManager.get;
      cacheManager.get = vi.fn().mockRejectedValue(new Error('Cache down'));

      const response = await request(app)
        .get('/api/complete-workflow?id=failure-test')
        .expect(200);

      // Should still work without cache
      expect(response.body).toHaveProperty('id', 'failure-test');
      expect(response.body).toHaveProperty('cached', false);

      // Restore cache
      cacheManager.get = originalGet;

      // Should work normally again
      const recoveryResponse = await request(app)
        .get('/api/complete-workflow?id=recovery-test')
        .expect(200);

      expect(recoveryResponse.body).toHaveProperty('id', 'recovery-test');
    });
  });

  describe('Metrics and Monitoring Integration', () => {
    it('should collect comprehensive metrics', async () => {
      // Generate some activity
      await Promise.all([
        request(app).get('/api/complete-workflow?id=metrics-1'),
        request(app).get('/api/complete-workflow?id=metrics-2'),
        request(app).get('/api/complete-workflow?id=metrics-3'),
      ]);

      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      const metrics = healthResponse.body.metrics;
      expect(metrics).toHaveProperty('api');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('cache');

      // Should have recorded API requests
      expect(metrics.api.requestCount).toBeGreaterThan(0);
    });

    it('should maintain monitoring accuracy under concurrent load', async () => {
      const concurrentRequests = 50;
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app).get(`/api/complete-workflow?id=concurrent-${i}`)
      );

      await Promise.all(requests);

      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      const metrics = healthResponse.body.metrics;
      
      // Metrics should reflect the load
      expect(metrics.api.requestCount).toBeGreaterThanOrEqual(concurrentRequests);
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('cache');
    });
  });

  describe('Performance Benchmarking', () => {
    it('should meet performance targets for response times', async () => {
      const benchmarkRequests = 20;
      const responseTimes: number[] = [];

      for (let i = 0; i < benchmarkRequests; i++) {
        const startTime = Date.now();
        await request(app)
          .get(`/api/complete-workflow?id=benchmark-${i}`)
          .expect(200);
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Performance targets
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
      expect(maxResponseTime).toBeLessThan(1000); // Max under 1s
    });

    it('should demonstrate throughput improvements', async () => {
      const throughputTestDuration = 5000; // 5 seconds
      const startTime = Date.now();
      let requestCount = 0;

      // Generate continuous load for duration
      while (Date.now() - startTime < throughputTestDuration) {
        const batchRequests = Array.from({ length: 10 }, (_, i) =>
          request(app)
            .get(`/api/complete-workflow?id=throughput-${requestCount + i}`)
        );

        await Promise.all(batchRequests);
        requestCount += 10;

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const actualDuration = Date.now() - startTime;
      const throughput = (requestCount / actualDuration) * 1000; // requests per second

      // Should achieve reasonable throughput
      expect(throughput).toBeGreaterThan(10); // At least 10 RPS
      expect(requestCount).toBeGreaterThan(100); // Processed significant load
    });
  });
});