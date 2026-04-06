import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor.js';
import { MetricsCollector } from '../MetricsCollector.js';
import { IMetricsCollector, DatabaseMetrics, APIMetrics, FrontendMetrics } from '../interfaces.js';

// Mock console.log to avoid noise in tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxMetrics: 100,
      retentionHours: 1,
      bufferSize: 10
    });
  });

  afterEach(async () => {
    await monitor.stop();
  });

  describe('lifecycle', () => {
    it('should start monitoring', async () => {
      expect(monitor.isActive()).toBe(false);

      await monitor.start();

      expect(monitor.isActive()).toBe(true);
    });

    it('should stop monitoring', async () => {
      await monitor.start();
      expect(monitor.isActive()).toBe(true);

      await monitor.stop();

      expect(monitor.isActive()).toBe(false);
    });

    it('should handle multiple start calls', async () => {
      await monitor.start();
      await monitor.start(); // Should not throw

      expect(monitor.isActive()).toBe(true);
    });

    it('should handle multiple stop calls', async () => {
      await monitor.start();
      await monitor.stop();
      await monitor.stop(); // Should not throw

      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('collector management', () => {
    it('should have default collector', () => {
      const defaultCollector = monitor.getDefaultCollector();
      expect(defaultCollector).toBeDefined();
    });

    it('should register custom collector', () => {
      const mockCollector: IMetricsCollector = {
        collect: vi.fn(),
        collectBatch: vi.fn(),
        getMetrics: vi.fn(),
        getAggregatedMetrics: vi.fn(),
        cleanup: vi.fn()
      };

      monitor.registerCollector('custom', mockCollector);

      expect(monitor.getCollector('custom')).toBe(mockCollector);
      expect(monitor.getCollectorNames()).toContain('custom');
    });

    it('should not allow duplicate collector names', () => {
      const mockCollector: IMetricsCollector = {
        collect: vi.fn(),
        collectBatch: vi.fn(),
        getMetrics: vi.fn(),
        getAggregatedMetrics: vi.fn(),
        cleanup: vi.fn()
      };

      monitor.registerCollector('test', mockCollector);

      expect(() => {
        monitor.registerCollector('test', mockCollector);
      }).toThrow("Collector with name 'test' already exists");
    });

    it('should unregister custom collector', () => {
      const mockCollector: IMetricsCollector = {
        collect: vi.fn(),
        collectBatch: vi.fn(),
        getMetrics: vi.fn(),
        getAggregatedMetrics: vi.fn(),
        cleanup: vi.fn()
      };

      monitor.registerCollector('custom', mockCollector);
      monitor.unregisterCollector('custom');

      expect(monitor.getCollector('custom')).toBeUndefined();
      expect(monitor.getCollectorNames()).not.toContain('custom');
    });

    it('should not allow unregistering default collector', () => {
      expect(() => {
        monitor.unregisterCollector('default');
      }).toThrow('Cannot unregister the default collector');
    });
  });

  describe('metric recording', () => {
    beforeEach(async () => {
      await monitor.start();
    });

    it('should record database metrics', async () => {
      const metric: Omit<DatabaseMetrics, 'timestamp' | 'category'> = {
        metric: 'query_time',
        value: 150,
        queryId: 'test-query',
        executionTime: 150,
        connectionPoolSize: 10,
        activeConnections: 5
      };

      await monitor.recordDatabaseMetric(metric);

      // Verify metric was recorded
      const collector = monitor.getDefaultCollector();
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
      const metrics = await collector.getMetrics('database');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric).toBe('query_time');
      expect(metrics[0].value).toBe(150);
    });

    it('should record API metrics', async () => {
      const metric: Omit<APIMetrics, 'timestamp' | 'category'> = {
        metric: 'response_time',
        value: 200,
        endpoint: '/api/test',
        responseTime: 200,
        cacheHit: false
      };

      await monitor.recordAPIMetric(metric);

      const collector = monitor.getDefaultCollector();
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
      const metrics = await collector.getMetrics('api');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric).toBe('response_time');
      expect(metrics[0].value).toBe(200);
    });

    it('should record frontend metrics', async () => {
      const metric: Omit<FrontendMetrics, 'timestamp' | 'category'> = {
        metric: 'load_time',
        value: 500,
        bundleName: 'main.js',
        loadTime: 500,
        bundleSize: 1024,
        cacheStatus: 'miss'
      };

      await monitor.recordFrontendMetric(metric);

      const collector = monitor.getDefaultCollector();
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
      const metrics = await collector.getMetrics('frontend');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric).toBe('load_time');
      expect(metrics[0].value).toBe(500);
    });

    it('should not record metrics when monitoring is stopped', async () => {
      await monitor.stop();

      const metric: Omit<DatabaseMetrics, 'timestamp' | 'category'> = {
        metric: 'query_time',
        value: 150,
        queryId: 'test-query',
        executionTime: 150,
        connectionPoolSize: 10,
        activeConnections: 5
      };

      await monitor.recordDatabaseMetric(metric);

      const collector = monitor.getDefaultCollector();
      const metrics = await collector.getMetrics('database');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('getSnapshot', () => {
    beforeEach(async () => {
      await monitor.start();

      // Add some test metrics
      await monitor.recordDatabaseMetric({
        metric: 'query_time',
        value: 100,
        queryId: 'test-1',
        executionTime: 100,
        connectionPoolSize: 10,
        activeConnections: 5
      });

      await monitor.recordAPIMetric({
        metric: 'response_time',
        value: 200,
        endpoint: '/api/test',
        responseTime: 200,
        cacheHit: true
      });

      await monitor.recordFrontendMetric({
        metric: 'load_time',
        value: 300,
        bundleName: 'app.js',
        loadTime: 300,
        bundleSize: 2048,
        cacheStatus: 'hit'
      });

      // Flush metrics to storage
      const collector = monitor.getDefaultCollector();
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
    });

    it('should return performance snapshot', async () => {
      const snapshot = await monitor.getSnapshot();

      expect(snapshot.database).toBeDefined();
      expect(snapshot.api).toBeDefined();
      expect(snapshot.frontend).toBeDefined();

      // Check that aggregated data is included if metrics exist
      if (Object.keys(snapshot.database).length > 0) {
        expect(snapshot.database.aggregated).toBeDefined();
      }
      if (Object.keys(snapshot.api).length > 0) {
        expect(snapshot.api.aggregated).toBeDefined();
      }
      if (Object.keys(snapshot.frontend).length > 0) {
        expect(snapshot.frontend.aggregated).toBeDefined();
      }
    });

    it('should handle empty metrics gracefully', async () => {
      const emptyMonitor = new PerformanceMonitor();
      await emptyMonitor.start();

      const snapshot = await emptyMonitor.getSnapshot();

      expect(snapshot.database).toEqual({});
      expect(snapshot.api).toEqual({});
      expect(snapshot.frontend).toEqual({});

      await emptyMonitor.stop();
    });
  });

  describe('getPerformanceStats', () => {
    beforeEach(async () => {
      await monitor.start();

      // Add metrics with different timestamps to test aggregation
      const now = new Date();
      const metrics = [
        { category: 'database' as const, metric: 'executionTime', value: 100 },
        { category: 'database' as const, metric: 'executionTime', value: 200 },
        { category: 'api' as const, metric: 'responseTime', value: 150 },
        { category: 'api' as const, metric: 'responseTime', value: 250 },
        { category: 'frontend' as const, metric: 'loadTime', value: 300 },
        { category: 'frontend' as const, metric: 'loadTime', value: 400 }
      ];

      const collector = monitor.getDefaultCollector();
      for (const metric of metrics) {
        await collector.collect({
          timestamp: now,
          ...metric
        });
      }

      // Flush metrics to storage
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
    });

    it('should return performance statistics', async () => {
      const stats = await monitor.getPerformanceStats();

      expect(stats.database).toBeDefined();
      expect(stats.api).toBeDefined();
      expect(stats.frontend).toBeDefined();
      expect(stats.system).toBeDefined();

      expect(stats.system.isMonitoring).toBe(true);
      expect(stats.system.collectorsCount).toBe(1);
      expect(stats.system.uptime).toBeGreaterThan(0);
    });

    it('should calculate correct aggregations', async () => {
      const stats = await monitor.getPerformanceStats();

      // Database stats (100, 200)
      expect(stats.database.count).toBe(2);
      expect(stats.database.avg).toBe(150);
      expect(stats.database.min).toBe(100);
      expect(stats.database.max).toBe(200);

      // API stats (150, 250)
      expect(stats.api.count).toBe(2);
      expect(stats.api.avg).toBe(200);
      expect(stats.api.min).toBe(150);
      expect(stats.api.max).toBe(250);

      // Frontend stats (300, 400)
      expect(stats.frontend.count).toBe(2);
      expect(stats.frontend.avg).toBe(350);
      expect(stats.frontend.min).toBe(300);
      expect(stats.frontend.max).toBe(400);
    });
  });

  describe('cleanupOldMetrics', () => {
    beforeEach(async () => {
      await monitor.start();

      // Add some old metrics
      const collector = monitor.getDefaultCollector();
      const oldMetrics = [
        {
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          category: 'database' as const,
          metric: 'old_metric',
          value: 100
        },
        {
          timestamp: new Date(), // Now
          category: 'database' as const,
          metric: 'new_metric',
          value: 200
        }
      ];

      await collector.collectBatch(oldMetrics);

      // Flush metrics to storage
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
    });

    it('should cleanup old metrics', async () => {
      const cleanedCount = await monitor.cleanupOldMetrics(1); // 1 hour retention

      expect(cleanedCount).toBe(1);

      const collector = monitor.getDefaultCollector();
      const remainingMetrics = await collector.getMetrics('database');
      expect(remainingMetrics).toHaveLength(1);
      expect(remainingMetrics[0].metric).toBe('new_metric');
    });

    it('should cleanup across all collectors', async () => {
      const mockCollector: IMetricsCollector = {
        collect: vi.fn(),
        collectBatch: vi.fn(),
        getMetrics: vi.fn(),
        getAggregatedMetrics: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(5)
      };

      monitor.registerCollector('custom', mockCollector);

      const totalCleaned = await monitor.cleanupOldMetrics(1);

      expect(totalCleaned).toBeGreaterThan(0);
      expect(mockCollector.cleanup).toHaveBeenCalled();
    });
  });
});