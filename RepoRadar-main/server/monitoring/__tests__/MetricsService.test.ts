import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { metricsService } from '../MetricsService';

describe('MetricsService', () => {
  beforeEach(() => {
    metricsService.clear();
  });

  afterEach(() => {
    metricsService.clear();
  });

  describe('Response Time Metrics', () => {
    it('should record response time metrics', () => {
      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        timestamp: new Date(),
      });

      const metrics = metricsService.getResponseTimeMetrics();
      expect(metrics.count).toBe(1);
      expect(metrics.avg).toBe(150);
    });

    it('should calculate summary statistics', () => {
      const durations = [100, 150, 200, 250, 300];
      
      durations.forEach(duration => {
        metricsService.recordResponseTime({
          path: '/api/test',
          method: 'GET',
          statusCode: 200,
          duration,
          timestamp: new Date(),
        });
      });

      const metrics = metricsService.getResponseTimeMetrics();
      expect(metrics.count).toBe(5);
      expect(metrics.avg).toBe(200);
      expect(metrics.min).toBe(100);
      expect(metrics.max).toBe(300);
      expect(metrics.p50).toBe(200);
    });

    it('should filter metrics by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        timestamp: twoHoursAgo,
      });

      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 200,
        timestamp: now,
      });

      const metrics = metricsService.getResponseTimeMetrics(oneHourAgo, undefined);
      expect(metrics.count).toBe(1);
      expect(metrics.avg).toBe(200);
    });

    it('should filter metrics by path', () => {
      metricsService.recordResponseTime({
        path: '/api/test1',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        timestamp: new Date(),
      });

      metricsService.recordResponseTime({
        path: '/api/test2',
        method: 'GET',
        statusCode: 200,
        duration: 200,
        timestamp: new Date(),
      });

      const metrics = metricsService.getResponseTimeMetrics(
        undefined,
        undefined,
        '/api/test1'
      );
      expect(metrics.count).toBe(1);
      expect(metrics.avg).toBe(100);
    });
  });

  describe('Error Metrics', () => {
    it('should record error metrics', () => {
      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'Test error',
        timestamp: new Date(),
      });

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalErrors).toBe(1);
    });

    it('should calculate error rate', () => {
      // Record successful requests
      for (let i = 0; i < 8; i++) {
        metricsService.recordResponseTime({
          path: '/api/test',
          method: 'GET',
          statusCode: 200,
          duration: 100,
          timestamp: new Date(),
        });
      }

      // Record errors
      for (let i = 0; i < 2; i++) {
        metricsService.recordError({
          path: '/api/test',
          method: 'GET',
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'Test error',
          timestamp: new Date(),
        });
      }

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.totalRequests).toBe(8);
      expect(errorRate.totalErrors).toBe(2);
      expect(errorRate.errorRate).toBe(0.25);
    });

    it('should count errors by code', () => {
      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'NOT_FOUND',
        errorMessage: 'Not found',
        timestamp: new Date(),
      });

      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'NOT_FOUND',
        errorMessage: 'Not found',
        timestamp: new Date(),
      });

      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'Internal error',
        timestamp: new Date(),
      });

      const errorRate = metricsService.getErrorRate();
      expect(errorRate.errorsByCode['NOT_FOUND']).toBe(2);
      expect(errorRate.errorsByCode['INTERNAL_ERROR']).toBe(1);
    });
  });

  describe('Job Metrics', () => {
    it('should record job metrics', () => {
      metricsService.recordJob({
        jobType: 'batch-analysis',
        jobId: 'job-123',
        duration: 5000,
        status: 'completed',
        timestamp: new Date(),
      });

      const jobMetrics = metricsService.getJobMetrics();
      expect(jobMetrics.totalJobs).toBe(1);
      expect(jobMetrics.completedJobs).toBe(1);
      expect(jobMetrics.failedJobs).toBe(0);
    });

    it('should calculate job success rate', () => {
      // Record completed jobs
      for (let i = 0; i < 8; i++) {
        metricsService.recordJob({
          jobType: 'batch-analysis',
          jobId: `job-${i}`,
          duration: 5000,
          status: 'completed',
          timestamp: new Date(),
        });
      }

      // Record failed jobs
      for (let i = 0; i < 2; i++) {
        metricsService.recordJob({
          jobType: 'batch-analysis',
          jobId: `job-fail-${i}`,
          duration: 3000,
          status: 'failed',
          timestamp: new Date(),
        });
      }

      const jobMetrics = metricsService.getJobMetrics();
      expect(jobMetrics.totalJobs).toBe(10);
      expect(jobMetrics.completedJobs).toBe(8);
      expect(jobMetrics.failedJobs).toBe(2);
      expect(jobMetrics.successRate).toBe(0.8);
    });

    it('should calculate duration by job type', () => {
      metricsService.recordJob({
        jobType: 'batch-analysis',
        jobId: 'job-1',
        duration: 5000,
        status: 'completed',
        timestamp: new Date(),
      });

      metricsService.recordJob({
        jobType: 'export',
        jobId: 'job-2',
        duration: 2000,
        status: 'completed',
        timestamp: new Date(),
      });

      const jobMetrics = metricsService.getJobMetrics();
      expect(jobMetrics.durationByType['batch-analysis'].avg).toBe(5000);
      expect(jobMetrics.durationByType['export'].avg).toBe(2000);
    });
  });

  describe('Custom Metrics', () => {
    it('should record custom metrics', () => {
      metricsService.recordCustomMetric('database.query.time', 150);
      metricsService.recordCustomMetric('database.query.time', 200);

      const metric = metricsService.getCustomMetric('database.query.time');
      expect(metric).not.toBeNull();
      expect(metric!.count).toBe(2);
      expect(metric!.avg).toBe(175);
    });

    it('should return null for non-existent custom metric', () => {
      const metric = metricsService.getCustomMetric('non.existent');
      expect(metric).toBeNull();
    });
  });

  describe('Metrics Summary', () => {
    it('should return all metrics summary', () => {
      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        timestamp: new Date(),
      });

      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'Test error',
        timestamp: new Date(),
      });

      metricsService.recordJob({
        jobType: 'batch-analysis',
        jobId: 'job-123',
        duration: 5000,
        status: 'completed',
        timestamp: new Date(),
      });

      metricsService.recordCustomMetric('custom.metric', 100);

      const allMetrics = metricsService.getAllMetrics();
      expect(allMetrics.responseTimes.count).toBe(1);
      expect(allMetrics.errors.totalErrors).toBe(1);
      expect(allMetrics.jobs.totalJobs).toBe(1);
      expect(allMetrics.custom['custom.metric'].count).toBe(1);
    });
  });

  describe('Metrics Management', () => {
    it('should clear all metrics', () => {
      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        timestamp: new Date(),
      });

      metricsService.clear();

      const count = metricsService.getMetricsCount();
      expect(count.responseTimes).toBe(0);
      expect(count.errors).toBe(0);
      expect(count.jobs).toBe(0);
      expect(count.custom).toBe(0);
    });

    it('should return metrics count', () => {
      metricsService.recordResponseTime({
        path: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        timestamp: new Date(),
      });

      metricsService.recordError({
        path: '/api/test',
        method: 'GET',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'Test error',
        timestamp: new Date(),
      });

      const count = metricsService.getMetricsCount();
      expect(count.responseTimes).toBe(1);
      expect(count.errors).toBe(1);
    });
  });

  describe('Percentile Calculations', () => {
    it('should calculate percentiles correctly', () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1);
      
      durations.forEach(duration => {
        metricsService.recordResponseTime({
          path: '/api/test',
          method: 'GET',
          statusCode: 200,
          duration,
          timestamp: new Date(),
        });
      });

      const metrics = metricsService.getResponseTimeMetrics();
      expect(metrics.p50).toBeGreaterThanOrEqual(45);
      expect(metrics.p50).toBeLessThanOrEqual(55);
      expect(metrics.p95).toBeGreaterThanOrEqual(90);
      expect(metrics.p99).toBeGreaterThanOrEqual(95);
    });
  });
});
