import { 
  IPerformanceMonitor, 
  IMetricsCollector, 
  DatabaseMetrics, 
  APIMetrics, 
  FrontendMetrics 
} from './interfaces.js';
import { MetricsCollector } from './MetricsCollector.js';
import { InMemoryMetricsStorage } from './InMemoryMetricsStorage.js';

/**
 * Main performance monitoring system
 * Coordinates multiple metric collectors and provides unified access
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private collectors: Map<string, IMetricsCollector> = new Map();
  private isMonitoring: boolean = false;
  private defaultCollector: IMetricsCollector;

  constructor(options?: {
    maxMetrics?: number;
    retentionHours?: number;
    bufferSize?: number;
    flushIntervalMs?: number;
  }) {
    // Create default storage and collector
    const storage = new InMemoryMetricsStorage({
      maxMetrics: options?.maxMetrics,
      retentionHours: options?.retentionHours
    });

    this.defaultCollector = new MetricsCollector(storage, {
      bufferSize: options?.bufferSize,
      flushIntervalMs: options?.flushIntervalMs
    });

    this.collectors.set('default', this.defaultCollector);
  }

  async start(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('Performance monitoring started');
  }

  async stop(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    // Flush all collectors
    for (const collector of this.collectors.values()) {
      if (collector instanceof MetricsCollector) {
        await collector.flush();
      }
    }

    console.log('Performance monitoring stopped');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  async getSnapshot(): Promise<{
    database: Partial<DatabaseMetrics>;
    api: Partial<APIMetrics>;
    frontend: Partial<FrontendMetrics>;
  }> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Get recent metrics for each category
    const [databaseMetrics, apiMetrics, frontendMetrics] = await Promise.all([
      this.defaultCollector.getMetrics('database', oneMinuteAgo, now),
      this.defaultCollector.getMetrics('api', oneMinuteAgo, now),
      this.defaultCollector.getMetrics('frontend', oneMinuteAgo, now)
    ]);

    return {
      database: this.aggregateMetrics(databaseMetrics) as Partial<DatabaseMetrics>,
      api: this.aggregateMetrics(apiMetrics) as Partial<APIMetrics>,
      frontend: this.aggregateMetrics(frontendMetrics) as Partial<FrontendMetrics>
    };
  }

  registerCollector(name: string, collector: IMetricsCollector): void {
    if (this.collectors.has(name)) {
      throw new Error(`Collector with name '${name}' already exists`);
    }

    this.collectors.set(name, collector);
  }

  unregisterCollector(name: string): void {
    if (name === 'default') {
      throw new Error('Cannot unregister the default collector');
    }

    this.collectors.delete(name);
  }

  /**
   * Get the default metrics collector
   */
  getDefaultCollector(): IMetricsCollector {
    return this.defaultCollector;
  }

  /**
   * Get a specific collector by name
   */
  getCollector(name: string): IMetricsCollector | undefined {
    return this.collectors.get(name);
  }

  /**
   * Get all registered collector names
   */
  getCollectorNames(): string[] {
    return Array.from(this.collectors.keys());
  }

  /**
   * Record a database performance metric
   */
  async recordDatabaseMetric(metric: Omit<DatabaseMetrics, 'timestamp' | 'category'>): Promise<void> {
    if (!this.isMonitoring) return;

    await this.defaultCollector.collect({
      ...metric,
      category: 'database',
      timestamp: new Date()
    });
  }

  /**
   * Record an API performance metric
   */
  async recordAPIMetric(metric: Omit<APIMetrics, 'timestamp' | 'category'>): Promise<void> {
    if (!this.isMonitoring) return;

    await this.defaultCollector.collect({
      ...metric,
      category: 'api',
      timestamp: new Date()
    });
  }

  /**
   * Record a frontend performance metric
   */
  async recordFrontendMetric(metric: Omit<FrontendMetrics, 'timestamp' | 'category'>): Promise<void> {
    if (!this.isMonitoring) return;

    await this.defaultCollector.collect({
      ...metric,
      category: 'frontend',
      timestamp: new Date()
    });
  }

  /**
   * Get performance statistics for all categories
   */
  async getPerformanceStats(): Promise<{
    database: any;
    api: any;
    frontend: any;
    system: any;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [dbStats, apiStats, frontendStats] = await Promise.all([
      this.defaultCollector.getAggregatedMetrics('database', 'executionTime', oneHourAgo, now),
      this.defaultCollector.getAggregatedMetrics('api', 'responseTime', oneHourAgo, now),
      this.defaultCollector.getAggregatedMetrics('frontend', 'loadTime', oneHourAgo, now)
    ]);

    return {
      database: dbStats,
      api: apiStats,
      frontend: frontendStats,
      system: {
        isMonitoring: this.isMonitoring,
        collectorsCount: this.collectors.size,
        uptime: process.uptime()
      }
    };
  }

  /**
   * Cleanup old metrics across all collectors
   */
  async cleanupOldMetrics(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    let totalCleaned = 0;

    for (const collector of this.collectors.values()) {
      totalCleaned += await collector.cleanup(cutoffTime);
    }

    return totalCleaned;
  }

  /**
   * Aggregate metrics for snapshot
   */
  private aggregateMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};

    const latest = metrics[0];
    const values = metrics.map(m => m.value);
    
    return {
      ...latest,
      aggregated: {
        count: metrics.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      }
    };
  }
}