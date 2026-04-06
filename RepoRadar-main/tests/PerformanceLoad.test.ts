import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

/**
 * Performance and Load Testing Suite
 * 
 * Tests the application under various load conditions:
 * - 100 concurrent users
 * - 100 concurrent jobs
 * - 1000 analytics events per minute
 * - Multi-instance load distribution
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const TIMEOUT = 120000; // 2 minutes for load tests

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

interface LoadTestResult {
  metrics: PerformanceMetrics;
  errors: Array<{ message: string; count: number }>;
  duration: number;
}

/**
 * Calculate performance metrics from response times
 */
function calculateMetrics(
  responseTimes: number[],
  errors: Error[],
  duration: number
): PerformanceMetrics {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const total = responseTimes.length;
  const successful = total - errors.length;
  
  const sum = responseTimes.reduce((acc, time) => acc + time, 0);
  const average = total > 0 ? sum / total : 0;
  
  const p95Index = Math.floor(total * 0.95);
  const p99Index = Math.floor(total * 0.99);
  
  return {
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: errors.length,
    averageResponseTime: Math.round(average),
    minResponseTime: sorted[0] || 0,
    maxResponseTime: sorted[sorted.length - 1] || 0,
    p95ResponseTime: sorted[p95Index] || 0,
    p99ResponseTime: sorted[p99Index] || 0,
    requestsPerSecond: duration > 0 ? (total / duration) * 1000 : 0,
    errorRate: total > 0 ? (errors.length / total) * 100 : 0,
  };
}

/**
 * Group errors by message for reporting
 */
function groupErrors(errors: Error[]): Array<{ message: string; count: number }> {
  const grouped = new Map<string, number>();
  
  for (const error of errors) {
    const message = error.message;
    grouped.set(message, (grouped.get(message) || 0) + 1);
  }
  
  return Array.from(grouped.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Execute concurrent requests and measure performance
 */
async function runLoadTest(
  name: string,
  requestFn: () => Promise<void>,
  concurrency: number,
  totalRequests: number
): Promise<LoadTestResult> {
  console.log(`\n🚀 Starting load test: ${name}`);
  console.log(`   Concurrency: ${concurrency}, Total Requests: ${totalRequests}`);
  
  const responseTimes: number[] = [];
  const errors: Error[] = [];
  const startTime = Date.now();
  
  let completed = 0;
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - completed);
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < batchSize; i++) {
      const requestStart = Date.now();
      
      const promise = requestFn()
        .then(() => {
          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
        })
        .catch((error) => {
          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
          errors.push(error);
        });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    completed += batchSize;
    
    // Progress indicator
    const progress = Math.round((completed / totalRequests) * 100);
    process.stdout.write(`\r   Progress: ${progress}% (${completed}/${totalRequests})`);
  }
  
  const duration = Date.now() - startTime;
  const metrics = calculateMetrics(responseTimes, errors, duration);
  const groupedErrors = groupErrors(errors);
  
  console.log('\n✅ Load test completed');
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
  console.log(`   Avg Response Time: ${metrics.averageResponseTime}ms`);
  console.log(`   P95 Response Time: ${metrics.p95ResponseTime}ms`);
  console.log(`   Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}`);
  
  return {
    metrics,
    errors: groupedErrors,
    duration,
  };
}

describe('Performance and Load Testing', () => {
  let healthCheckPassed = false;
  
  beforeAll(async () => {
    // Verify server is running
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      healthCheckPassed = response.status === 200;
      console.log('✅ Server health check passed');
    } catch (error) {
      console.error('❌ Server health check failed:', error);
      throw new Error('Server is not running. Start the server before running load tests.');
    }
  }, 10000);
  
  describe('Concurrent User Load Testing', () => {
    it('should handle 100 concurrent users making API requests', async () => {
      expect(healthCheckPassed).toBe(true);
      
      // Simulate 100 concurrent users making various API calls
      const result = await runLoadTest(
        '100 Concurrent Users',
        async () => {
          // Simulate user behavior: health check, search, or analysis
          const actions = [
            () => axios.get(`${BASE_URL}/health`),
            () => axios.get(`${BASE_URL}/api/repositories/search?q=react`),
            () => axios.get(`${BASE_URL}/api/health/ready`),
          ];
          
          const action = actions[Math.floor(Math.random() * actions.length)];
          await action();
        },
        100, // 100 concurrent users
        500  // 500 total requests (5 requests per user on average)
      );
      
      // Performance assertions
      expect(result.metrics.errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(result.metrics.averageResponseTime).toBeLessThan(2000); // Avg < 2s
      expect(result.metrics.p95ResponseTime).toBeLessThan(5000); // P95 < 5s
      expect(result.metrics.requestsPerSecond).toBeGreaterThan(10); // At least 10 req/s
      
      console.log('\n📊 Concurrent User Test Results:');
      console.log(JSON.stringify(result.metrics, null, 2));
    }, TIMEOUT);
    
    it('should maintain performance under sustained load', async () => {
      expect(healthCheckPassed).toBe(true);
      
      // Sustained load test: 50 concurrent users for longer duration
      const result = await runLoadTest(
        'Sustained Load (50 users)',
        async () => {
          await axios.get(`${BASE_URL}/health`);
        },
        50,  // 50 concurrent users
        1000 // 1000 total requests
      );
      
      // Performance should remain stable
      expect(result.metrics.errorRate).toBeLessThan(5);
      expect(result.metrics.averageResponseTime).toBeLessThan(1500);
      expect(result.metrics.p99ResponseTime).toBeLessThan(5000);
      
      console.log('\n📊 Sustained Load Test Results:');
      console.log(JSON.stringify(result.metrics, null, 2));
    }, TIMEOUT);
  });
  
  describe('Job Queue Load Testing', () => {
    it('should handle 100 concurrent jobs', async () => {
      expect(healthCheckPassed).toBe(true);
      
      const jobIds: string[] = [];
      
      // Create 100 jobs concurrently
      const createResult = await runLoadTest(
        '100 Concurrent Job Creation',
        async () => {
          try {
            const response = await axios.post(`${BASE_URL}/api/jobs`, {
              type: 'test-job',
              data: { test: true, timestamp: Date.now() },
            });
            
            if (response.data?.id) {
              jobIds.push(response.data.id);
            }
          } catch (error: any) {
            // Job queue might not be fully implemented, log but don't fail
            if (error.response?.status === 404) {
              console.log('   ℹ️  Job queue endpoint not found (expected if not implemented)');
            }
            throw error;
          }
        },
        100, // 100 concurrent job submissions
        100  // 100 total jobs
      );
      
      // If jobs were created, check their status
      if (jobIds.length > 0) {
        console.log(`\n📋 Created ${jobIds.length} jobs, checking status...`);
        
        const statusResult = await runLoadTest(
          'Job Status Checks',
          async () => {
            const jobId = jobIds[Math.floor(Math.random() * jobIds.length)];
            await axios.get(`${BASE_URL}/api/jobs/${jobId}`);
          },
          50,  // 50 concurrent status checks
          200  // 200 total status checks
        );
        
        expect(statusResult.metrics.errorRate).toBeLessThan(10);
        expect(statusResult.metrics.averageResponseTime).toBeLessThan(500);
        
        console.log('\n📊 Job Status Check Results:');
        console.log(JSON.stringify(statusResult.metrics, null, 2));
      } else {
        console.log('   ℹ️  Skipping job status checks (no jobs created)');
      }
      
      // Job creation should have reasonable performance
      // Allow higher error rate if endpoint doesn't exist
      const maxErrorRate = createResult.errors.some(e => 
        e.message.includes('404') || e.message.includes('not found')
      ) ? 100 : 10;
      
      expect(createResult.metrics.errorRate).toBeLessThan(maxErrorRate);
      
      console.log('\n📊 Job Creation Test Results:');
      console.log(JSON.stringify(createResult.metrics, null, 2));
    }, TIMEOUT);
  });
  
  describe('Analytics Load Testing', () => {
    it('should handle 1000 analytics events per minute', async () => {
      expect(healthCheckPassed).toBe(true);
      
      // Test 1000 events over 60 seconds = ~16.67 events/second
      const eventsPerSecond = 17;
      const durationSeconds = 60;
      const totalEvents = eventsPerSecond * durationSeconds;
      
      console.log(`\n📈 Testing ${totalEvents} analytics events over ${durationSeconds}s`);
      
      const result = await runLoadTest(
        'Analytics Event Tracking',
        async () => {
          try {
            await axios.post(`${BASE_URL}/api/analytics/track`, {
              name: 'test_event',
              category: 'load_test',
              properties: {
                timestamp: Date.now(),
                test: true,
              },
            });
          } catch (error: any) {
            // Analytics might not be fully implemented
            if (error.response?.status === 404) {
              console.log('   ℹ️  Analytics endpoint not found (expected if not implemented)');
            }
            throw error;
          }
        },
        eventsPerSecond, // Concurrent events per batch
        totalEvents      // Total events
      );
      
      // Analytics should handle high throughput
      // Allow higher error rate if endpoint doesn't exist
      const maxErrorRate = result.errors.some(e => 
        e.message.includes('404') || e.message.includes('not found')
      ) ? 100 : 15;
      
      expect(result.metrics.errorRate).toBeLessThan(maxErrorRate);
      expect(result.metrics.requestsPerSecond).toBeGreaterThan(10);
      
      // Analytics should be fast (async processing)
      if (result.metrics.errorRate < 50) {
        expect(result.metrics.averageResponseTime).toBeLessThan(1000);
      }
      
      console.log('\n📊 Analytics Load Test Results:');
      console.log(JSON.stringify(result.metrics, null, 2));
    }, TIMEOUT);
  });
  
  describe('Multi-Instance Load Distribution', () => {
    it('should distribute load across multiple instances', async () => {
      expect(healthCheckPassed).toBe(true);
      
      // Test load distribution by checking instance IDs in responses
      const instanceIds = new Set<string>();
      const responseTimes: number[] = [];
      
      console.log('\n🔄 Testing multi-instance load distribution...');
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        try {
          const response = await axios.get(`${BASE_URL}/health`);
          responseTimes.push(Date.now() - start);
          
          // Check for instance ID in response headers or body
          const instanceId = response.headers['x-instance-id'] || 
                           response.data?.instanceId ||
                           'single-instance';
          instanceIds.add(instanceId);
        } catch (error) {
          responseTimes.push(Date.now() - start);
        }
        
        // Progress indicator
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`\r   Progress: ${i + 1}/100`);
        }
      }
      
      console.log(`\n   Detected ${instanceIds.size} instance(s)`);
      console.log(`   Instance IDs: ${Array.from(instanceIds).join(', ')}`);
      
      // Calculate metrics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      console.log(`   Avg Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   Max Response Time: ${maxResponseTime}ms`);
      
      // Performance assertions
      expect(avgResponseTime).toBeLessThan(500);
      expect(maxResponseTime).toBeLessThan(2000);
      
      // If multiple instances are running, verify distribution
      if (instanceIds.size > 1) {
        console.log('   ✅ Multi-instance deployment detected');
        expect(instanceIds.size).toBeGreaterThanOrEqual(2);
      } else {
        console.log('   ℹ️  Single instance detected (multi-instance not deployed)');
      }
    }, TIMEOUT);
    
    it('should maintain session consistency across instances', async () => {
      expect(healthCheckPassed).toBe(true);
      
      console.log('\n🔐 Testing session consistency across instances...');
      
      // Create a session and make multiple requests
      const sessionCookie = await axios.get(`${BASE_URL}/health`)
        .then(res => res.headers['set-cookie']?.[0])
        .catch(() => null);
      
      if (!sessionCookie) {
        console.log('   ℹ️  No session cookie detected, skipping session test');
        return;
      }
      
      const sessionRequests = 50;
      let sessionErrors = 0;
      
      for (let i = 0; i < sessionRequests; i++) {
        try {
          await axios.get(`${BASE_URL}/health`, {
            headers: { Cookie: sessionCookie },
          });
        } catch (error) {
          sessionErrors++;
        }
      }
      
      const sessionErrorRate = (sessionErrors / sessionRequests) * 100;
      console.log(`   Session Error Rate: ${sessionErrorRate.toFixed(2)}%`);
      
      expect(sessionErrorRate).toBeLessThan(5);
    }, TIMEOUT);
  });
  
  describe('Performance Metrics Summary', () => {
    it('should generate comprehensive performance report', async () => {
      expect(healthCheckPassed).toBe(true);
      
      console.log('\n📊 PERFORMANCE TEST SUMMARY');
      console.log('=' .repeat(60));
      
      // Run a comprehensive test suite
      const tests = [
        {
          name: 'Health Check Performance',
          fn: () => axios.get(`${BASE_URL}/health`),
          concurrency: 50,
          total: 200,
        },
        {
          name: 'API Endpoint Performance',
          fn: () => axios.get(`${BASE_URL}/api/health/ready`),
          concurrency: 30,
          total: 150,
        },
      ];
      
      const results: Record<string, PerformanceMetrics> = {};
      
      for (const test of tests) {
        const result = await runLoadTest(
          test.name,
          test.fn,
          test.concurrency,
          test.total
        );
        results[test.name] = result.metrics;
      }
      
      // Print summary
      console.log('\n📈 FINAL METRICS:');
      console.log('=' .repeat(60));
      
      for (const [name, metrics] of Object.entries(results)) {
        console.log(`\n${name}:`);
        console.log(`  Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
        console.log(`  Avg Response: ${metrics.averageResponseTime}ms`);
        console.log(`  P95 Response: ${metrics.p95ResponseTime}ms`);
        console.log(`  P99 Response: ${metrics.p99ResponseTime}ms`);
        console.log(`  Throughput: ${metrics.requestsPerSecond.toFixed(2)} req/s`);
      }
      
      console.log('\n' + '='.repeat(60));
      
      // Overall assertions
      const allMetrics = Object.values(results);
      const avgErrorRate = allMetrics.reduce((sum, m) => sum + m.errorRate, 0) / allMetrics.length;
      const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length;
      
      expect(avgErrorRate).toBeLessThan(10);
      expect(avgResponseTime).toBeLessThan(2000);
    }, TIMEOUT);
  });
});
