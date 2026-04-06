/**
 * Performance Metrics Collection Module
 * Tracks request duration, database query performance, and cache hit rates
 * Requirements: 10.5
 */

import { config } from '../config';

/**
 * Metric types
 */
export type MetricType = 'request' | 'database' | 'cache' | 'api';

/**
 * Request metric
 */
export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  userId?: number;
}

/**
 * Database query metric
 */
export interface DatabaseMetric {
  query: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * Cache metric
 */
export interface CacheMetric {
  operation: 'hit' | 'miss' | 'set' | 'delete';
  key: string;
  duration: number;
  timestamp: number;
}

/**
 * API call metric
 */
export interface APIMetric {
  service: string;
  endpoint: string;
  duration: number;
  timestamp: number;
  success: boolean;
  statusCode?: number;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  requests: {
    total: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    byStatusCode: Record<number, number>;
    byPath: Record<string, { count: number; avgDuration: number }>;
  };
  database: {
    total: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    slowQueries: number;
    failedQueries: number;
    slowestQueries: Array<{ query: string; duration: number }>;
  };
  cache: {
    total: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgDuration: number;
  };
  api: {
    total: number;
    avgDuration: number;
    failedCalls: number;
    byService: Record<string, { count: number; avgDuration: number; failures: number }>;
  };
}

/**
 * Performance metrics collector
 */
class MetricsCollector {
  private requestMetrics: RequestMetric[] = [];
  private databaseMetrics: DatabaseMetric[] = [];
  private cacheMetrics: CacheMetric[] = [];
  private apiMetrics: APIMetric[] = [];
  
  private maxMetrics: number;
  private retentionMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    const monitoring = config.getMonitoring();
    this.maxMetrics = monitoring.metricsCollection.batchSize;
    this.retentionMs = monitoring.metricsCollection.retentionDays * 24 * 60 * 60 * 1000;
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startCleanup(): void {
    const monitoring = config.getMonitoring();
    const intervalMs = monitoring.metricsCollection.interval * 1000;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionMs;

    this.requestMetrics = this.requestMetrics.filter(m => m.timestamp > cutoff);
    this.databaseMetrics = this.databaseMetrics.filter(m => m.timestamp > cutoff);
    this.cacheMetrics = this.cacheMetrics.filter(m => m.timestamp > cutoff);
    this.apiMetrics = this.apiMetrics.filter(m => m.timestamp > cutoff);

    // Also enforce max metrics limit
    if (this.requestMetrics.length > this.maxMetrics) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetrics);
    }
    if (this.databaseMetrics.length > this.maxMetrics) {
      this.databaseMetrics = this.databaseMetrics.slice(-this.maxMetrics);
    }
    if (this.cacheMetrics.length > this.maxMetrics) {
      this.cacheMetrics = this.cacheMetrics.slice(-this.maxMetrics);
    }
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record request metric
   */
  public recordRequest(metric: RequestMetric): void {
    const monitoring = config.getMonitoring();
    if (!monitoring.enabled) return;
    
    this.requestMetrics.push(metric);
    
    // Check alerting thresholds
    if (monitoring.alerting.enabled) {
      if (metric.duration > monitoring.alerting.thresholds.apiResponseTime) {
        this.triggerAlert('api_response_time', {
          message: `Slow API response: ${metric.method} ${metric.path} took ${metric.duration}ms`,
          threshold: monitoring.alerting.thresholds.apiResponseTime,
          actual: metric.duration,
          metric,
        });
      }
    }
  }

  /**
   * Record database query metric
   */
  public recordDatabaseQuery(metric: DatabaseMetric): void {
    const monitoring = config.getMonitoring();
    if (!monitoring.enabled) return;
    
    this.databaseMetrics.push(metric);
    
    // Check alerting thresholds
    if (monitoring.alerting.enabled) {
      if (metric.duration > monitoring.alerting.thresholds.databaseQueryTime) {
        this.triggerAlert('database_query_time', {
          message: `Slow database query: ${metric.query.substring(0, 100)} took ${metric.duration}ms`,
          threshold: monitoring.alerting.thresholds.databaseQueryTime,
          actual: metric.duration,
          metric,
        });
      }
    }
  }

  /**
   * Record cache operation metric
   */
  public recordCacheOperation(metric: CacheMetric): void {
    const monitoring = config.getMonitoring();
    if (!monitoring.enabled) return;
    
    this.cacheMetrics.push(metric);
  }

  /**
   * Record API call metric
   */
  public recordAPICall(metric: APIMetric): void {
    const monitoring = config.getMonitoring();
    if (!monitoring.enabled) return;
    
    this.apiMetrics.push(metric);
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(): AggregatedMetrics {
    return {
      requests: this.aggregateRequestMetrics(),
      database: this.aggregateDatabaseMetrics(),
      cache: this.aggregateCacheMetrics(),
      api: this.aggregateAPIMetrics(),
    };
  }

  /**
   * Aggregate request metrics
   */
  private aggregateRequestMetrics() {
    if (this.requestMetrics.length === 0) {
      return {
        total: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        byStatusCode: {},
        byPath: {},
      };
    }

    const durations = this.requestMetrics.map(m => m.duration).sort((a, b) => a - b);
    const total = this.requestMetrics.length;
    
    // Calculate percentiles
    const p50Index = Math.floor(total * 0.5);
    const p95Index = Math.floor(total * 0.95);
    const p99Index = Math.floor(total * 0.99);

    // Group by status code
    const byStatusCode: Record<number, number> = {};
    for (const metric of this.requestMetrics) {
      byStatusCode[metric.statusCode] = (byStatusCode[metric.statusCode] || 0) + 1;
    }

    // Group by path
    const byPath: Record<string, { count: number; totalDuration: number }> = {};
    for (const metric of this.requestMetrics) {
      if (!byPath[metric.path]) {
        byPath[metric.path] = { count: 0, totalDuration: 0 };
      }
      byPath[metric.path].count++;
      byPath[metric.path].totalDuration += metric.duration;
    }

    const byPathFormatted: Record<string, { count: number; avgDuration: number }> = {};
    for (const [path, data] of Object.entries(byPath)) {
      byPathFormatted[path] = {
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
      };
    }

    return {
      total,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / total),
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50Duration: durations[p50Index],
      p95Duration: durations[p95Index],
      p99Duration: durations[p99Index],
      byStatusCode,
      byPath: byPathFormatted,
    };
  }

  /**
   * Aggregate database metrics
   */
  private aggregateDatabaseMetrics() {
    if (this.databaseMetrics.length === 0) {
      return {
        total: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowQueries: 0,
        failedQueries: 0,
        slowestQueries: [],
      };
    }

    const durations = this.databaseMetrics.map(m => m.duration).sort((a, b) => a - b);
    const total = this.databaseMetrics.length;
    const monitoring = config.getMonitoring();
    const slowQueryThreshold = monitoring.alerting.thresholds.databaseQueryTime;
    
    const slowQueries = this.databaseMetrics.filter(m => m.duration > slowQueryThreshold).length;
    const failedQueries = this.databaseMetrics.filter(m => !m.success).length;

    // Get top 5 slowest queries
    const slowestQueries = [...this.databaseMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(m => ({
        query: m.query.substring(0, 100) + (m.query.length > 100 ? '...' : ''),
        duration: m.duration,
      }));

    return {
      total,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / total),
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      slowQueries,
      failedQueries,
      slowestQueries,
    };
  }

  /**
   * Aggregate cache metrics
   */
  private aggregateCacheMetrics() {
    if (this.cacheMetrics.length === 0) {
      return {
        total: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgDuration: 0,
      };
    }

    const total = this.cacheMetrics.length;
    const hits = this.cacheMetrics.filter(m => m.operation === 'hit').length;
    const misses = this.cacheMetrics.filter(m => m.operation === 'miss').length;
    const hitRate = total > 0 ? (hits / (hits + misses)) * 100 : 0;
    
    const durations = this.cacheMetrics.map(m => m.duration);
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Check cache hit rate threshold
    const monitoring = config.getMonitoring();
    if (monitoring.alerting.enabled) {
      if (hitRate < monitoring.alerting.thresholds.cacheHitRate && (hits + misses) > 10) {
        this.triggerAlert('cache_hit_rate', {
          message: `Low cache hit rate: ${hitRate.toFixed(1)}%`,
          threshold: monitoring.alerting.thresholds.cacheHitRate,
          actual: hitRate,
        });
      }
    }

    return {
      total,
      hits,
      misses,
      hitRate: Math.round(hitRate * 10) / 10,
      avgDuration,
    };
  }

  /**
   * Aggregate API metrics
   */
  private aggregateAPIMetrics() {
    if (this.apiMetrics.length === 0) {
      return {
        total: 0,
        avgDuration: 0,
        failedCalls: 0,
        byService: {},
      };
    }

    const total = this.apiMetrics.length;
    const failedCalls = this.apiMetrics.filter(m => !m.success).length;
    
    const durations = this.apiMetrics.map(m => m.duration);
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / total);

    // Group by service
    const byService: Record<string, { count: number; totalDuration: number; failures: number }> = {};
    for (const metric of this.apiMetrics) {
      if (!byService[metric.service]) {
        byService[metric.service] = { count: 0, totalDuration: 0, failures: 0 };
      }
      byService[metric.service].count++;
      byService[metric.service].totalDuration += metric.duration;
      if (!metric.success) {
        byService[metric.service].failures++;
      }
    }

    const byServiceFormatted: Record<string, { count: number; avgDuration: number; failures: number }> = {};
    for (const [service, data] of Object.entries(byService)) {
      byServiceFormatted[service] = {
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
        failures: data.failures,
      };
    }

    return {
      total,
      avgDuration,
      failedCalls,
      byService: byServiceFormatted,
    };
  }

  /**
   * Trigger alert
   */
  private triggerAlert(type: string, data: any): void {
    const monitoring = config.getMonitoring();
    const channels = monitoring.alerting.channels;
    
    for (const channel of channels) {
      switch (channel) {
        case 'console':
          console.warn(`[ALERT] ${type}:`, data.message);
          break;
        case 'webhook':
          // TODO: Implement webhook alerting
          break;
        case 'email':
          // TODO: Implement email alerting
          break;
      }
    }
  }

  /**
   * Reset all metrics (for testing)
   */
  public reset(): void {
    this.requestMetrics = [];
    this.databaseMetrics = [];
    this.cacheMetrics = [];
    this.apiMetrics = [];
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
