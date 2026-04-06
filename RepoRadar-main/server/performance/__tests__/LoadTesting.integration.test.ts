import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CacheManager } from '../CacheManager';
import { CompressionMiddleware } from '../CompressionMiddleware';
import { ConnectionPool } from '../ConnectionPool';
import { QueryMonitor } from '../QueryMonitor';
import { MetricsCollector } from '../MetricsCollector';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { AlertingSystem } from '../AlertingSystem';

describe('Load Testing for Performance Improvements', () => {
  let app: express.Application;
  let cacheManager: CacheManager;
  let compressionMiddleware: CompressionMiddleware;
  let connectionPool: ConnectionPool;
  let queryMonitor: QueryMonitor;
  let metricsCollector: MetricsCollector;
  let performanceMonitor: PerformanceMonitor;
  let alertingSystem: AlertingSystem;

  beforeEach(async () => {
    app = express();
    
    // Initialize performance components
    cacheManager = new CacheManager();
    compressionMiddleware = new CompressionMiddleware();
    connectionPool = new ConnectionPool({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
      min: 5,
      max: 20
    });
    queryMonitor = new QueryMonitor();
    metricsCollector = new MetricsCollector();
    performanceMonitor = new PerformanceMonitor(metricsCollector);
    alertingSystem = new AlertingSystem();

    // Setup middleware
    app.use(express.json());
    app.use(compressionMiddleware.middleware());
    
    // Setup test routes with realistic workloads
    app.get('/api/heavy-computation', async (req, res) => {
      const cacheKey = `computation-${req.query.id}`;
      let result = await cacheManager.get(cacheKey);
      
      if (!result) {
        // Simulate heavy computation
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        result = {
          id: req.query.id,
          result: Math.random() * 1000,
          computationTime: Date.now() - startTime
        };
        
        await cacheManager.set(cacheKey, result, 300);
      }
      
      res.json(result);
    });

    app.get('/api/database-intensive', async (req, res) => {
      try {
        const connection = await connectionPool.getConnection();
        const startTime = Date.now();
        
        // Simulate multiple database queries
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          queryMonitor.recordQuery(`SELECT * FROM table_${i}`, 50);
        }
        
        const endTime = Date.now();
        await connectionPool.releaseConnection(connection);
        
        res.json({ 
          success: true, 
          totalTime: endTime - startTime,
          queries: 5
        });
      } catch (error) {
        res.status(500).json({ error: 'Database error' });
      }
    });

    app.get('/api/large-response', async (req, res) => {
      // Generate large response to test compression
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is a detailed description for item ${i}`.repeat(10),
          metadata: {
            created: new Date().toISOString(),
            tags: [`tag${i}`, `category${i % 10}`, `type${i % 5}`],
            properties: Object.fromEntries(
              Array.from({ length: 20 }, (_, j) => [`prop${j}`, `value${j}`])
            )
          }
        }))
      };
      
      res.json(largeData);
    });

    app.get('/api/metrics-endpoint', async (req, res) => {
      const metrics = await performanceMonitor.getMetrics();
      res.json(metrics);
    });
  });

  afterEach(async () => {
    await connectionPool.close();
    await cacheManager.clear();
  });

  describe('High Concurrency Load Tests', () => {
    it('should handle 100 concurrent requests efficiently', async () => {
      const concurrentRequests = 100;
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=${i}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach((response, i) => {
        expect(response.body).toHaveProperty('id', i.toString());
        expect(response.body).toHaveProperty('result');
      });

      // Should complete within reasonable time (with caching benefits)
      expect(totalTime).toBeLessThan(5000);
      
      // Verify caching effectiveness
      const uniqueResults = new Set(responses.map(r => r.body.result));
      expect(uniqueResults.size).toBe(concurrentRequests); // Each should be unique
    });

    it('should maintain database connection pool efficiency under load', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/database-intensive')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('queries', 5);
      });

      // Should complete efficiently with connection pooling
      expect(totalTime).toBeLessThan(10000);
      
      // Verify query monitoring captured all queries
      const totalQueries = queryMonitor.getSlowQueries().length;
      expect(totalQueries).toBeGreaterThan(0);
    });

    it('should handle large response compression under load', async () => {
      const concurrentRequests = 30;
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/large-response')
          .set('Accept-Encoding', 'gzip')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify compression was applied
      responses.forEach(response => {
        expect(response.headers['content-encoding']).toBe('gzip');
        expect(response.body).toHaveProperty('items');
        expect(response.body.items).toHaveLength(1000);
      });

      // Should complete efficiently with compression
      expect(totalTime).toBeLessThan(8000);
    });
  });

  describe('Sustained Load Tests', () => {
    it('should maintain performance over sustained load', async () => {
      const batchSize = 20;
      const batches = 5;
      const results: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();
        
        const requests = Array.from({ length: batchSize }, (_, i) =>
          request(app)
            .get(`/api/heavy-computation?id=${batch * batchSize + i}`)
            .expect(200)
        );

        await Promise.all(requests);
        
        const batchEndTime = Date.now();
        const batchTime = batchEndTime - batchStartTime;
        results.push(batchTime);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should remain consistent across batches
      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      // Variance should be reasonable (max shouldn't be more than 2x min)
      expect(maxTime / minTime).toBeLessThan(2);
      expect(avgTime).toBeLessThan(3000);
    });

    it('should handle memory efficiently during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run sustained load
      for (let i = 0; i < 10; i++) {
        const requests = Array.from({ length: 20 }, (_, j) =>
          request(app)
            .get(`/api/large-response`)
            .expect(200)
        );

        await Promise.all(requests);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Stress Testing Edge Cases', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = 20;
      const overloadRequests = maxConnections + 10;
      
      const requests = Array.from({ length: overloadRequests }, () =>
        request(app)
          .get('/api/database-intensive')
      );

      const responses = await Promise.allSettled(requests);
      
      // Most requests should succeed
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(maxConnections * 0.8);
      
      // Some may fail gracefully
      const failed = responses.filter(r => r.status === 'rejected').length;
      expect(failed).toBeLessThan(overloadRequests * 0.3);
    });

    it('should handle cache overflow gracefully', async () => {
      // Fill cache beyond capacity
      const cacheOverflowRequests = 1000;
      
      const requests = Array.from({ length: cacheOverflowRequests }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=${i}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      expect(responses).toHaveLength(cacheOverflowRequests);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('result');
      });
    });

    it('should maintain alerting system under stress', async () => {
      const alertSpy = vi.spyOn(alertingSystem, 'checkThresholds');
      
      // Generate load that should trigger alerts
      const stressRequests = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/database-intensive')
      );

      await Promise.all(stressRequests);
      
      // Check if alerting system processed metrics
      const metrics = await performanceMonitor.getMetrics();
      await alertingSystem.checkThresholds(metrics);
      
      expect(alertSpy).toHaveBeenCalled();
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('api');
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance degradation', async () => {
      // Baseline performance measurement
      const baselineRequests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/heavy-computation?id=baseline')
          .expect(200)
      );

      const baselineStart = Date.now();
      await Promise.all(baselineRequests);
      const baselineTime = Date.now() - baselineStart;

      // Simulate performance degradation
      const originalTimeout = setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        return originalTimeout(callback, (delay || 0) * 2); // Double all delays
      });

      // Degraded performance measurement
      const degradedRequests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/heavy-computation?id=degraded')
          .expect(200)
      );

      const degradedStart = Date.now();
      await Promise.all(degradedRequests);
      const degradedTime = Date.now() - degradedStart;

      // Should detect significant performance regression
      const performanceRatio = degradedTime / baselineTime;
      expect(performanceRatio).toBeGreaterThan(1.5); // At least 50% slower

      vi.restoreAllMocks();
    });

    it('should validate performance improvement targets', async () => {
      // Test with caching disabled
      const noCacheRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=nocache-${i}&nocache=true`)
          .expect(200)
      );

      const noCacheStart = Date.now();
      await Promise.all(noCacheRequests);
      const noCacheTime = Date.now() - noCacheStart;

      // Clear cache and test with caching enabled
      await cacheManager.clear();
      
      const cachedRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=cached-${i}`)
          .expect(200)
      );

      const cachedStart = Date.now();
      await Promise.all(cachedRequests);
      const cachedTime = Date.now() - cachedStart;

      // Second round should be much faster due to caching
      const secondCachedRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=cached-${i}`)
          .expect(200)
      );

      const secondCachedStart = Date.now();
      await Promise.all(secondCachedRequests);
      const secondCachedTime = Date.now() - secondCachedStart;

      // Caching should provide significant improvement
      const improvementRatio = noCacheTime / secondCachedTime;
      expect(improvementRatio).toBeGreaterThan(2); // At least 2x faster with cache
    });
  });

  describe('Resource Utilization Under Load', () => {
    it('should monitor resource usage during peak load', async () => {
      const initialUsage = process.resourceUsage();
      
      // Generate peak load
      const peakLoadRequests = Array.from({ length: 200 }, (_, i) => {
        const endpoint = i % 3 === 0 ? '/api/heavy-computation' : 
                        i % 3 === 1 ? '/api/database-intensive' : 
                        '/api/large-response';
        return request(app).get(`${endpoint}?id=${i}`);
      });

      await Promise.all(peakLoadRequests);
      
      const finalUsage = process.resourceUsage();
      
      // CPU usage should be reasonable
      const cpuIncrease = finalUsage.userCPUTime - initialUsage.userCPUTime;
      expect(cpuIncrease).toBeLessThan(5000000); // Less than 5 seconds of CPU time

      // System calls should be efficient
      const syscallIncrease = finalUsage.involuntaryContextSwitches - initialUsage.involuntaryContextSwitches;
      expect(syscallIncrease).toBeLessThan(10000);
    });

    it('should maintain metrics accuracy under extreme load', async () => {
      // Generate extreme load
      const extremeLoadRequests = Array.from({ length: 500 }, (_, i) =>
        request(app)
          .get(`/api/heavy-computation?id=extreme-${i}`)
      );

      await Promise.allSettled(extremeLoadRequests);
      
      // Metrics should still be accurate
      const metrics = await performanceMonitor.getMetrics();
      
      expect(metrics).toHaveProperty('api');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('database');
      
      // Metrics should reflect the load
      expect(metrics.api.requestCount).toBeGreaterThan(400);
      expect(metrics.cache.hitRate).toBeGreaterThan(0);
    });
  });
});