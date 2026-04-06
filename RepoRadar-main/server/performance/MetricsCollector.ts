import { 
  IMetricsCollector, 
  IMetricsStorage, 
  PerformanceMetrics, 
  MetricsFilter 
} from './interfaces.js';

/**
 * Base implementation of metrics collector
 * Handles metric collection, validation, and storage coordination
 */
export class MetricsCollector implements IMetricsCollector {
  private storage: IMetricsStorage;
  private isEnabled: boolean = true;
  private metricsBuffer: PerformanceMetrics[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(storage: IMetricsStorage, options?: {
    bufferSize?: number;
    flushIntervalMs?: number;
    enabled?: boolean;
  }) {
    this.storage = storage;
    this.bufferSize = options?.bufferSize ?? 100;
    this.isEnabled = options?.enabled ?? true;
    
    if (options?.flushIntervalMs) {
      this.startAutoFlush(options.flushIntervalMs);
    }
  }

  async collect(metric: PerformanceMetrics): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Validate metric
    this.validateMetric(metric);
    
    // Add to buffer
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || new Date()
    });

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async collectBatch(metrics: PerformanceMetrics[]): Promise<void> {
    if (!this.isEnabled || metrics.length === 0) {
      return;
    }

    // Validate all metrics
    metrics.forEach(metric => this.validateMetric(metric));
    
    // Add timestamps if missing
    const timestampedMetrics = metrics.map(metric => ({
      ...metric,
      timestamp: metric.timestamp || new Date()
    }));

    this.metricsBuffer.push(...timestampedMetrics);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async getMetrics(
    category?: PerformanceMetrics['category'],
    startTime?: Date,
    endTime?: Date
  ): Promise<PerformanceMetrics[]> {
    const filter: MetricsFilter = {
      category,
      startTime,
      endTime
    };

    return await this.storage.retrieve(filter);
  }

  async getAggregatedMetrics(
    category: PerformanceMetrics['category'],
    metric: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    avg: number;
    min: number;
    max: number;
    count: number;
  }> {
    const metrics = await this.getMetrics(category, startTime, endTime);
    const filteredMetrics = metrics.filter(m => m.metric === metric);
    
    if (filteredMetrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const values = filteredMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  async cleanup(olderThan: Date): Promise<number> {
    // Flush any pending metrics first
    await this.flush();
    
    return await this.storage.deleteOlderThan(olderThan);
  }

  /**
   * Enable or disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get current buffer status
   */
  getBufferStatus(): { size: number; maxSize: number; utilizationPercent: number } {
    return {
      size: this.metricsBuffer.length,
      maxSize: this.bufferSize,
      utilizationPercent: (this.metricsBuffer.length / this.bufferSize) * 100
    };
  }

  /**
   * Manually flush the metrics buffer
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.storage.storeBatch(metricsToFlush);
    } catch (error) {
      // Re-add metrics to buffer on failure
      this.metricsBuffer.unshift(...metricsToFlush);
      throw error;
    }
  }

  /**
   * Start automatic buffer flushing
   */
  private startAutoFlush(intervalMs: number): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Auto-flush failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic buffer flushing
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }

  /**
   * Validate metric structure and values
   */
  private validateMetric(metric: PerformanceMetrics): void {
    if (!metric.category || !['database', 'api', 'frontend'].includes(metric.category)) {
      throw new Error(`Invalid metric category: ${metric.category}`);
    }

    if (!metric.metric || typeof metric.metric !== 'string') {
      throw new Error('Metric name is required and must be a string');
    }

    if (typeof metric.value !== 'number' || isNaN(metric.value)) {
      throw new Error('Metric value must be a valid number');
    }

    if (metric.threshold !== undefined && (typeof metric.threshold !== 'number' || isNaN(metric.threshold))) {
      throw new Error('Metric threshold must be a valid number if provided');
    }
  }
}