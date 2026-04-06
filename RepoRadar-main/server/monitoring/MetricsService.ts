import { logger } from './Logger.js';

/**
 * Metrics Service
 * Collects and aggregates application metrics
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricsSummary {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ResponseTimeMetric {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

export interface ErrorMetric {
  path: string;
  method: string;
  errorCode: string;
  errorMessage: string;
  timestamp: Date;
}

export interface JobMetric {
  jobType: string;
  jobId: string;
  duration: number;
  status: 'completed' | 'failed';
  timestamp: Date;
}

class MetricsCollectionService {
  private responseTimeMetrics: ResponseTimeMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private jobMetrics: JobMetric[] = [];
  private customMetrics: Map<string, number[]> = new Map();
  
  // Retention settings
  private maxMetrics = 10000;
  private retentionMs = 24 * 60 * 60 * 1000; // 24 hours
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Record response time metric
   */
  recordResponseTime(metric: ResponseTimeMetric): void {
    this.responseTimeMetrics.push(metric);
    this.trimMetrics(this.responseTimeMetrics);
    
    logger.debug('Response time recorded', {
      path: metric.path,
      method: metric.method,
      duration: metric.duration,
      statusCode: metric.statusCode,
    });
  }

  /**
   * Record error metric
   */
  recordError(metric: ErrorMetric): void {
    this.errorMetrics.push(metric);
    this.trimMetrics(this.errorMetrics);
    
    logger.debug('Error recorded', {
      path: metric.path,
      method: metric.method,
      errorCode: metric.errorCode,
    });
  }

  /**
   * Record job metric
   */
  recordJob(metric: JobMetric): void {
    this.jobMetrics.push(metric);
    this.trimMetrics(this.jobMetrics);
    
    logger.debug('Job metric recorded', {
      jobType: metric.jobType,
      jobId: metric.jobId,
      duration: metric.duration,
      status: metric.status,
    });
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name: string, value: number): void {
    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }
    
    const metrics = this.customMetrics.get(name)!;
    metrics.push(value);
    
    // Trim if too large
    if (metrics.length > this.maxMetrics) {
      metrics.splice(0, metrics.length - this.maxMetrics);
    }
  }

  /**
   * Get response time metrics summary
   */
  getResponseTimeMetrics(
    startTime?: Date,
    endTime?: Date,
    path?: string
  ): MetricsSummary {
    let metrics = this.responseTimeMetrics;
    
    // Filter by time range
    if (startTime || endTime) {
      metrics = metrics.filter(m => {
        if (startTime && m.timestamp < startTime) return false;
        if (endTime && m.timestamp > endTime) return false;
        return true;
      });
    }
    
    // Filter by path
    if (path) {
      metrics = metrics.filter(m => m.path === path);
    }
    
    const durations = metrics.map(m => m.duration);
    return this.calculateSummary(durations);
  }

  /**
   * Get error rate
   */
  getErrorRate(startTime?: Date, endTime?: Date): {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    errorsByCode: Record<string, number>;
  } {
    let errors = this.errorMetrics;
    let responses = this.responseTimeMetrics;
    
    // Filter by time range
    if (startTime || endTime) {
      errors = errors.filter(e => {
        if (startTime && e.timestamp < startTime) return false;
        if (endTime && e.timestamp > endTime) return false;
        return true;
      });
      
      responses = responses.filter(r => {
        if (startTime && r.timestamp < startTime) return false;
        if (endTime && r.timestamp > endTime) return false;
        return true;
      });
    }
    
    const totalRequests = responses.length;
    const totalErrors = errors.length;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    // Count errors by code
    const errorsByCode: Record<string, number> = {};
    for (const error of errors) {
      errorsByCode[error.errorCode] = (errorsByCode[error.errorCode] || 0) + 1;
    }
    
    return {
      totalRequests,
      totalErrors,
      errorRate,
      errorsByCode,
    };
  }

  /**
   * Get job metrics summary
   */
  getJobMetrics(startTime?: Date, endTime?: Date): {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
    avgDuration: number;
    durationByType: Record<string, MetricsSummary>;
  } {
    let jobs = this.jobMetrics;
    
    // Filter by time range
    if (startTime || endTime) {
      jobs = jobs.filter(j => {
        if (startTime && j.timestamp < startTime) return false;
        if (endTime && j.timestamp > endTime) return false;
        return true;
      });
    }
    
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const successRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    
    const durations = jobs.map(j => j.duration);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    // Calculate duration by job type
    const durationByType: Record<string, MetricsSummary> = {};
    const jobsByType = new Map<string, number[]>();
    
    for (const job of jobs) {
      if (!jobsByType.has(job.jobType)) {
        jobsByType.set(job.jobType, []);
      }
      jobsByType.get(job.jobType)!.push(job.duration);
    }
    
    for (const [type, durations] of jobsByType.entries()) {
      durationByType[type] = this.calculateSummary(durations);
    }
    
    return {
      totalJobs,
      completedJobs,
      failedJobs,
      successRate,
      avgDuration,
      durationByType,
    };
  }

  /**
   * Get custom metric summary
   */
  getCustomMetric(name: string): MetricsSummary | null {
    const values = this.customMetrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }
    
    return this.calculateSummary(values);
  }

  /**
   * Get all metrics summary
   */
  getAllMetrics(startTime?: Date, endTime?: Date): {
    responseTimes: MetricsSummary;
    errors: ReturnType<MetricsCollectionService['getErrorRate']>;
    jobs: ReturnType<MetricsCollectionService['getJobMetrics']>;
    custom: Record<string, MetricsSummary>;
  } {
    const custom: Record<string, MetricsSummary> = {};
    for (const [name, _] of this.customMetrics.entries()) {
      const summary = this.getCustomMetric(name);
      if (summary) {
        custom[name] = summary;
      }
    }
    
    return {
      responseTimes: this.getResponseTimeMetrics(startTime, endTime),
      errors: this.getErrorRate(startTime, endTime),
      jobs: this.getJobMetrics(startTime, endTime),
      custom,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.responseTimeMetrics = [];
    this.errorMetrics = [];
    this.jobMetrics = [];
    this.customMetrics.clear();
  }

  /**
   * Get metrics count
   */
  getMetricsCount(): {
    responseTimes: number;
    errors: number;
    jobs: number;
    custom: number;
  } {
    return {
      responseTimes: this.responseTimeMetrics.length,
      errors: this.errorMetrics.length,
      jobs: this.jobMetrics.length,
      custom: Array.from(this.customMetrics.values())
        .reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(values: number[]): MetricsSummary {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Trim metrics array to max size
   */
  private trimMetrics<T>(metrics: T[]): void {
    if (metrics.length > this.maxMetrics) {
      metrics.splice(0, metrics.length - this.maxMetrics);
    }
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startCleanup(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.retentionMs);
    
    this.responseTimeMetrics = this.responseTimeMetrics.filter(
      m => m.timestamp > cutoff
    );
    
    this.errorMetrics = this.errorMetrics.filter(
      m => m.timestamp > cutoff
    );
    
    this.jobMetrics = this.jobMetrics.filter(
      m => m.timestamp > cutoff
    );
    
    logger.debug('Old metrics cleaned up', {
      cutoff: cutoff.toISOString(),
    });
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsCollectionService();
