/**
 * Example usage of the Performance Monitoring System
 * This file demonstrates how to integrate performance monitoring
 * into your application
 */

import { 
  initializePerformanceMonitoring, 
  getGlobalPerformanceMonitor,
  shutdownPerformanceMonitoring 
} from './index.js';

async function exampleUsage() {
  // Initialize performance monitoring
  const monitor = await initializePerformanceMonitoring();
  
  console.log('Performance monitoring started:', monitor.isActive());

  // Example: Record database performance metrics
  await monitor.recordDatabaseMetric({
    metric: 'query_execution_time',
    value: 150,
    queryId: 'user-lookup-123',
    executionTime: 150,
    connectionPoolSize: 10,
    activeConnections: 3,
    threshold: 1000 // Alert if query takes longer than 1000ms
  });

  // Example: Record API performance metrics
  await monitor.recordAPIMetric({
    metric: 'api_response_time',
    value: 250,
    endpoint: '/api/repositories',
    responseTime: 250,
    cacheHit: false,
    compressionRatio: 0.7,
    threshold: 500 // Alert if response takes longer than 500ms
  });

  // Example: Record frontend performance metrics
  await monitor.recordFrontendMetric({
    metric: 'bundle_load_time',
    value: 800,
    bundleName: 'main.js',
    loadTime: 800,
    bundleSize: 245760, // bytes
    cacheStatus: 'miss',
    threshold: 1000 // Alert if bundle takes longer than 1000ms to load
  });

  // Wait a moment for metrics to be processed
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get current performance snapshot
  const snapshot = await monitor.getSnapshot();
  console.log('Performance Snapshot:', JSON.stringify(snapshot, null, 2));

  // Get performance statistics
  const stats = await monitor.getPerformanceStats();
  console.log('Performance Statistics:', JSON.stringify(stats, null, 2));

  // Get metrics for a specific category
  const collector = monitor.getDefaultCollector();
  const databaseMetrics = await collector.getMetrics('database');
  console.log('Database Metrics:', databaseMetrics.length, 'metrics collected');

  // Get aggregated metrics
  const aggregated = await collector.getAggregatedMetrics(
    'database', 
    'query_execution_time'
  );
  console.log('Database Query Aggregation:', aggregated);

  // Cleanup old metrics (older than 1 hour)
  const cleanedCount = await monitor.cleanupOldMetrics(1);
  console.log('Cleaned up', cleanedCount, 'old metrics');

  // Shutdown monitoring
  await shutdownPerformanceMonitoring();
  console.log('Performance monitoring stopped');
}

// Example middleware for Express.js integration
export function createPerformanceMiddleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const monitor = getGlobalPerformanceMonitor();

    // Continue with request processing
    res.on('finish', async () => {
      const responseTime = Date.now() - startTime;
      
      // Record API performance metric
      await monitor.recordAPIMetric({
        metric: 'api_response_time',
        value: responseTime,
        endpoint: req.path,
        responseTime,
        cacheHit: res.get('X-Cache-Status') === 'HIT',
        metadata: {
          method: req.method,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent')
        }
      });
    });

    next();
  };
}

// Example database query wrapper
export function createDatabaseQueryWrapper(originalQuery: Function) {
  return async function wrappedQuery(...args: any[]) {
    const startTime = Date.now();
    const monitor = getGlobalPerformanceMonitor();
    
    try {
      const result = await originalQuery.apply(this, args);
      const executionTime = Date.now() - startTime;
      
      // Record database performance metric
      await monitor.recordDatabaseMetric({
        metric: 'query_execution_time',
        value: executionTime,
        queryId: `query-${Date.now()}`,
        executionTime,
        connectionPoolSize: 10, // Get from actual pool
        activeConnections: 5,   // Get from actual pool
        metadata: {
          query: args[0]?.substring(0, 100), // First 100 chars of query
          params: args[1]
        }
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record failed query metric
      await monitor.recordDatabaseMetric({
        metric: 'query_execution_time',
        value: executionTime,
        queryId: `failed-query-${Date.now()}`,
        executionTime,
        connectionPoolSize: 10,
        activeConnections: 5,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          query: args[0]?.substring(0, 100)
        }
      });

      throw error;
    }
  };
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error);
}