import request from 'supertest';
import express from 'express';
import { createMetricsAPI } from '../MetricsAPI.js';
import { PerformanceMonitor } from '../PerformanceMonitor.js';
import { MetricsCollector } from '../MetricsCollector.js';
import { InMemoryMetricsStorage } from '../InMemoryMetricsStorage.js';
import { PerformanceMetrics } from '../interfaces.js';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { afterEach } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

describe('MetricsAPI Integration Tests', () => {
  let app: express.Application;
  let monitor: PerformanceMonitor;
  let collector: MetricsCollector;

  beforeEach(async () => {
    // Create test performance monitor
    monitor = new PerformanceMonitor({
      maxMetrics: 1000,
      retentionHours: 1,
      bufferSize: 10,
      flushIntervalMs: 100
    });

    collector = monitor.getDefaultCollector() as MetricsCollector;

    // Create Express app with metrics API
    app = express();
    app.use(express.json());
    app.use('/api/performance', createMetricsAPI(monitor));

    // Start monitoring
    await monitor.start();

    // Add some test metrics
    await addTestMetrics();
  });

  afterEach(async () => {
    await monitor.stop();
  });

  async function addTestMetrics(): Promise<void> {
    const now = new Date();
    const testMetrics: PerformanceMetrics[] = [
      {
        timestamp: new Date(now.getTime() - 60000),
        category: 'database',
        metric: 'executionTime',
        value: 150,
        threshold: 1000,
        metadata: { queryId: 'test-query-1' }
      },
      {
        timestamp: new Date(now.getTime() - 30000),
        category: 'database',
        metric: 'executionTime',
        value: 200,
        threshold: 1000,
        metadata: { queryId: 'test-query-2' }
      },
      {
        timestamp: new Date(now.getTime() - 45000),
        category: 'api',
        metric: 'responseTime',
        value: 300,
        threshold: 2000,
        metadata: { endpoint: '/api/test' }
      },
      {
        timestamp: new Date(now.getTime() - 15000),
        category: 'frontend',
        metric: 'loadTime',
        value: 1200,
        threshold: 3000,
        metadata: { bundleName: 'main' }
      }
    ];

    await collector.collectBatch(testMetrics);
    await collector.flush();
  }

  describe('GET /api/performance/metrics', () => {
    it('should retrieve all metrics with default pagination', async () => {
      const response = await request(app)
        .get('/api/performance/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.metrics).toBeInstanceOf(Array);
      expect(response.body.metrics.length).toBeGreaterThan(0);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit', 100);
      expect(response.body.pagination).toHaveProperty('offset', 0);
    });

    it('should filter metrics by category', async () => {
      const response = await request(app)
        .get('/api/performance/metrics?category=database')
        .expect(200);

      expect(response.body.metrics).toBeInstanceOf(Array);
      response.body.metrics.forEach((metric: any) => {
        expect(metric.category).toBe('database');
      });
    });

    it('should filter metrics by metric name', async () => {
      const response = await request(app)
        .get('/api/performance/metrics?metric=executionTime')
        .expect(200);

      expect(response.body.metrics).toBeInstanceOf(Array);
      // Check that we have at least one metric with the correct name
      const executionTimeMetrics = response.body.metrics.filter((metric: any) => metric.metric === 'executionTime');
      expect(executionTimeMetrics.length).toBeGreaterThan(0);
      
      // If we have metrics, they should all be executionTime metrics
      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          expect(metric.metric).toBe('executionTime');
        });
      }
    });

    it('should apply pagination correctly', async () => {
      const response = await request(app)
        .get('/api/performance/metrics?limit=2&offset=1')
        .expect(200);

      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
      expect(response.body.metrics.length).toBeLessThanOrEqual(2);
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      const response = await request(app)
        .get(`/api/performance/metrics?startTime=${oneMinuteAgo.toISOString()}`)
        .expect(200);

      expect(response.body.metrics).toBeInstanceOf(Array);
      response.body.metrics.forEach((metric: any) => {
        expect(new Date(metric.timestamp).getTime()).toBeGreaterThanOrEqual(oneMinuteAgo.getTime());
      });
    });
  });

  describe('GET /api/performance/metrics/aggregated', () => {
    it('should return aggregated metrics for valid category and metric', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/aggregated?category=database&metric=executionTime')
        .expect(200);

      expect(response.body).toHaveProperty('aggregated');
      expect(response.body).toHaveProperty('timeSeries');
      expect(response.body.aggregated).toHaveProperty('avg');
      expect(response.body.aggregated).toHaveProperty('min');
      expect(response.body.aggregated).toHaveProperty('max');
      expect(response.body.aggregated).toHaveProperty('count');
      expect(response.body.timeSeries).toBeInstanceOf(Array);
    });

    it('should return 400 for missing category parameter', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/aggregated?metric=executionTime')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Category and metric parameters are required');
    });

    it('should return 400 for missing metric parameter', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/aggregated?category=database')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Category and metric parameters are required');
    });
  });

  describe('GET /api/performance/snapshot', () => {
    it('should return current performance snapshot', async () => {
      const response = await request(app)
        .get('/api/performance/snapshot')
        .expect(200);

      expect(response.body).toHaveProperty('snapshot');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('isMonitoring');
      expect(response.body.snapshot).toHaveProperty('database');
      expect(response.body.snapshot).toHaveProperty('api');
      expect(response.body.snapshot).toHaveProperty('frontend');
      expect(response.body.isMonitoring).toBe(true);
    });
  });

  describe('GET /api/performance/stats', () => {
    it('should return performance statistics', async () => {
      const response = await request(app)
        .get('/api/performance/stats')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.stats).toHaveProperty('system');
      expect(response.body.stats.system).toHaveProperty('isMonitoring');
      expect(response.body.stats.system).toHaveProperty('uptime');
    });
  });

  describe('GET /api/performance/metrics/:category', () => {
    it('should return metrics for valid category', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/database')
        .expect(200);

      expect(response.body).toHaveProperty('category', 'database');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('total');
      expect(response.body.metrics).toBeInstanceOf(Array);
      response.body.metrics.forEach((metric: any) => {
        expect(metric.category).toBe('database');
      });
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid category');
    });

    it('should apply limit parameter', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/database?limit=1')
        .expect(200);

      expect(response.body.metrics.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/performance/health', () => {
    it('should return system health information', async () => {
      const response = await request(app)
        .get('/api/performance/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('monitoring');
      expect(response.body).toHaveProperty('collectors');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('healthy');
      expect(response.body.monitoring).toBe(true);
      expect(response.body.collectors).toHaveProperty('count');
      expect(response.body.collectors).toHaveProperty('names');
    });
  });

  describe('DELETE /api/performance/metrics/cleanup', () => {
    it('should cleanup old metrics with default hours', async () => {
      const response = await request(app)
        .delete('/api/performance/metrics/cleanup')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('deletedCount');
      expect(response.body).toHaveProperty('cutoffTime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.message).toContain('cleanup completed');
    });

    it('should cleanup old metrics with custom hours', async () => {
      const response = await request(app)
        .delete('/api/performance/metrics/cleanup?olderThanHours=1')
        .expect(200);

      expect(response.body).toHaveProperty('deletedCount');
      expect(typeof response.body.deletedCount).toBe('number');
    });

    it('should return 400 for invalid olderThanHours parameter', async () => {
      const response = await request(app)
        .delete('/api/performance/metrics/cleanup?olderThanHours=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('must be a positive number');
    });

    it('should return 400 for negative olderThanHours parameter', async () => {
      const response = await request(app)
        .delete('/api/performance/metrics/cleanup?olderThanHours=-1')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('must be a positive number');
    });
  });

  describe('GET /api/performance/collectors', () => {
    it('should return information about registered collectors', async () => {
      const response = await request(app)
        .get('/api/performance/collectors')
        .expect(200);

      expect(response.body).toHaveProperty('collectors');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.collectors).toBeInstanceOf(Array);
      expect(response.body.collectors.length).toBeGreaterThan(0);
      
      const defaultCollector = response.body.collectors.find((c: any) => c.name === 'default');
      expect(defaultCollector).toBeDefined();
      expect(defaultCollector.isDefault).toBe(true);
    });
  });

  describe('GET /api/performance/stream/info', () => {
    it('should return streaming information', async () => {
      const response = await request(app)
        .get('/api/performance/stream/info')
        .expect(200);

      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('instructions');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.events).toBeInstanceOf(Array);
      expect(response.body.events).toContain('performance_metric');
      expect(response.body.events).toContain('performance_alert');
      expect(response.body.events).toContain('performance_snapshot');
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Create a new app with a broken monitor to test error handling
      const brokenApp = express();
      brokenApp.use(express.json());
      
      // Create a monitor that will throw errors
      const brokenMonitor = {
        getSnapshot: () => Promise.reject(new Error('Monitor error')),
        isActive: () => false,
        getDefaultCollector: () => collector,
        getCollectorNames: () => ['default']
      } as any;
      
      brokenApp.use('/api/performance', createMetricsAPI(brokenMonitor));

      const response = await request(brokenApp)
        .get('/api/performance/snapshot')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Time series data', () => {
    it('should generate time series data for aggregated metrics', async () => {
      const response = await request(app)
        .get('/api/performance/metrics/aggregated?category=database&metric=executionTime&groupBy=minute')
        .expect(200);

      expect(response.body).toHaveProperty('timeSeries');
      expect(response.body.timeSeries).toBeInstanceOf(Array);
      
      if (response.body.timeSeries.length > 0) {
        const timeSeriesPoint = response.body.timeSeries[0];
        expect(timeSeriesPoint).toHaveProperty('timestamp');
        expect(timeSeriesPoint).toHaveProperty('value');
        expect(timeSeriesPoint).toHaveProperty('count');
        expect(typeof timeSeriesPoint.value).toBe('number');
        expect(typeof timeSeriesPoint.count).toBe('number');
      }
    });
  });
});