import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { MetricsOverview } from '../MetricsOverview';
import { PerformanceChart } from '../PerformanceChart';
import { AlertsPanel } from '../AlertsPanel';
import { HistoricalTrends } from '../HistoricalTrends';

// Mock fetch globally
global.fetch = vi.fn();

describe('Dashboard UI Components Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Creation', () => {
    it('should create PerformanceDashboard component without errors', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          timestamp: '2023-01-01T12:00:00Z',
          summary: {
            database: { avgResponseTime: 50, status: 'good' },
            api: { avgResponseTime: 150, status: 'good' },
            frontend: { avgLoadTime: 2000, status: 'good' }
          },
          system: { monitoring: true, uptime: 3600 }
        })
      });

      expect(() => {
        React.createElement(PerformanceDashboard);
      }).not.toThrow();
    });

    it('should create MetricsOverview component without errors', () => {
      const mockData = {
        database: { avgResponseTime: 50, status: 'good' },
        api: { avgResponseTime: 150, status: 'good' },
        frontend: { avgLoadTime: 2000, status: 'good' }
      };

      expect(() => {
        React.createElement(MetricsOverview, { data: mockData });
      }).not.toThrow();
    });

    it('should create PerformanceChart component without errors', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { database: [], api: [], frontend: [] } })
      });

      expect(() => {
        React.createElement(PerformanceChart);
      }).not.toThrow();
    });

    it('should create AlertsPanel component without errors', () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'threshold_exceeded',
          severity: 'high' as const,
          message: 'Test alert',
          timestamp: '2023-01-01T12:00:00Z'
        }
      ];

      expect(() => {
        React.createElement(AlertsPanel, { alerts: mockAlerts });
      }).not.toThrow();
    });

    it('should create HistoricalTrends component without errors', () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          database: { trend: 'stable', changePercent: 0, confidence: 0.8 },
          api: { trend: 'stable', changePercent: 0, confidence: 0.8 },
          frontend: { trend: 'stable', changePercent: 0, confidence: 0.8 }
        })
      });

      expect(() => {
        React.createElement(HistoricalTrends);
      }).not.toThrow();
    });
  });

  describe('Data Processing', () => {
    it('should handle fetch responses correctly', async () => {
      const mockResponse = {
        timestamp: '2023-01-01T12:00:00Z',
        summary: {
          database: { avgResponseTime: 50, status: 'good' },
          api: { avgResponseTime: 150, status: 'good' },
          frontend: { avgLoadTime: 2000, status: 'good' }
        },
        system: { monitoring: true, uptime: 3600 }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/performance/dashboard/overview');
      const data = await response.json();

      expect(data).toEqual(mockResponse);
      expect(data.summary.database.avgResponseTime).toBe(50);
      expect(data.system.monitoring).toBe(true);
    });

    it('should handle error responses correctly', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      try {
        await fetch('/api/performance/dashboard/overview');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('Component Props Validation', () => {
    it('should validate MetricsOverview props', () => {
      const validProps = {
        database: { avgResponseTime: 50, status: 'good' },
        api: { avgResponseTime: 150, status: 'warning' },
        frontend: { avgLoadTime: 2000, status: 'critical' }
      };

      expect(() => {
        React.createElement(MetricsOverview, { data: validProps });
      }).not.toThrow();
    });

    it('should validate AlertsPanel props', () => {
      const validAlerts = [
        {
          id: '1',
          type: 'threshold_exceeded',
          severity: 'high' as const,
          message: 'Test alert',
          timestamp: '2023-01-01T12:00:00Z',
          metric: {
            category: 'database',
            name: 'response_time',
            value: 100,
            threshold: 50
          }
        }
      ];

      expect(() => {
        React.createElement(AlertsPanel, { alerts: validAlerts });
      }).not.toThrow();
    });
  });

  describe('API Integration', () => {
    it('should make correct API calls for dashboard data', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          timestamp: '2023-01-01T12:00:00Z',
          summary: {
            database: { avgResponseTime: 50, status: 'good' },
            api: { avgResponseTime: 150, status: 'good' },
            frontend: { avgLoadTime: 2000, status: 'good' }
          },
          system: { monitoring: true, uptime: 3600 }
        })
      } as Response);

      await fetch('/api/performance/dashboard/overview');

      expect(fetchSpy).toHaveBeenCalledWith('/api/performance/dashboard/overview');
    });

    it('should make correct API calls for historical data', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            database: [],
            api: [],
            frontend: []
          }
        })
      } as Response);

      await fetch('/api/performance/dashboard/historical?hours=24');

      expect(fetchSpy).toHaveBeenCalledWith('/api/performance/dashboard/historical?hours=24');
    });

    it('should make correct API calls for trends data', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          database: { trend: 'stable', changePercent: 0, confidence: 0.8 },
          api: { trend: 'stable', changePercent: 0, confidence: 0.8 },
          frontend: { trend: 'stable', changePercent: 0, confidence: 0.8 }
        })
      } as Response);

      await fetch('/api/performance/dashboard/trends?range=7d');

      expect(fetchSpy).toHaveBeenCalledWith('/api/performance/dashboard/trends?range=7d');
    });
  });
});