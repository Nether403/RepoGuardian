import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PerformanceRegressionDetector, PerformanceBaseline } from '../server/performance/PerformanceRegression';
import { CacheManager } from '../server/performance/CacheManager';
import { CompressionMiddleware } from '../server/performance/CompressionMiddleware';
import { ConnectionPool } from '../server/performance/ConnectionPool';

describe('Automated Performance Regression Detection', () => {
  let app: express.Application;
  let regressionDetector: PerformanceRegressionDetector;
  let cacheManager: CacheManager;
  let compressionMiddleware: CompressionMiddleware;
  let connectionPool: ConnectionPool;

  beforeEach(async () => {
    app = express();
    regressionDetector = new PerformanceRegressionDetector();
    
    // Initialize components
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

    // Setup middleware
    app.use(express.json());
    app.use(compressionMiddleware.middleware());
    
    // Performance test endpoints
    app.get('/api/perf/cache-test', async (req, res) => {
      const cacheKey = 'perf-test';
      let data = await cacheManager.get(cacheKey);
      
      if (!data) {
        await new Promise(resolve => setTimeout(resolve, 100));
        data = { result: 'computed', timestamp: Date.now() };
        await cacheManager.set(cacheKey, data, 60);
      }
      
      res.json(data);
    });

    app.get('/api/perf/db-test', async (req, res) => {
      const connection = await connectionPool.getConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      await connectionPool.releaseConnection(connection);
      res.json({ success: true });
    });

    app.get('/api/perf/compression-test', async (req, res) => {
      const data = {
        items: Array.from({ length: 500 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Test data '.repeat(20)
        }))
      };
      res.json(data);
    });

    // Set up performance baselines
    const baselines: PerformanceBaseline[] = [
      {
        name: 'cache-performance',
        responseTime: 50,
        throughput: 20,
        memoryUsage: 10 * 1024 * 1024,
        timestamp: new Date()
      },
      {
        name: 'database-performance',
        responseTime: 100,
        throughput: 15,
        memoryUsage: 15 * 1024 * 1024,
        timestamp: new Date()
      },
      {
        name: 'compression-performance',
        responseTime: 200,
        throughput: 10,
        memoryUsage: 20 * 1024 * 1024,
        timestamp: new Date()
      }
    ];

    baselines.forEach(baseline => {
      regressionDetector.setBaseline(baseline.name, baseline);
    });
  });

  afterEach(async () => {
    await connectionPool.close();
    await cacheManager.clear();
  });

  describe('Automated Performance Validation', () => {
    it('should validate cache performance meets targets', async () => {
      const iterations = 20;
      const startMemory = process.memoryUsage().heapUsed;
      
      // Measure cache performance
      const startTime = Date.now();
      let requestCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/perf/cache-test')
          .expect(200);
        requestCount++;
      }
      
      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / iterations;
      const throughput = (requestCount / totalTime) * 1000;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      // Check against baseline
      const results = regressionDetector.detectRegression('cache-performance', {
        responseTime: avgResponseTime,
        throughput,
        memoryUsage
      });

      const regressions = results.filter(r => r.isRegression);
      
      if (regressions.length > 0) {
        const report = regressionDetector.generateReport(results);
        console.log(report);
      }

      expect(regressions).toHaveLength(0);
      
      // Log performance metrics
      console.log(`Cache Performance - Response Time: ${avgResponseTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} RPS`);
    });

    it('should validate database performance meets targets', async () => {
      const iterations = 15;
      const startMemory = process.memoryUsage().heapUsed;
      
      // Measure database performance
      const startTime = Date.now();
      let requestCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/perf/db-test')
          .expect(200);
        requestCount++;
      }
      
      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / iterations;
      const throughput = (requestCount / totalTime) * 1000;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      // Check against baseline
      const results = regressionDetector.detectRegression('database-performance', {
        responseTime: avgResponseTime,
        throughput,
        memoryUsage
      });

      const regressions = results.filter(r => r.isRegression);
      
      if (regressions.length > 0) {
        const report = regressionDetector.generateReport(results);
        console.log(report);
      }

      expect(regressions).toHaveLength(0);
      
      console.log(`Database Performance - Response Time: ${avgResponseTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} RPS`);
    });

    it('should validate compression performance meets targets', async () => {
      const iterations = 10;
      const startMemory = process.memoryUsage().heapUsed;
      
      // Measure compression performance
      const startTime = Date.now();
      let requestCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/perf/compression-test')
          .set('Accept-Encoding', 'gzip')
          .expect(200);
        requestCount++;
      }
      
      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / iterations;
      const throughput = (requestCount / totalTime) * 1000;
      const memoryUsage = process.memoryUsage().heapUsed - startMemory;

      // Check against baseline
      const results = regressionDetector.detectRegression('compression-performance', {
        responseTime: avgResponseTime,
        throughput,
        memoryUsage
      });

      const regressions = results.filter(r => r.isRegression);
      
      if (regressions.length > 0) {
        const report = regressionDetector.generateReport(results);
        console.log(report);
      }

      expect(regressions).toHaveLength(0);
      
      console.log(`Compression Performance - Response Time: ${avgResponseTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} RPS`);
    });
  });

  describe('Performance Target Enforcement', () => {
    it('should enforce response time targets', async () => {
      const maxResponseTime = 500; // 500ms max
      
      const response = await request(app)
        .get('/api/perf/cache-test')
        .expect(200);
      
      // Response should be fast due to optimizations
      expect(response.duration).toBeLessThan(maxResponseTime);
    });

    it('should enforce throughput targets', async () => {
      const minThroughput = 5; // 5 RPS minimum
      const testDuration = 2000; // 2 seconds
      
      const startTime = Date.now();
      let requestCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        await request(app)
          .get('/api/perf/cache-test')
          .expect(200);
        requestCount++;
      }
      
      const actualDuration = Date.now() - startTime;
      const throughput = (requestCount / actualDuration) * 1000;
      
      expect(throughput).toBeGreaterThan(minThroughput);
    });

    it('should enforce memory usage targets', async () => {
      const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB max increase
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate load
      const requests = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/perf/compression-test')
          .expect(200)
      );
      
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
    });
  });

  describe('Continuous Performance Monitoring', () => {
    it('should track performance trends over time', async () => {
      const measurements: Array<{
        timestamp: Date;
        responseTime: number;
        throughput: number;
        memoryUsage: number;
      }> = [];

      // Take multiple measurements over time
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        await request(app)
          .get('/api/perf/cache-test')
          .expect(200);
        
        const responseTime = Date.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed - startMemory;
        
        measurements.push({
          timestamp: new Date(),
          responseTime,
          throughput: 1000 / responseTime, // Simplified throughput
          memoryUsage
        });
        
        // Wait between measurements
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze trend
      const responseTimes = measurements.map(m => m.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      // Performance should be consistent
      const variance = maxResponseTime - minResponseTime;
      const variancePercentage = (variance / avgResponseTime) * 100;
      
      expect(variancePercentage).toBeLessThan(50); // Less than 50% variance
      
      console.log(`Performance Trend - Avg: ${avgResponseTime.toFixed(2)}ms, Variance: ${variancePercentage.toFixed(1)}%`);
    });

    it('should detect performance anomalies', async () => {
      const normalMeasurements: number[] = [];
      
      // Take baseline measurements
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await request(app)
          .get('/api/perf/cache-test')
          .expect(200);
        normalMeasurements.push(Date.now() - startTime);
      }
      
      const avgNormal = normalMeasurements.reduce((a, b) => a + b, 0) / normalMeasurements.length;
      const stdDev = Math.sqrt(
        normalMeasurements.reduce((sum, time) => sum + Math.pow(time - avgNormal, 2), 0) / normalMeasurements.length
      );
      
      // Take a measurement that should be normal
      const startTime = Date.now();
      await request(app)
        .get('/api/perf/cache-test')
        .expect(200);
      const testMeasurement = Date.now() - startTime;
      
      // Check if measurement is within normal range (2 standard deviations)
      const isAnomaly = Math.abs(testMeasurement - avgNormal) > (2 * stdDev);
      
      expect(isAnomaly).toBe(false);
      
      console.log(`Anomaly Detection - Test: ${testMeasurement}ms, Normal Range: ${(avgNormal - 2*stdDev).toFixed(2)}-${(avgNormal + 2*stdDev).toFixed(2)}ms`);
    });
  });

  describe('Performance Improvement Validation', () => {
    it('should validate performance improvements are maintained', async () => {
      // Test that optimizations provide expected improvements
      const testCases = [
        {
          name: 'Cache vs No Cache',
          optimized: '/api/perf/cache-test',
          baseline: '/api/perf/cache-test?nocache=true',
          expectedImprovement: 0.5 // 50% faster
        }
      ];

      for (const testCase of testCases) {
        // Clear cache for fair comparison
        await cacheManager.clear();
        
        // Measure baseline (first request, no cache)
        const baselineStart = Date.now();
        await request(app)
          .get(testCase.baseline)
          .expect(200);
        const baselineTime = Date.now() - baselineStart;
        
        // Measure optimized (second request, with cache)
        const optimizedStart = Date.now();
        await request(app)
          .get(testCase.optimized)
          .expect(200);
        const optimizedTime = Date.now() - optimizedStart;
        
        const improvement = (baselineTime - optimizedTime) / baselineTime;
        
        expect(improvement).toBeGreaterThan(testCase.expectedImprovement);
        
        console.log(`${testCase.name} - Improvement: ${(improvement * 100).toFixed(1)}% (expected: ${(testCase.expectedImprovement * 100).toFixed(1)}%)`);
      }
    });
  });
});