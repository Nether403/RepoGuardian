import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../DashboardService.js';
import { HistoricalDataAnalyzer } from '../HistoricalDataAnalyzer.js';
import { IPerformanceMonitor, IMetricsCollector, PerformanceMetrics } from '../interfaces.js';

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let mockMonitor: IPerformanceMonitor;

  beforeEach(() => {
    mockMonitor = {
      start: vi.fn(),
      stop: vi.fn(),
      isActive: vi.fn().mockReturnValue(true),
      getSnapshot: vi.fn().mockResolvedValue({
        database: { value: 50, metric: 'response_time' },
        api: { value: 150, metric: 'response_time' },
        frontend: { value: 2000, metric: 'load_time' }
      }),
      registerCollector: vi.fn(),
      unregisterCollector: vi.fn()
    };

    dashboardService = new DashboardService(mockMonitor);
  });

  describe('getDashboardOverview', () => {
    it('should return dashboard overview with current metrics', async () => {
      const req = {} as any;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await (dashboardService as any).getDashboardOverview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          summary: expect.objectContaining({
            database: expect.objectContaining({
              avgResponseTime: 50,
              status: 'good'
            }),
            api: expect.objectContaining({
              avgResponseTime: 150,
              status: 'good'
            }),
            frontend: expect.objectContaining({
              avgLoadTime: 2000,
              status: 'good'
            })
          }),
          system: expect.objectContaining({
            monitoring: true,
            uptime: expect.any(Number)
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockMonitor.getSnapshot = vi.fn().mockRejectedValue(new Error('Monitor error'));
      
      const req = {} as any;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await (dashboardService as any).getDashboardOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get dashboard overview',
        message: 'Monitor error'
      });
    });
  });

  describe('getHistoricalData', () => {
    it('should return historical data for specified time range', async () => {
      const req = { query: { hours: '12', category: 'database' } } as any;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await (dashboardService as any).getHistoricalData(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            hours: 12
          }),
          data: expect.any(Object)
        })
      );
    });
  });

  describe('health status calculation', () => {
    it('should return correct health status', () => {
      const getHealthStatus = (dashboardService as any).getHealthStatus.bind(dashboardService);
      
      expect(getHealthStatus(50, 100)).toBe('good');
      expect(getHealthStatus(120, 100)).toBe('warning');
      expect(getHealthStatus(200, 100)).toBe('critical');
    });
  });
});

describe('HistoricalDataAnalyzer', () => {
  let analyzer: HistoricalDataAnalyzer;
  let mockCollector: IMetricsCollector;

  beforeEach(() => {
    mockCollector = {
      collect: vi.fn(),
      collectBatch: vi.fn(),
      getMetrics: vi.fn(),
      getAggregatedMetrics: vi.fn(),
      cleanup: vi.fn()
    };

    analyzer = new HistoricalDataAnalyzer(mockCollector);
  });

  describe('analyzeTrends', () => {
    it('should analyze improving trend', async () => {
      const mockMetrics: PerformanceMetrics[] = [
        { timestamp: new Date('2023-01-01'), category: 'database', metric: 'response_time', value: 100 },
        { timestamp: new Date('2023-01-02'), category: 'database', metric: 'response_time', value: 90 },
        { timestamp: new Date('2023-01-03'), category: 'database', metric: 'response_time', value: 80 }
      ];

      mockCollector.getMetrics = vi.fn().mockResolvedValue(mockMetrics);

      const result = await analyzer.analyzeTrends('database', 'response_time', 7);

      expect(result.trend).toBe('improving');
      expect(result.changePercent).toBeLessThan(0);
      expect(result.dataPoints).toHaveLength(3);
    });

    it('should handle insufficient data', async () => {
      mockCollector.getMetrics = vi.fn().mockResolvedValue([]);

      const result = await analyzer.analyzeTrends('database', 'response_time', 7);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('getPercentiles', () => {
    it('should calculate percentiles correctly', async () => {
      const mockMetrics: PerformanceMetrics[] = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'response_time',
        value: i + 1 // Values 1-100
      }));

      mockCollector.getMetrics = vi.fn().mockResolvedValue(mockMetrics);

      const result = await analyzer.getPercentiles('database', 'response_time', 24);

      expect(result.p50).toBeCloseTo(50.5, 1);
      expect(result.p90).toBeCloseTo(90.1, 1);
      expect(result.p95).toBeCloseTo(95.05, 1);
      expect(result.p99).toBeCloseTo(99.01, 1);
      expect(result.min).toBe(1);
      expect(result.max).toBe(100);
      expect(result.count).toBe(100);
    });

    it('should handle empty data', async () => {
      mockCollector.getMetrics = vi.fn().mockResolvedValue([]);

      const result = await analyzer.getPercentiles('database', 'response_time', 24);

      expect(result.p50).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect high severity anomalies', async () => {
      const normalValues = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000),
        category: 'database' as const,
        metric: 'response_time',
        value: 100 + Math.random() * 10 // Normal values around 100
      }));

      const anomaly = {
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'response_time',
        value: 500 // Anomalous value
      };

      mockCollector.getMetrics = vi.fn().mockResolvedValue([...normalValues, anomaly]);

      const result = await analyzer.detectAnomalies('database', 'response_time', 24);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('high');
      expect(result[0].value).toBe(500);
    });

    it('should handle insufficient data for anomaly detection', async () => {
      const fewMetrics = Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(),
        category: 'database' as const,
        metric: 'response_time',
        value: 100
      }));

      mockCollector.getMetrics = vi.fn().mockResolvedValue(fewMetrics);

      const result = await analyzer.detectAnomalies('database', 'response_time', 24);

      expect(result).toHaveLength(0);
    });
  });
});
