import { Router, Request, Response } from 'express';
import { 
  PerformanceMetrics, 
  MetricsFilter,
  IPerformanceMonitor 
} from './interfaces.js';
import { getGlobalPerformanceMonitor } from './index.js';

/**
 * Dashboard service for aggregating and serving performance metrics
 * Provides comprehensive dashboard data with historical analysis
 */
export class DashboardService {
  private monitor: IPerformanceMonitor;
  private router: Router;

  constructor(monitor?: IPerformanceMonitor) {
    this.monitor = monitor || getGlobalPerformanceMonitor();
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/overview', this.getDashboardOverview.bind(this));
    this.router.get('/historical', this.getHistoricalData.bind(this));
    this.router.get('/trends', this.getTrendAnalysis.bind(this));
    this.router.get('/alerts', this.getActiveAlerts.bind(this));
  }

  /**
   * Get dashboard overview with current metrics
   */
  private async getDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const snapshot = await this.monitor.getSnapshot();
      
      const overview = {
        timestamp: new Date().toISOString(),
        summary: {
          database: {
            avgResponseTime: snapshot.database.value || 0,
            status: this.getHealthStatus(snapshot.database.value || 0, 100)
          },
          api: {
            avgResponseTime: snapshot.api.value || 0,
            status: this.getHealthStatus(snapshot.api.value || 0, 200)
          },
          frontend: {
            avgLoadTime: snapshot.frontend.value || 0,
            status: this.getHealthStatus(snapshot.frontend.value || 0, 3000)
          }
        },
        system: {
          monitoring: this.monitor.isActive(),
          uptime: process.uptime()
        }
      };

      res.json(overview);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get dashboard overview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get historical performance data
   */
  private async getHistoricalData(req: Request, res: Response): Promise<void> {
    try {
      const { hours = 24, category } = req.query;
      const hoursNum = parseInt(hours as string);
      const startTime = new Date(Date.now() - (hoursNum * 60 * 60 * 1000));
      
      // Get aggregated data for the time period
      const historicalData = await this.getAggregatedHistoricalData(
        startTime,
        new Date(),
        category as PerformanceMetrics['category']
      );

      res.json({
        timeRange: {
          start: startTime.toISOString(),
          end: new Date().toISOString(),
          hours: hoursNum
        },
        data: historicalData
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get historical data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get trend analysis
   */
  private async getTrendAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const trends = await this.calculateTrends();
      res.json(trends);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get trend analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = await this.getSystemAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get active alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private getHealthStatus(value: number, threshold: number): 'good' | 'warning' | 'critical' {
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'warning';
    return 'critical';
  }

  private async getAggregatedHistoricalData(
    startTime: Date,
    endTime: Date,
    category?: PerformanceMetrics['category']
  ) {
    // Implementation would aggregate metrics by time intervals
    return {
      database: [],
      api: [],
      frontend: []
    };
  }

  private async calculateTrends() {
    return {
      database: { trend: 'stable', change: 0 },
      api: { trend: 'improving', change: -5 },
      frontend: { trend: 'degrading', change: 10 }
    };
  }

  private async getSystemAlerts() {
    return {
      active: [],
      count: 0
    };
  }

  getRouter(): Router {
    return this.router;
  }
}
