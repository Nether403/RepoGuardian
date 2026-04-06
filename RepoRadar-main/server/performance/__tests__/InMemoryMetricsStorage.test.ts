import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryMetricsStorage } from '../InMemoryMetricsStorage.js';
import { PerformanceMetrics } from '../interfaces.js';

describe('InMemoryMetricsStorage', () => {
  let storage: InMemoryMetricsStorage;

  beforeEach(() => {
    storage = new InMemoryMetricsStorage({
      maxMetrics: 5,
      retentionHours: 1
    });
  });

  describe('store', () => {
    it('should store a single metric', async () => {
      const metric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'query_time',
        value: 100
      };

      await storage.store(metric);

      const stats = await storage.getStats();
      expect(stats.totalMetrics).toBe(1);
    });

    it('should enforce max metrics limit', async () => {
      const metrics = Array.from({ length: 7 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000),
        category: 'database' as const,
        metric: 'test',
        value: i
      }));

      for (const metric of metrics) {
        await storage.store(metric);
      }

      const stats = await storage.getStats();
      expect(stats.totalMetrics).toBe(5); // Should be limited to maxMetrics
    });

    it('should keep newest metrics when enforcing limit', async () => {
      const metrics = Array.from({ length: 7 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000),
        category: 'database' as const,
        metric: 'test',
        value: i
      }));

      for (const metric of metrics) {
        await storage.store(metric);
      }

      const allMetrics = await storage.retrieve({});
      const values = allMetrics.map(m => m.value).sort((a, b) => a - b);
      expect(values).toEqual([2, 3, 4, 5, 6]); // Should keep the 5 newest
    });
  });

  describe('storeBatch', () => {
    it('should store multiple metrics at once', async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 100
        },
        {
          timestamp: new Date(),
          category: 'api',
          metric: 'response_time',
          value: 200
        }
      ];

      await storage.storeBatch(metrics);

      const stats = await storage.getStats();
      expect(stats.totalMetrics).toBe(2);
    });

    it('should handle empty batch', async () => {
      await storage.storeBatch([]);

      const stats = await storage.getStats();
      expect(stats.totalMetrics).toBe(0);
    });
  });

  describe('retrieve', () => {
    beforeEach(async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date('2023-01-01T10:00:00Z'),
          category: 'database',
          metric: 'query_time',
          value: 100
        },
        {
          timestamp: new Date('2023-01-01T11:00:00Z'),
          category: 'api',
          metric: 'response_time',
          value: 200
        },
        {
          timestamp: new Date('2023-01-01T12:00:00Z'),
          category: 'database',
          metric: 'connection_count',
          value: 10
        },
        {
          timestamp: new Date('2023-01-01T13:00:00Z'),
          category: 'frontend',
          metric: 'load_time',
          value: 500
        }
      ];

      await storage.storeBatch(metrics);
    });

    it('should retrieve all metrics with no filter', async () => {
      const metrics = await storage.retrieve({});
      expect(metrics).toHaveLength(4);
    });

    it('should filter by category', async () => {
      const metrics = await storage.retrieve({ category: 'database' });
      expect(metrics).toHaveLength(2);
      expect(metrics.every(m => m.category === 'database')).toBe(true);
    });

    it('should filter by metric name', async () => {
      const metrics = await storage.retrieve({ metric: 'query_time' });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric).toBe('query_time');
    });

    it('should filter by time range', async () => {
      const startTime = new Date('2023-01-01T10:30:00Z');
      const endTime = new Date('2023-01-01T12:30:00Z');

      const metrics = await storage.retrieve({ startTime, endTime });
      expect(metrics).toHaveLength(2);
    });

    it('should apply pagination', async () => {
      const firstPage = await storage.retrieve({ limit: 2 });
      expect(firstPage).toHaveLength(2);

      const secondPage = await storage.retrieve({ limit: 2, offset: 2 });
      expect(secondPage).toHaveLength(2);
    });

    it('should sort by timestamp descending', async () => {
      const metrics = await storage.retrieve({});
      const timestamps = metrics.map(m => m.timestamp.getTime());
      
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should combine multiple filters', async () => {
      const metrics = await storage.retrieve({
        category: 'database',
        startTime: new Date('2023-01-01T11:30:00Z'),
        limit: 1
      });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].category).toBe('database');
      expect(metrics[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        new Date('2023-01-01T11:30:00Z').getTime()
      );
    });
  });

  describe('deleteOlderThan', () => {
    beforeEach(async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date('2023-01-01T10:00:00Z'),
          category: 'database',
          metric: 'old_metric',
          value: 100
        },
        {
          timestamp: new Date('2023-01-01T12:00:00Z'),
          category: 'database',
          metric: 'new_metric',
          value: 200
        }
      ];

      await storage.storeBatch(metrics);
    });

    it('should delete metrics older than specified date', async () => {
      const cutoffDate = new Date('2023-01-01T11:00:00Z');
      const deletedCount = await storage.deleteOlderThan(cutoffDate);

      expect(deletedCount).toBe(1);

      const remainingMetrics = await storage.retrieve({});
      expect(remainingMetrics).toHaveLength(1);
      expect(remainingMetrics[0].metric).toBe('new_metric');
    });

    it('should return correct count of deleted metrics', async () => {
      const cutoffDate = new Date('2023-01-01T13:00:00Z');
      const deletedCount = await storage.deleteOlderThan(cutoffDate);

      expect(deletedCount).toBe(2);

      const remainingMetrics = await storage.retrieve({});
      expect(remainingMetrics).toHaveLength(0);
    });

    it('should not delete metrics newer than cutoff', async () => {
      const cutoffDate = new Date('2023-01-01T09:00:00Z');
      const deletedCount = await storage.deleteOlderThan(cutoffDate);

      expect(deletedCount).toBe(0);

      const remainingMetrics = await storage.retrieve({});
      expect(remainingMetrics).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for empty storage', async () => {
      const stats = await storage.getStats();

      expect(stats.totalMetrics).toBe(0);
      expect(stats.oldestMetric).toBeNull();
      expect(stats.newestMetric).toBeNull();
      expect(stats.categoryCounts).toEqual({});
    });

    it('should return correct stats with metrics', async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date('2023-01-01T10:00:00Z'),
          category: 'database',
          metric: 'test1',
          value: 100
        },
        {
          timestamp: new Date('2023-01-01T12:00:00Z'),
          category: 'database',
          metric: 'test2',
          value: 200
        },
        {
          timestamp: new Date('2023-01-01T11:00:00Z'),
          category: 'api',
          metric: 'test3',
          value: 300
        }
      ];

      await storage.storeBatch(metrics);

      const stats = await storage.getStats();

      expect(stats.totalMetrics).toBe(3);
      expect(stats.oldestMetric).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(stats.newestMetric).toEqual(new Date('2023-01-01T12:00:00Z'));
      expect(stats.categoryCounts).toEqual({
        database: 2,
        api: 1
      });
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory usage statistics', () => {
      const stats = storage.getMemoryStats();

      expect(stats.metricsCount).toBe(0);
      expect(stats.maxMetrics).toBe(5);
      expect(stats.utilizationPercent).toBe(0);
      expect(stats.estimatedMemoryMB).toBeGreaterThanOrEqual(0);
    });

    it('should calculate utilization correctly', async () => {
      const metrics = Array.from({ length: 3 }, (_, i) => ({
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'test',
        value: i
      }));

      await storage.storeBatch(metrics);

      const stats = storage.getMemoryStats();
      expect(stats.metricsCount).toBe(3);
      expect(stats.utilizationPercent).toBe(60); // 3/5 * 100
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'test1',
          value: 100
        },
        {
          timestamp: new Date(),
          category: 'api',
          metric: 'test2',
          value: 200
        }
      ];

      await storage.storeBatch(metrics);
    });

    it('should clear all metrics', () => {
      storage.clear();

      const stats = storage.getMemoryStats();
      expect(stats.metricsCount).toBe(0);
    });

    it('should export metrics', () => {
      const exported = storage.exportMetrics();
      expect(exported).toHaveLength(2);
      expect(exported[0].metric).toBe('test1');
      expect(exported[1].metric).toBe('test2');
    });

    it('should import metrics', () => {
      const metricsToImport: PerformanceMetrics[] = [
        {
          timestamp: new Date(),
          category: 'frontend',
          metric: 'imported',
          value: 500
        }
      ];

      storage.clear();
      storage.importMetrics(metricsToImport);

      const stats = storage.getMemoryStats();
      expect(stats.metricsCount).toBe(1);

      const exported = storage.exportMetrics();
      expect(exported[0].metric).toBe('imported');
    });

    it('should enforce max metrics on import', () => {
      const manyMetrics = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000),
        category: 'database' as const,
        metric: `test${i}`,
        value: i
      }));

      storage.importMetrics(manyMetrics);

      const stats = storage.getMemoryStats();
      expect(stats.metricsCount).toBe(5); // Should be limited to maxMetrics
    });
  });
});