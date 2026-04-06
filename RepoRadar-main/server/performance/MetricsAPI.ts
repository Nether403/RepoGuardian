import { Router, Request, Response } from 'express';
import { 
  PerformanceMetrics, 
  MetricsFilter,
  IMetricsCollector,
  IPerformanceMonitor 
} from './interfaces.js';
import { getGlobalPerformanceMonitor } from './index.js';
import { WebSocketService } from '../websocket.js';

/**
 * Performance Metrics API endpoints
 * Provides REST API for performance data retrieval and management
 */
export class MetricsAPI {
  private router: Router;
  private monitor: IPerformanceMonitor;
  private wsService?: WebSocketService;

  constructor(monitor?: IPerformanceMonitor, wsService?: WebSocketService) {
    this.router = Router();
    this.monitor = monitor || getGlobalPerformanceMonitor();
    this.wsService = wsService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get performance metrics with filtering
    this.router.get('/metrics', this.getMetrics.bind(this));
    
    // Get aggregated metrics
    this.router.get('/metrics/aggregated', this.getAggregatedMetrics.bind(this));
    
    // Get performance snapshot
    this.router.get('/snapshot', this.getSnapshot.bind(this));
    
    // Get performance statistics
    this.router.get('/stats', this.getStats.bind(this));
    
    // Get metrics by category
    this.router.get('/metrics/:category', this.getMetricsByCategory.bind(this));
    
    // Get system health
    this.router.get('/health', this.getHealth.bind(this));
    
    // Cleanup old metrics
    this.router.delete('/metrics/cleanup', this.cleanupMetrics.bind(this));
    
    // Get collector information
    this.router.get('/collectors', this.getCollectors.bind(this));
    
    // Get real-time metrics stream info
    this.router.get('/stream/info', this.getStreamInfo.bind(this));
  }

  /**
   * GET /api/performance/metrics
   * Retrieve performance metrics with optional filtering
   */
  private async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        metric,
        startTime,
        endTime,
        limit = 100,
        offset = 0
      } = req.query;

      const filter: MetricsFilter = {
        category: category as PerformanceMetrics['category'],
        metric: metric as string,
        startTime: startTime ? new Date(startTime as string) : undefined,
        endTime: endTime ? new Date(endTime as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const collector = this.monitor.getDefaultCollector();
      let metrics = await collector.getMetrics(
        filter.category,
        filter.startTime,
        filter.endTime
      );

      // Apply metric name filtering if specified
      if (filter.metric) {
        metrics = metrics.filter(m => m.metric === filter.metric);
      }

      // Apply pagination
      const paginatedMetrics = metrics.slice(filter.offset, filter.offset! + filter.limit!);

      res.json({
        metrics: paginatedMetrics,
        pagination: {
          total: metrics.length,
          limit: filter.limit,
          offset: filter.offset,
          hasMore: (filter.offset! + filter.limit!) < metrics.length
        },
        filter
      });
    } catch (error) {
      console.error('Error retrieving metrics:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/metrics/aggregated
   * Get aggregated metrics (avg, min, max, count)
   */
  private async getAggregatedMetrics(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        metric,
        startTime,
        endTime,
        groupBy = 'hour' // hour, day, week
      } = req.query;

      if (!category || !metric) {
        res.status(400).json({ 
          error: 'Category and metric parameters are required' 
        });
        return;
      }

      const collector = this.monitor.getDefaultCollector();
      const aggregated = await collector.getAggregatedMetrics(
        category as PerformanceMetrics['category'],
        metric as string,
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined
      );

      // Get time-series data for charting
      const timeSeries = await this.getTimeSeriesData(
        category as PerformanceMetrics['category'],
        metric as string,
        startTime ? new Date(startTime as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime ? new Date(endTime as string) : new Date(),
        groupBy as string
      );

      res.json({
        aggregated,
        timeSeries,
        category,
        metric,
        groupBy
      });
    } catch (error) {
      console.error('Error retrieving aggregated metrics:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve aggregated metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/snapshot
   * Get current performance snapshot
   */
  private async getSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const snapshot = await this.monitor.getSnapshot();
      
      res.json({
        snapshot,
        timestamp: new Date().toISOString(),
        isMonitoring: this.monitor.isActive()
      });
    } catch (error) {
      console.error('Error retrieving performance snapshot:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve performance snapshot',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/stats
   * Get comprehensive performance statistics
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      // Get stats from monitor if it has the method
      let stats;
      if ('getPerformanceStats' in this.monitor) {
        stats = await (this.monitor as any).getPerformanceStats();
      } else {
        // Fallback to basic stats
        const snapshot = await this.monitor.getSnapshot();
        stats = {
          database: snapshot.database,
          api: snapshot.api,
          frontend: snapshot.frontend,
          system: {
            isMonitoring: this.monitor.isActive(),
            collectorsCount: this.monitor.getCollectorNames().length,
            uptime: process.uptime()
          }
        };
      }

      res.json({
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving performance stats:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve performance stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/metrics/:category
   * Get metrics for a specific category
   */
  private async getMetricsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const { limit = 50, startTime, endTime } = req.query;

      if (!['database', 'api', 'frontend'].includes(category)) {
        res.status(400).json({ 
          error: 'Invalid category. Must be database, api, or frontend' 
        });
        return;
      }

      const collector = this.monitor.getDefaultCollector();
      const metrics = await collector.getMetrics(
        category as PerformanceMetrics['category'],
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined
      );

      const limitedMetrics = metrics.slice(0, parseInt(limit as string));

      res.json({
        category,
        metrics: limitedMetrics,
        total: metrics.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving category metrics:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve category metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/health
   * Get system health information
   */
  private async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const isActive = this.monitor.isActive();
      const collectors = this.monitor.getCollectorNames();
      
      // Get buffer status if available
      let bufferStatus;
      const defaultCollector = this.monitor.getDefaultCollector();
      if ('getBufferStatus' in defaultCollector) {
        bufferStatus = (defaultCollector as any).getBufferStatus();
      }

      const health = {
        status: isActive ? 'healthy' : 'inactive',
        monitoring: isActive,
        collectors: {
          count: collectors.length,
          names: collectors
        },
        buffer: bufferStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      res.json(health);
    } catch (error) {
      console.error('Error retrieving health status:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve health status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/performance/metrics/cleanup
   * Cleanup old metrics
   */
  private async cleanupMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { olderThanHours = 24 } = req.query;
      const hours = parseInt(olderThanHours as string);
      
      if (isNaN(hours) || hours < 1) {
        res.status(400).json({ 
          error: 'olderThanHours must be a positive number' 
        });
        return;
      }

      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const collector = this.monitor.getDefaultCollector();
      const deletedCount = await collector.cleanup(cutoffTime);

      res.json({
        message: 'Metrics cleanup completed',
        deletedCount,
        cutoffTime: cutoffTime.toISOString(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error cleaning up metrics:', error);
      res.status(500).json({ 
        error: 'Failed to cleanup metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/collectors
   * Get information about registered collectors
   */
  private async getCollectors(req: Request, res: Response): Promise<void> {
    try {
      const collectorNames = this.monitor.getCollectorNames();
      const collectors = collectorNames.map(name => ({
        name,
        isDefault: name === 'default'
      }));

      res.json({
        collectors,
        count: collectors.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving collectors info:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve collectors info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/performance/stream/info
   * Get information about real-time streaming capabilities
   */
  private async getStreamInfo(req: Request, res: Response): Promise<void> {
    try {
      const streamInfo = {
        available: !!this.wsService,
        events: [
          'performance_metric',
          'performance_alert',
          'performance_snapshot'
        ],
        instructions: {
          connect: 'Connect to WebSocket and emit "track_performance" event',
          disconnect: 'Emit "untrack_performance" event to stop receiving updates'
        },
        timestamp: new Date().toISOString()
      };

      res.json(streamInfo);
    } catch (error) {
      console.error('Error retrieving stream info:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve stream info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get time series data for charting
   */
  private async getTimeSeriesData(
    category: PerformanceMetrics['category'],
    metric: string,
    startTime: Date,
    endTime: Date,
    groupBy: string
  ): Promise<Array<{ timestamp: string; value: number; count: number }>> {
    const collector = this.monitor.getDefaultCollector();
    const metrics = await collector.getMetrics(category, startTime, endTime);
    const filteredMetrics = metrics.filter(m => m.metric === metric);

    // Group by time intervals
    const intervalMs = this.getIntervalMs(groupBy);
    const groups = new Map<number, { values: number[]; count: number }>();

    filteredMetrics.forEach(m => {
      const intervalStart = Math.floor(m.timestamp.getTime() / intervalMs) * intervalMs;
      const group = groups.get(intervalStart) || { values: [], count: 0 };
      group.values.push(m.value);
      group.count++;
      groups.set(intervalStart, group);
    });

    // Convert to time series format
    return Array.from(groups.entries())
      .map(([timestamp, group]) => ({
        timestamp: new Date(timestamp).toISOString(),
        value: group.values.reduce((a, b) => a + b, 0) / group.values.length,
        count: group.count
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get interval in milliseconds for groupBy parameter
   */
  private getIntervalMs(groupBy: string): number {
    switch (groupBy) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // Default to hour
    }
  }

  /**
   * Set WebSocket service for real-time streaming
   */
  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  /**
   * Get the Express router
   */
  getRouter(): Router {
    return this.router;
  }
}

/**
 * Factory function to create metrics API router
 */
export function createMetricsAPI(
  monitor?: IPerformanceMonitor, 
  wsService?: WebSocketService
): Router {
  const api = new MetricsAPI(monitor, wsService);
  return api.getRouter();
}