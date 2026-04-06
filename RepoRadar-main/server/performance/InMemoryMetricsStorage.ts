import { IMetricsStorage, PerformanceMetrics, MetricsFilter } from './interfaces.js';

/**
 * In-memory implementation of metrics storage
 * Suitable for development and small-scale deployments
 * For production, consider using a persistent storage solution
 */
export class InMemoryMetricsStorage implements IMetricsStorage {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics: number;
  private retentionHours: number;

  constructor(options?: {
    maxMetrics?: number;
    retentionHours?: number;
  }) {
    this.maxMetrics = options?.maxMetrics ?? 10000;
    this.retentionHours = options?.retentionHours ?? 24;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  async store(metric: PerformanceMetrics): Promise<void> {
    this.metrics.push(metric);
    this.enforceMaxMetrics();
  }

  async storeBatch(metrics: PerformanceMetrics[]): Promise<void> {
    this.metrics.push(...metrics);
    this.enforceMaxMetrics();
  }

  async retrieve(filter: MetricsFilter): Promise<PerformanceMetrics[]> {
    let filteredMetrics = [...this.metrics];

    // Filter by category
    if (filter.category) {
      filteredMetrics = filteredMetrics.filter(m => m.category === filter.category);
    }

    // Filter by metric name
    if (filter.metric) {
      filteredMetrics = filteredMetrics.filter(m => m.metric === filter.metric);
    }

    // Filter by time range
    if (filter.startTime) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= filter.endTime!);
    }

    // Sort by timestamp (newest first)
    filteredMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (filter.offset) {
      filteredMetrics = filteredMetrics.slice(filter.offset);
    }

    if (filter.limit) {
      filteredMetrics = filteredMetrics.slice(0, filter.limit);
    }

    return filteredMetrics;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= date);
    return initialCount - this.metrics.length;
  }

  async getStats(): Promise<{
    totalMetrics: number;
    oldestMetric: Date | null;
    newestMetric: Date | null;
    categoryCounts: Record<string, number>;
  }> {
    if (this.metrics.length === 0) {
      return {
        totalMetrics: 0,
        oldestMetric: null,
        newestMetric: null,
        categoryCounts: {}
      };
    }

    const timestamps = this.metrics.map(m => m.timestamp.getTime());
    const categoryCounts: Record<string, number> = {};

    this.metrics.forEach(metric => {
      categoryCounts[metric.category] = (categoryCounts[metric.category] || 0) + 1;
    });

    return {
      totalMetrics: this.metrics.length,
      oldestMetric: new Date(Math.min(...timestamps)),
      newestMetric: new Date(Math.max(...timestamps)),
      categoryCounts
    };
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): {
    metricsCount: number;
    maxMetrics: number;
    utilizationPercent: number;
    estimatedMemoryMB: number;
  } {
    const estimatedMemoryMB = (this.metrics.length * 0.5) / 1024; // Rough estimate
    
    return {
      metricsCount: this.metrics.length,
      maxMetrics: this.maxMetrics,
      utilizationPercent: (this.metrics.length / this.maxMetrics) * 100,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100
    };
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for backup or analysis
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Import metrics from backup
   */
  importMetrics(metrics: PerformanceMetrics[]): void {
    this.metrics = [...metrics];
    this.enforceMaxMetrics();
  }

  /**
   * Enforce maximum metrics limit by removing oldest entries
   */
  private enforceMaxMetrics(): void {
    if (this.metrics.length > this.maxMetrics) {
      // Sort by timestamp and keep only the newest metrics
      this.metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      this.metrics = this.metrics.slice(0, this.maxMetrics);
    }
  }

  /**
   * Start automatic cleanup of old metrics
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - (this.retentionHours * 60 * 60 * 1000));
      this.deleteOlderThan(cutoffTime).catch(error => {
        console.error('Automatic metrics cleanup failed:', error);
      });
    }, 60 * 60 * 1000); // Run every hour
  }
}