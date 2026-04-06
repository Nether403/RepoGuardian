import { logger } from './Logger.js';
import { metricsService } from './MetricsService.js';

/**
 * Performance Tracker
 * Monitors performance of critical code paths
 */

export interface PerformanceTrackingOptions {
  name: string;
  threshold?: number; // Log warning if exceeds this (ms)
  recordMetric?: boolean;
}

/**
 * Track performance of async function
 */
export async function trackPerformance<T>(
  options: PerformanceTrackingOptions,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const { name, threshold, recordMetric = true } = options;
  
  try {
    logger.debug(`Starting: ${name}`);
    
    const result = await fn();
    
    const duration = Date.now() - startTime;
    
    // Log completion
    if (threshold && duration > threshold) {
      logger.warn(`Slow operation: ${name}`, {
        duration,
        threshold,
      });
    } else {
      logger.debug(`Completed: ${name}`, { duration });
    }
    
    // Record metric
    if (recordMetric) {
      metricsService.recordCustomMetric(name, duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(`Failed: ${name}`, error as Error, { duration });
    
    throw error;
  }
}

/**
 * Track performance of sync function
 */
export function trackPerformanceSync<T>(
  options: PerformanceTrackingOptions,
  fn: () => T
): T {
  const startTime = Date.now();
  const { name, threshold, recordMetric = true } = options;
  
  try {
    logger.debug(`Starting: ${name}`);
    
    const result = fn();
    
    const duration = Date.now() - startTime;
    
    // Log completion
    if (threshold && duration > threshold) {
      logger.warn(`Slow operation: ${name}`, {
        duration,
        threshold,
      });
    } else {
      logger.debug(`Completed: ${name}`, { duration });
    }
    
    // Record metric
    if (recordMetric) {
      metricsService.recordCustomMetric(name, duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(`Failed: ${name}`, error as Error, { duration });
    
    throw error;
  }
}

/**
 * Performance timer class for manual tracking
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private threshold?: number;
  private recordMetric: boolean;
  
  constructor(options: PerformanceTrackingOptions) {
    this.name = options.name;
    this.threshold = options.threshold;
    this.recordMetric = options.recordMetric ?? true;
    this.startTime = Date.now();
    
    logger.debug(`Timer started: ${this.name}`);
  }
  
  /**
   * Stop timer and record metrics
   */
  stop(): number {
    const duration = Date.now() - this.startTime;
    
    // Log completion
    if (this.threshold && duration > this.threshold) {
      logger.warn(`Slow operation: ${this.name}`, {
        duration,
        threshold: this.threshold,
      });
    } else {
      logger.debug(`Timer stopped: ${this.name}`, { duration });
    }
    
    // Record metric
    if (this.recordMetric) {
      metricsService.recordCustomMetric(this.name, duration);
    }
    
    return duration;
  }
  
  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Decorator for tracking method performance
 */
export function TrackPerformance(options: PerformanceTrackingOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const name = options.name || `${target.constructor.name}.${propertyKey}`;
      
      return trackPerformance(
        { ...options, name },
        () => originalMethod.apply(this, args)
      );
    };
    
    return descriptor;
  };
}

/**
 * Create a performance checkpoint
 */
export class PerformanceCheckpoint {
  private checkpoints: Map<string, number> = new Map();
  private startTime: number;
  private name: string;
  
  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
    this.checkpoints.set('start', this.startTime);
    
    logger.debug(`Checkpoint started: ${name}`);
  }
  
  /**
   * Mark a checkpoint
   */
  mark(label: string): void {
    const now = Date.now();
    this.checkpoints.set(label, now);
    
    const duration = now - this.startTime;
    logger.debug(`Checkpoint: ${this.name}.${label}`, { duration });
  }
  
  /**
   * Get duration between checkpoints
   */
  getDuration(from: string, to: string): number | null {
    const fromTime = this.checkpoints.get(from);
    const toTime = this.checkpoints.get(to);
    
    if (!fromTime || !toTime) {
      return null;
    }
    
    return toTime - fromTime;
  }
  
  /**
   * Get all checkpoint durations
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    const checkpointArray = Array.from(this.checkpoints.entries());
    
    for (let i = 1; i < checkpointArray.length; i++) {
      const [label, time] = checkpointArray[i];
      const [prevLabel, prevTime] = checkpointArray[i - 1];
      summary[`${prevLabel}->${label}`] = time - prevTime;
    }
    
    summary['total'] = Date.now() - this.startTime;
    
    return summary;
  }
  
  /**
   * Complete and log summary
   */
  complete(): void {
    const summary = this.getSummary();
    
    logger.info(`Checkpoint complete: ${this.name}`, summary);
    
    // Record total duration
    metricsService.recordCustomMetric(this.name, summary.total);
  }
}
