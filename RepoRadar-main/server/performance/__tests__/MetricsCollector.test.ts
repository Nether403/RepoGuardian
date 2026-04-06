import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetricsCollector } from '../MetricsCollector.js';
import { InMemoryMetricsStorage } from '../InMemoryMetricsStorage.js';
import { PerformanceMetrics, DatabaseMetrics, APIMetrics } from '../interfaces.js';

describe('MetricsCollector', () => {
  let storage: InMemoryMetricsStorage;
  let collector: MetricsCollector;

  beforeEach(() => {
    storage = new InMemoryMetricsStorage();
    collector = new MetricsCollector(storage, { bufferSize: 3 });
  });

  afterEach(() => {
    collector.stopAutoFlush();
  });

  describe('collect', () => {
    it('should collect a valid metric', async () => {
      const metric: DatabaseMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'query_time',
        value: 150,
        queryId: 'test-query',
        executionTime: 150,
        connectionPoolSize: 10,
        activeConnections: 5
      };

      await collector.collect(metric);
      
      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(1);
    });

    it('should add timestamp if missing', async () => {
      const metric = {
        category: 'api' as const,
        metric: 'response_time',
        value: 200,
        endpoint: '/api/test',
        responseTime: 200,
        cacheHit: false
      };

      await collector.collect(metric as APIMetrics);
      await collector.flush();

      const metrics = await storage.retrieve({});
      expect(metrics).toHaveLength(1);
      expect(metrics[0].timestamp).toBeInstanceOf(Date);
    });

    it('should validate metric category', async () => {
      const invalidMetric = {
        timestamp: new Date(),
        category: 'invalid' as any,
        metric: 'test',
        value: 100
      };

      await expect(collector.collect(invalidMetric)).rejects.toThrow('Invalid metric category');
    });

    it('should validate metric name', async () => {
      const invalidMetric = {
        timestamp: new Date(),
        category: 'database' as const,
        metric: '',
        value: 100
      };

      await expect(collector.collect(invalidMetric)).rejects.toThrow('Metric name is required');
    });

    it('should validate metric value', async () => {
      const invalidMetric = {
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'test',
        value: NaN
      };

      await expect(collector.collect(invalidMetric)).rejects.toThrow('Metric value must be a valid number');
    });

    it('should validate threshold if provided', async () => {
      const invalidMetric = {
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'test',
        value: 100,
        threshold: 'invalid' as any
      };

      await expect(collector.collect(invalidMetric)).rejects.toThrow('Metric threshold must be a valid number');
    });

    it('should auto-flush when buffer is full', async () => {
      const metrics = Array.from({ length: 3 }, (_, i) => ({
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'test',
        value: i,
        queryId: `query-${i}`,
        executionTime: i,
        connectionPoolSize: 10,
        activeConnections: 5
      }));

      for (const metric of metrics) {
        await collector.collect(metric);
      }

      // Buffer should be empty after auto-flush
      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(0);

      // Metrics should be in storage
      const storedMetrics = await storage.retrieve({});
      expect(storedMetrics).toHaveLength(3);
    });

    it('should not collect when disabled', async () => {
      collector.setEnabled(false);

      const metric: DatabaseMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'test',
        value: 100,
        queryId: 'test',
        executionTime: 100,
        connectionPoolSize: 10,
        activeConnections: 5
      };

      await collector.collect(metric);

      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(0);
    });
  });

  describe('collectBatch', () => {
    it('should collect multiple metrics at once', async () => {
      const metrics: DatabaseMetrics[] = [
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 100,
          queryId: 'query-1',
          executionTime: 100,
          connectionPoolSize: 10,
          activeConnections: 5
        },
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 200,
          queryId: 'query-2',
          executionTime: 200,
          connectionPoolSize: 10,
          activeConnections: 6
        }
      ];

      await collector.collectBatch(metrics);

      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(2);
    });

    it('should validate all metrics in batch', async () => {
      const metrics = [
        {
          timestamp: new Date(),
          category: 'database' as const,
          metric: 'valid',
          value: 100
        },
        {
          timestamp: new Date(),
          category: 'invalid' as any,
          metric: 'invalid',
          value: 200
        }
      ];

      await expect(collector.collectBatch(metrics)).rejects.toThrow('Invalid metric category');
    });

    it('should handle empty batch', async () => {
      await collector.collectBatch([]);

      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(0);
    });
  });

  describe('getMetrics', () => {
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
          metric: 'query_time',
          value: 150
        }
      ];

      await collector.collectBatch(metrics);
      await collector.flush();
    });

    it('should retrieve all metrics when no filters applied', async () => {
      const metrics = await collector.getMetrics();
      expect(metrics).toHaveLength(3);
    });

    it('should filter by category', async () => {
      const metrics = await collector.getMetrics('database');
      expect(metrics).toHaveLength(2);
      expect(metrics.every(m => m.category === 'database')).toBe(true);
    });

    it('should filter by time range', async () => {
      const startTime = new Date('2023-01-01T10:30:00Z');
      const endTime = new Date('2023-01-01T11:30:00Z');

      const metrics = await collector.getMetrics(undefined, startTime, endTime);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].timestamp.getTime()).toBe(new Date('2023-01-01T11:00:00Z').getTime());
    });
  });

  describe('getAggregatedMetrics', () => {
    beforeEach(async () => {
      const metrics: PerformanceMetrics[] = [
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 100
        },
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 200
        },
        {
          timestamp: new Date(),
          category: 'database',
          metric: 'query_time',
          value: 300
        }
      ];

      await collector.collectBatch(metrics);
      await collector.flush();
    });

    it('should calculate correct aggregations', async () => {
      const aggregated = await collector.getAggregatedMetrics('database', 'query_time');

      expect(aggregated.count).toBe(3);
      expect(aggregated.avg).toBe(200);
      expect(aggregated.min).toBe(100);
      expect(aggregated.max).toBe(300);
    });

    it('should return zeros for non-existent metrics', async () => {
      const aggregated = await collector.getAggregatedMetrics('database', 'non_existent');

      expect(aggregated.count).toBe(0);
      expect(aggregated.avg).toBe(0);
      expect(aggregated.min).toBe(0);
      expect(aggregated.max).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should flush before cleanup', async () => {
      const metric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'test',
        value: 100
      };

      await collector.collect(metric);
      
      // Use a cutoff time in the past so the metric won't be deleted
      const cutoffTime = new Date(Date.now() - 1000);
      await collector.cleanup(cutoffTime);

      // Metric should be in storage after cleanup (since it's newer than cutoff)
      const metrics = await storage.retrieve({});
      expect(metrics).toHaveLength(1);
    });
  });

  describe('buffer management', () => {
    it('should provide accurate buffer status', () => {
      const status = collector.getBufferStatus();
      expect(status.size).toBe(0);
      expect(status.maxSize).toBe(3);
      expect(status.utilizationPercent).toBe(0);
    });

    it('should handle flush failures gracefully', async () => {
      // Mock storage to fail
      vi.spyOn(storage, 'storeBatch').mockRejectedValueOnce(new Error('Storage error'));

      const metric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'test',
        value: 100
      };

      await collector.collect(metric);

      await expect(collector.flush()).rejects.toThrow('Storage error');

      // Metric should still be in buffer after failed flush
      const bufferStatus = collector.getBufferStatus();
      expect(bufferStatus.size).toBe(1);
    });
  });

  describe('auto-flush', () => {
    it('should auto-flush at specified intervals', async () => {
      const autoFlushCollector = new MetricsCollector(storage, {
        bufferSize: 10,
        flushIntervalMs: 100
      });

      const metric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'test',
        value: 100
      };

      await autoFlushCollector.collect(metric);

      // Wait for auto-flush
      await new Promise(resolve => setTimeout(resolve, 150));

      const bufferStatus = autoFlushCollector.getBufferStatus();
      expect(bufferStatus.size).toBe(0);

      const storedMetrics = await storage.retrieve({});
      expect(storedMetrics).toHaveLength(1);

      autoFlushCollector.stopAutoFlush();
    });
  });
});