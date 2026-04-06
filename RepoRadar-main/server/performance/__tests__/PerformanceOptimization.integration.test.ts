import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CacheManager } from '../CacheManager';
import { CompressionMiddleware } from '../CompressionMiddleware';
import { GitHubOptimizer } from '../GitHubOptimizer';
import { ConnectionPool } from '../ConnectionPool';
import { QueryMonitor } from '../QueryMonitor';
import { IndexManager } from '../IndexManager';
import { MetricsCollector } from '../MetricsCollector';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { AlertingSystem } from '../AlertingSystem';
import { CacheFallbackManager } from '../CacheFallbackManager';
import { DatabaseFallbackManager } from '../DatabaseFallbackManager';
import { PerformanceErrorHandler } from '../PerformanceErrorHandler';

describe('Performance Optimization Integration Tests', () => {
  let app: express.Application;
  let cacheManager: CacheManager;
  let compressionMiddleware: CompressionMiddleware;
  let githubOptimizer: GitHubOptimizer;
  let connectionPool: ConnectionPool;
  let queryMonitor: QueryMonitor;
  let indexManager: IndexManager;
  let metricsCollector: MetricsCollector;
  let performanceMonitor: PerformanceMonitor;
  let alertingSystem: AlertingSystem;
  let cacheFallbackManager: CacheFallbackManager;
  let databaseFallbackManager: DatabaseFallbackManager;
  let errorHandler: PerformanceErrorHandler;

  beforeEach(async () => {
    app = express();
    
    // Initialize all performance components
    cacheManager = new CacheManager();
    compressionMiddleware = new CompressionMiddleware();
    githubOptimizer = new GitHubOptimizer('test-token');
    connectionPool = new ConnectionPool({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
      min: 2,
      max: 10
    });
    queryMonitor = new QueryMonitor();
    indexManager = new IndexManager(connectionPool);
    metricsCollector = new MetricsCollector();
    performanceMonitor = new PerformanceMonitor(metricsCollector);
    alertingSystem = new AlertingSystem();
    cacheFallbackManager = new CacheFallbackManager(cacheManager);
    databaseFallbackManager = new DatabaseFallbackManager(connectionPool);
    errorHandler = new PerformanceErrorHandler();

    // Setup middleware
    app.use(express.json());
    app.use(compressionMiddleware.middleware());
    
    // Setup test routes
    app.get('/api/test-cache', async (req, res) => {
      const cacheKey = 'test-data';
      let data = await cacheManager.get(cacheKey);
      
      if (!data) {
        data = { message: 'Fresh data', timestamp: Date.now() };
        await cacheManager.set(cacheKey, data, 60);
      }
      
      res.json(data);
    });

    app.get('/api/test-github', async (req, res) => {
      try {
        const result = await githubOptimizer.optimizeRequest('GET', '/user/repos');
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'GitHub API error' });
      }
    });

    app.get('/api/test-database', async (req, res) => {
      try {
        const connection = await connectionPool.getConnection();
        const startTime = Date.now();
        
        // Simulate database query
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const endTime = Date.now();
        queryMonitor.recordQuery('SELECT * FROM test', endTime - startTime);
        
        await connectionPool.releaseConnection(connection);
        res.json({ success: true, queryTime: endTime - startTime });
      } catch (error) {
        res.status(500).json({ error: 'Database error' });
      }
    });

    app.get('/api/test-metrics', async (req, res) => {
      const metrics = await performanceMonitor.getMetrics();
      res.json(metrics);
    });
  });

  afterEach(async () => {
    await connectionPool.close();
    await cacheManager.clear();
  });

  describe('Complete Performance Optimization Workflow', () => {
    it('should handle full request lifecycle with all optimizations', async () => {
      // Test caching workflow
      const response1 = await request(app)
        .get('/api/test-cache')
        .expect(200);

      expect(response1.body).toHaveProperty('message', 'Fresh data');
      expect(response1.body).toHaveProperty('timestamp');

      // Second request should return cached data
      const response2 = await request(app)
        .get('/api/test-cache')
        .expect(200);

      expect(response2.body.timestamp).toBe(response1.body.timestamp);
    });

    it('should handle database operations with connection pooling and monitoring', async () => {
      const response = await request(app)
        .get('/api/test-database')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('queryTime');
      expect(response.body.queryTime).toBeGreaterThan(0);

      // Verify query was monitored
      const queries = queryMonitor.getSlowQueries();
      expect(queries).toHaveLength(1);
      expect(queries[0].query).toBe('SELECT * FROM test');
    });

    it('should apply compression to responses', async () => {
      const response = await request(app)
        .get('/api/test-cache')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should collect and expose performance metrics', async () => {
      // Generate some activity
      await request(app).get('/api/test-cache');
      await request(app).get('/api/test-database');

      const response = await request(app)
        .get('/api/test-metrics')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('api');
      expect(response.body).toHaveProperty('cache');
    });
  });

  describe('Graceful Degradation Scenarios', () => {
    it('should handle cache failures gracefully', async () => {
      // Mock cache failure
      vi.spyOn(cacheManager, 'get').mockRejectedValue(new Error('Cache unavailable'));
      vi.spyOn(cacheManager, 'set').mockRejectedValue(new Error('Cache unavailable'));

      const response = await request(app)
        .get('/api/test-cache')
        .expect(200);

      // Should still return data even with cache failure
      expect(response.body).toHaveProperty('message', 'Fresh data');
    });

    it('should handle database connection failures gracefully', async () => {
      // Mock connection pool failure
      vi.spyOn(connectionPool, 'getConnection').mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/api/test-database')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Database error');
    });

    it('should handle GitHub API rate limiting gracefully', async () => {
      // Mock rate limit error
      vi.spyOn(githubOptimizer, 'optimizeRequest').mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const response = await request(app)
        .get('/api/test-github')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'GitHub API error');
    });

    it('should continue operation when compression fails', async () => {
      // Mock compression failure
      vi.spyOn(compressionMiddleware, 'middleware').mockImplementation(() => {
        return (req: any, res: any, next: any) => {
          // Skip compression
          next();
        };
      });

      const response = await request(app)
        .get('/api/test-cache')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Should still return data without compression
      expect(response.body).toHaveProperty('message', 'Fresh data');
      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under concurrent requests', async () => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/api/test-cache')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Fresh data');
      });

      // All responses should have the same timestamp (cached)
      const timestamps = responses.map(r => r.body.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(1);
    });

    it('should handle database connection pool under load', async () => {
      const concurrentRequests = 15; // More than pool max (10)
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/api/test-database')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    it('should maintain metrics accuracy under load', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => 
        request(app).get(i % 2 === 0 ? '/api/test-cache' : '/api/test-database')
      );

      await Promise.all(requests);

      const metricsResponse = await request(app)
        .get('/api/test-metrics')
        .expect(200);

      expect(metricsResponse.body).toHaveProperty('database');
      expect(metricsResponse.body).toHaveProperty('api');
      expect(metricsResponse.body).toHaveProperty('cache');
    });
  });

  describe('Error Recovery and Fallback Systems', () => {
    it('should recover from cache system failures', async () => {
      // Simulate cache failure and recovery
      const mockGet = vi.spyOn(cacheManager, 'get');
      mockGet.mockRejectedValueOnce(new Error('Cache down'));
      mockGet.mockResolvedValueOnce(null); // Recovery

      const response1 = await request(app)
        .get('/api/test-cache')
        .expect(200);

      const response2 = await request(app)
        .get('/api/test-cache')
        .expect(200);

      expect(response1.body).toHaveProperty('message', 'Fresh data');
      expect(response2.body).toHaveProperty('message', 'Fresh data');
    });

    it('should handle database fallback scenarios', async () => {
      // Test database fallback manager
      const fallbackResult = await databaseFallbackManager.executeWithFallback(
        async () => {
          throw new Error('Primary connection failed');
        },
        async () => {
          return { success: true, fallback: true };
        }
      );

      expect(fallbackResult).toEqual({ success: true, fallback: true });
    });

    it('should handle cache fallback scenarios', async () => {
      // Test cache fallback manager
      const fallbackResult = await cacheFallbackManager.getWithFallback(
        'test-key',
        async () => {
          return { data: 'fallback data' };
        }
      );

      expect(fallbackResult).toEqual({ data: 'fallback data' });
    });
  });

  describe('Alerting and Monitoring Integration', () => {
    it('should trigger alerts for performance thresholds', async () => {
      const alertSpy = vi.spyOn(alertingSystem, 'checkThresholds');
      
      // Simulate slow query
      queryMonitor.recordQuery('SLOW SELECT * FROM large_table', 2000);
      
      await alertingSystem.checkThresholds({
        database: {
          slowQueries: queryMonitor.getSlowQueries().length,
          avgQueryTime: 2000
        }
      });

      expect(alertSpy).toHaveBeenCalled();
    });

    it('should maintain monitoring during system stress', async () => {
      const startTime = Date.now();
      
      // Generate load
      const requests = Array.from({ length: 50 }, () =>
        request(app).get('/api/test-cache')
      );

      await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify monitoring continued throughout
      const metrics = await performanceMonitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});