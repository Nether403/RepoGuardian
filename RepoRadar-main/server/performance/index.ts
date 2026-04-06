/**
 * Performance Monitoring System for RepoRadar
 * 
 * This module provides comprehensive performance monitoring capabilities
 * including metrics collection, storage, and analysis for database, API,
 * and frontend performance.
 */

// Interfaces
export * from './interfaces.js';

// Core implementations
export { MetricsCollector } from './MetricsCollector.js';
export { InMemoryMetricsStorage } from './InMemoryMetricsStorage.js';
export { PerformanceMonitor } from './PerformanceMonitor.js';

// Database performance
export { ConnectionPool } from './ConnectionPool.js';
export { IndexManager } from './IndexManager.js';
export { QueryMonitor } from './QueryMonitor.js';

// Cache management
export { InMemoryCacheManager, createCacheManager } from './CacheManager.js';

// Compression middleware
export { CompressionMiddleware, createCompressionMiddleware } from './CompressionMiddleware.js';

// GitHub API optimization
export { GitHubOptimizer, createGitHubOptimizer, OptimizedGitHubService } from './GitHubOptimizer.js';

// Pagination middleware
export { PaginationMiddleware, defaultPagination, repositoryPagination, analysisPagination, searchPagination } from './PaginationMiddleware.js';

// API and Streaming
export { MetricsAPI, createMetricsAPI } from './MetricsAPI.js';
export { MetricsStreamingService, EnhancedWebSocketService, createEnhancedWebSocketService } from './MetricsStreaming.js';

// Alerting System
export { 
  PerformanceAlertingSystem, 
  ConsoleAlertDelivery, 
  WebSocketAlertDelivery,
  createAlertingSystem,
  type AlertConfig,
  type PerformanceAlert,
  type IAlertDelivery
} from './AlertingSystem.js';

// Convenience factory function
import { PerformanceMonitor } from './PerformanceMonitor.js';

/**
 * Create a new performance monitor instance with default configuration
 */
export function createPerformanceMonitor(options?: {
  maxMetrics?: number;
  retentionHours?: number;
  bufferSize?: number;
  flushIntervalMs?: number;
}): PerformanceMonitor {
  return new PerformanceMonitor(options);
}

/**
 * Global performance monitor instance
 * Can be used across the application for centralized monitoring
 */
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor instance
 */
export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = createPerformanceMonitor({
      maxMetrics: 50000,
      retentionHours: 24,
      bufferSize: 100,
      flushIntervalMs: 30000 // Flush every 30 seconds
    });
  }
  return globalMonitor;
}

/**
 * Initialize global performance monitoring
 */
export async function initializePerformanceMonitoring(): Promise<PerformanceMonitor> {
  const monitor = getGlobalPerformanceMonitor();
  await monitor.start();
  return monitor;
}

/**
 * Shutdown global performance monitoring
 */
export async function shutdownPerformanceMonitoring(): Promise<void> {
  if (globalMonitor) {
    await globalMonitor.stop();
    globalMonitor = null;
  }
}