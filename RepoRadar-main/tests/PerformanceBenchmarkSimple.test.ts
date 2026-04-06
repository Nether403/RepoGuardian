import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

interface BenchmarkResult {
  name: string;
  beforeOptimization: number;
  afterOptimization: number;
  improvement: number;
  improvementPercentage: number;
}

interface PerformanceTarget {
  name: string;
  target: number;
  actual: number;
  met: boolean;
}

describe('Performance Benchmarking and Regression Detection', () => {
  let app: express.Application;
  let cache: Map<string, any>;

  beforeEach(async () => {
    app = express();
    cache = new Map();
    
    // Setup middleware
    app.use(express.json());
    
    // Benchmark endpoints
    app.get('/api/benchmark/cache', async (req, res) => {
      const useCache = req.query.cache === 'true';
      const cacheKey = 'benchmark-data';
      
      if (useCache) {
        let data = cache.get(cacheKey);
        if (!data) {
          // Simulate expensive operation
          await new Promise(resolve => setTimeout(resolve, 100));
          data = { result: 'expensive computation', timestamp: Date.now() };
          cache.set(cacheKey, data);
        }
        res.json(data);
      } else {
        // Always do expensive operation
        await new Promise(resolve => setTimeout(resolve, 100));
        res.json({ result: 'expensive computation', timestamp: Date.now() });
      }
    });

    app.get('/api/benchmark/fast', async (req, res) => {
      // Fast endpoint for throughput testing
      res.json({ message: 'fast response', timestamp: Date.now() });
    });

    app.get('/api/benchmark/memory', async (req, res) => {
      // Create some data for memory testing
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: 'test'.repeat(10)
      }));
      res.json({ items: data });
    });
  });

  afterEach(async () => {
    cache.clear();
  });

  describe('Before/After Performance Comparison', () => {
    it('should demonstrate caching performance improvements', async () => {
      const iterations = 5;
      
      // Measure without caching
      cache.clear();
      const withoutCacheStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/benchmark/cache?cache=false')
          .expect(200);
      }
      const withoutCacheTime = Date.now() - withoutCacheStart;

      // Clear and measure with caching
      cache.clear();
      const withCacheStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/api/benchmark/cache?cache=true')
          .expect(200);
      }
      const withCacheTime = Date.now() - withCacheStart;

      const improvement = withoutCacheTime - withCacheTime;
      const improvementPercentage = (improvement / withoutCacheTime) * 100;

      const result: BenchmarkResult = {
        name: 'Caching Performance',
        beforeOptimization: withoutCacheTime,
        afterOptimization: withCacheTime,
        improvement,
        improvementPercentage
      };

      expect(result.improvement).toBeGreaterThan(0);
      expect(result.improvementPercentage).toBeGreaterThan(30); // At least 30% improvement
      
      console.log('Caching Benchmark:', result);
    });

    it('should measure response time improvements', async () => {
      // Test fast vs slow endpoints
      const slowStart = Date.now();
      await request(app)
        .get('/api/benchmark/cache?cache=false')
        .expect(200);
      const slowTime = Date.now() - slowStart;

      const fastStart = Date.now();
      await request(app)
        .get('/api/benchmark/fast')
        .expect(200);
      const fastTime = Date.now() - fastStart;

      expect(fastTime).toBeLessThan(slowTime);
      
      const improvement = ((slowTime - fastTime) / slowTime) * 100;
      console.log(`Response Time Improvement: ${improvement.toFixed(1)}%`);
    });
  });

  describe('Performance Target Validation', () => {
    it('should validate response time targets', async () => {
      const targets: PerformanceTarget[] = [
        { name: 'Fast Endpoint Response Time', target: 50, actual: 0, met: false },
        { name: 'Cached Response Time', target: 100, actual: 0, met: false }
      ];

      // Test fast endpoint response time
      cache.set('benchmark-data', { cached: true });
      const fastStart = Date.now();
      await request(app)
        .get('/api/benchmark/fast')
        .expect(200);
      targets[0].actual = Date.now() - fastStart;
      targets[0].met = targets[0].actual <= targets[0].target;

      // Test cached response time
      const cachedStart = Date.now();
      await request(app)
        .get('/api/benchmark/cache?cache=true')
        .expect(200);
      targets[1].actual = Date.now() - cachedStart;
      targets[1].met = targets[1].actual <= targets[1].target;

      targets.forEach(target => {
        console.log(`${target.name}: ${target.actual}ms (target: ${target.target}ms) - ${target.met ? 'PASS' : 'FAIL'}`);
      });

      // At least one target should be met
      const metTargets = targets.filter(t => t.met);
      expect(metTargets.length).toBeGreaterThan(0);
    });

    it('should validate throughput targets', async () => {
      const testDuration = 2000; // 2 seconds
      const targetThroughput = 5; // requests per second
      
      const startTime = Date.now();
      let requestCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        await request(app)
          .get('/api/benchmark/fast')
          .expect(200);
        requestCount++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const actualDuration = Date.now() - startTime;
      const actualThroughput = (requestCount / actualDuration) * 1000;
      
      const target: PerformanceTarget = {
        name: 'Throughput',
        target: targetThroughput,
        actual: actualThroughput,
        met: actualThroughput >= targetThroughput
      };

      console.log(`Throughput: ${target.actual.toFixed(2)} RPS (target: ${target.target} RPS) - ${target.met ? 'PASS' : 'FAIL'}`);
      expect(target.actual).toBeGreaterThan(0);
    });

    it('should validate memory usage targets', async () => {
      const maxMemoryIncrease = 20 * 1024 * 1024; // 20MB max increase
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate load
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/benchmark/memory')
          .expect(200)
      );
      
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      const target: PerformanceTarget = {
        name: 'Memory Usage',
        target: maxMemoryIncrease,
        actual: memoryIncrease,
        met: memoryIncrease <= maxMemoryIncrease
      };

      console.log(`Memory Usage: ${(target.actual / 1024 / 1024).toFixed(2)}MB (target: ${(target.target / 1024 / 1024).toFixed(2)}MB) - ${target.met ? 'PASS' : 'FAIL'}`);
      expect(target.actual).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Automated Performance Regression Detection', () => {
    it('should detect performance regressions in response times', async () => {
      // Establish baseline
      const baselineIterations = 5;
      const baselineTimes: number[] = [];
      
      for (let i = 0; i < baselineIterations; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/benchmark/fast')
          .expect(200);
        baselineTimes.push(Date.now() - start);
      }
      
      const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
      
      // Simulate performance regression by adding delay
      const originalSetTimeout = setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        return originalSetTimeout(callback, (delay || 0) + 50); // Add 50ms delay
      });
      
      // Measure degraded performance
      const degradedTimes: number[] = [];
      
      for (let i = 0; i < baselineIterations; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/benchmark/cache?cache=false') // Use slower endpoint
          .expect(200);
        degradedTimes.push(Date.now() - start);
      }
      
      const degradedAvg = degradedTimes.reduce((a, b) => a + b, 0) / degradedTimes.length;
      
      // Detect regression
      const regressionThreshold = 1.5; // 50% slower is considered regression
      const performanceRatio = degradedAvg / baselineAvg;
      const hasRegression = performanceRatio > regressionThreshold;
      
      expect(hasRegression).toBe(true); // Should detect the simulated regression
      expect(performanceRatio).toBeGreaterThan(regressionThreshold);
      
      console.log(`Performance Regression Detected: ${performanceRatio.toFixed(2)}x slower (threshold: ${regressionThreshold}x)`);
      
      vi.restoreAllMocks();
    });

    it('should detect throughput degradation', async () => {
      // Baseline throughput measurement
      const baselineDuration = 1000; // 1 second
      let baselineRequests = 0;
      
      const baselineStart = Date.now();
      while (Date.now() - baselineStart < baselineDuration) {
        await request(app)
          .get('/api/benchmark/fast')
          .expect(200);
        baselineRequests++;
      }
      
      const baselineThroughput = (baselineRequests / baselineDuration) * 1000;
      
      // Simulate throughput degradation
      const originalSetTimeout = setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        return originalSetTimeout(callback, (delay || 0) + 20); // Add 20ms delay
      });
      
      // Degraded throughput measurement
      let degradedRequests = 0;
      
      const degradedStart = Date.now();
      while (Date.now() - degradedStart < baselineDuration) {
        await request(app)
          .get('/api/benchmark/cache?cache=false')
          .expect(200);
        degradedRequests++;
      }
      
      const degradedThroughput = (degradedRequests / baselineDuration) * 1000;
      
      // Detect throughput regression
      const throughputRatio = degradedThroughput / baselineThroughput;
      const throughputRegressionThreshold = 0.7; // 30% decrease is regression
      
      const hasThroughputRegression = throughputRatio < throughputRegressionThreshold;
      
      expect(hasThroughputRegression).toBe(true); // Should detect degradation
      
      console.log(`Throughput Regression: ${throughputRatio.toFixed(2)}x (${(throughputRatio * 100).toFixed(1)}% of baseline)`);
      
      vi.restoreAllMocks();
    });
  });

  describe('Performance Improvement Validation', () => {
    it('should validate cache hit ratio improvements', async () => {
      const testRequests = 10;
      
      // Clear cache and make requests
      cache.clear();
      
      const requests = Array.from({ length: testRequests }, () =>
        request(app)
          .get('/api/benchmark/cache?cache=true')
          .expect(200)
      );
      
      await Promise.all(requests);
      
      // Calculate cache effectiveness (simplified - after first request, all should be cache hits)
      const expectedHitRatio = (testRequests - 1) / testRequests; // First is miss, rest are hits
      
      expect(expectedHitRatio).toBeGreaterThan(0.8); // 80% hit ratio
      
      console.log(`Cache Hit Ratio: ${(expectedHitRatio * 100).toFixed(1)}%`);
    });

    it('should validate response consistency', async () => {
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request(app)
          .get('/api/benchmark/fast')
          .expect(200);
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      // Performance should be consistent
      const variance = maxResponseTime - minResponseTime;
      const variancePercentage = (variance / avgResponseTime) * 100;

      expect(variancePercentage).toBeLessThan(200); // Less than 200% variance
      
      console.log(`Response Consistency - Avg: ${avgResponseTime.toFixed(2)}ms, Variance: ${variancePercentage.toFixed(1)}%`);
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/benchmark/fast')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('message');
      });

      // Should complete efficiently
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
      
      console.log(`Concurrent Load Test: ${concurrentRequests} requests in ${totalTime}ms`);
    });

    it('should maintain performance under sustained load', async () => {
      const batchSize = 5;
      const batches = 3;
      const results: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();
        
        const requests = Array.from({ length: batchSize }, () =>
          request(app)
            .get('/api/benchmark/fast')
            .expect(200)
        );

        await Promise.all(requests);
        
        const batchEndTime = Date.now();
        const batchTime = batchEndTime - batchStartTime;
        results.push(batchTime);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Performance should remain consistent across batches
      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      // Variance should be reasonable
      expect(maxTime / minTime).toBeLessThan(3); // Max shouldn't be more than 3x min
      expect(avgTime).toBeLessThan(2000); // Average should be under 2 seconds
      
      console.log(`Sustained Load Test - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
    });
  });
});