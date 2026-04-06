import { WebSocketService } from '../websocket.js';
import { 
  PerformanceMetrics, 
  IPerformanceMonitor,
  IMetricsCollector 
} from './interfaces.js';
import { getGlobalPerformanceMonitor } from './index.js';

/**
 * Real-time performance metrics streaming service
 * Provides WebSocket-based streaming of performance metrics
 */
export class MetricsStreamingService {
  private wsService: WebSocketService;
  private monitor: IPerformanceMonitor;
  private streamingClients: Set<string> = new Set();
  private snapshotInterval: NodeJS.Timeout | null = null;
  private metricsBuffer: PerformanceMetrics[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;

  constructor(wsService: WebSocketService, monitor?: IPerformanceMonitor) {
    this.wsService = wsService;
    this.monitor = monitor || getGlobalPerformanceMonitor();
    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket event handlers for performance streaming
   */
  private setupWebSocketHandlers(): void {
    // Extend the existing WebSocket service with performance-specific handlers
    const originalSetupHandlers = this.wsService['setupSocketHandlers'];
    
    // Add performance tracking handlers to the WebSocket service
    this.addPerformanceHandlers();
  }

  /**
   * Add performance-specific WebSocket handlers
   */
  private addPerformanceHandlers(): void {
    // Access the Socket.IO instance through the WebSocket service
    const io = (this.wsService as any).io;
    
    if (!io) {
      console.error('Socket.IO instance not available for performance streaming');
      return;
    }

    io.on('connection', (socket: any) => {
      // Performance tracking events
      socket.on('track_performance', (options?: {
        categories?: string[];
        metrics?: string[];
        interval?: number;
      }) => {
        this.addStreamingClient(socket.id, options);
        socket.emit('performance_tracking_started', {
          clientId: socket.id,
          options,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('untrack_performance', () => {
        this.removeStreamingClient(socket.id);
        socket.emit('performance_tracking_stopped', {
          clientId: socket.id,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('get_performance_snapshot', async () => {
        try {
          const snapshot = await this.monitor.getSnapshot();
          socket.emit('performance_snapshot', {
            snapshot,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          socket.emit('performance_error', {
            error: 'Failed to get performance snapshot',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      });

      socket.on('get_performance_stats', async () => {
        try {
          let stats;
          if ('getPerformanceStats' in this.monitor) {
            stats = await (this.monitor as any).getPerformanceStats();
          } else {
            const snapshot = await this.monitor.getSnapshot();
            stats = {
              database: snapshot.database,
              api: snapshot.api,
              frontend: snapshot.frontend,
              system: {
                isMonitoring: this.monitor.isActive(),
                uptime: process.uptime()
              }
            };
          }
          
          socket.emit('performance_stats', {
            stats,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          socket.emit('performance_error', {
            error: 'Failed to get performance stats',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.removeStreamingClient(socket.id);
      });
    });
  }

  /**
   * Add a client to performance streaming
   */
  private addStreamingClient(socketId: string, options?: {
    categories?: string[];
    metrics?: string[];
    interval?: number;
  }): void {
    this.streamingClients.add(socketId);
    
    // Start streaming if this is the first client
    if (this.streamingClients.size === 1) {
      this.startStreaming(options?.interval || 5000); // Default 5 second interval
    }

    console.log(`Performance streaming started for client ${socketId}. Total clients: ${this.streamingClients.size}`);
  }

  /**
   * Remove a client from performance streaming
   */
  private removeStreamingClient(socketId: string): void {
    this.streamingClients.delete(socketId);
    
    // Stop streaming if no clients remain
    if (this.streamingClients.size === 0) {
      this.stopStreaming();
    }

    console.log(`Performance streaming stopped for client ${socketId}. Total clients: ${this.streamingClients.size}`);
  }

  /**
   * Start real-time performance streaming
   */
  private startStreaming(intervalMs: number = 5000): void {
    if (this.snapshotInterval) {
      return; // Already streaming
    }

    console.log(`Starting performance streaming with ${intervalMs}ms interval`);

    // Start periodic snapshot streaming
    this.snapshotInterval = setInterval(async () => {
      if (this.streamingClients.size === 0) {
        return;
      }

      try {
        const snapshot = await this.monitor.getSnapshot();
        this.broadcastToStreamingClients('performance_snapshot', {
          snapshot,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error streaming performance snapshot:', error);
        this.broadcastToStreamingClients('performance_error', {
          error: 'Failed to stream performance snapshot',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }, intervalMs);

    // Start metrics buffer flushing
    this.startMetricsBufferStreaming();
  }

  /**
   * Stop real-time performance streaming
   */
  private stopStreaming(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }

    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }

    console.log('Performance streaming stopped');
  }

  /**
   * Start streaming individual metrics from buffer
   */
  private startMetricsBufferStreaming(): void {
    if (this.bufferFlushInterval) {
      return;
    }

    this.bufferFlushInterval = setInterval(() => {
      if (this.metricsBuffer.length > 0 && this.streamingClients.size > 0) {
        const metrics = [...this.metricsBuffer];
        this.metricsBuffer = [];

        this.broadcastToStreamingClients('performance_metrics', {
          metrics,
          count: metrics.length,
          timestamp: new Date().toISOString()
        });
      }
    }, 1000); // Flush every second
  }

  /**
   * Add a metric to the streaming buffer
   */
  addMetricToStream(metric: PerformanceMetrics): void {
    if (this.streamingClients.size > 0) {
      this.metricsBuffer.push(metric);
    }
  }

  /**
   * Stream a performance alert
   */
  streamAlert(alert: {
    type: 'threshold_exceeded' | 'system_error' | 'performance_degradation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric?: PerformanceMetrics;
    threshold?: number;
    currentValue?: number;
    metadata?: Record<string, any>;
  }): void {
    if (this.streamingClients.size > 0) {
      this.broadcastToStreamingClients('performance_alert', {
        ...alert,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Stream system health update
   */
  streamHealthUpdate(health: {
    status: 'healthy' | 'degraded' | 'critical';
    monitoring: boolean;
    collectors: { count: number; names: string[] };
    uptime: number;
    memory: NodeJS.MemoryUsage;
  }): void {
    if (this.streamingClients.size > 0) {
      this.broadcastToStreamingClients('performance_health', {
        ...health,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast message to all streaming clients
   */
  private broadcastToStreamingClients(event: string, data: any): void {
    this.streamingClients.forEach(socketId => {
      try {
        const io = (this.wsService as any).io;
        if (io) {
          io.to(socketId).emit(event, data);
        }
      } catch (error) {
        console.error(`Error broadcasting to client ${socketId}:`, error);
        // Remove problematic client
        this.streamingClients.delete(socketId);
      }
    });
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): {
    activeClients: number;
    isStreaming: boolean;
    bufferSize: number;
    intervalMs: number | null;
  } {
    return {
      activeClients: this.streamingClients.size,
      isStreaming: this.snapshotInterval !== null,
      bufferSize: this.metricsBuffer.length,
      intervalMs: this.snapshotInterval ? 5000 : null // Default interval
    };
  }

  /**
   * Force flush metrics buffer
   */
  flushMetricsBuffer(): void {
    if (this.metricsBuffer.length > 0 && this.streamingClients.size > 0) {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      this.broadcastToStreamingClients('performance_metrics', {
        metrics,
        count: metrics.length,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopStreaming();
    this.streamingClients.clear();
    this.metricsBuffer = [];
  }
}

/**
 * Enhanced WebSocket service with performance streaming
 */
export class EnhancedWebSocketService extends WebSocketService {
  private metricsStreaming: MetricsStreamingService;

  constructor(server: any, monitor?: IPerformanceMonitor) {
    super(server);
    this.metricsStreaming = new MetricsStreamingService(this, monitor);
  }

  /**
   * Get the metrics streaming service
   */
  getMetricsStreaming(): MetricsStreamingService {
    return this.metricsStreaming;
  }

  /**
   * Stream a performance metric
   */
  streamMetric(metric: PerformanceMetrics): void {
    this.metricsStreaming.addMetricToStream(metric);
  }

  /**
   * Stream a performance alert
   */
  streamPerformanceAlert(alert: {
    type: 'threshold_exceeded' | 'system_error' | 'performance_degradation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric?: PerformanceMetrics;
    threshold?: number;
    currentValue?: number;
    metadata?: Record<string, any>;
  }): void {
    this.metricsStreaming.streamAlert(alert);
  }
}

/**
 * Factory function to create enhanced WebSocket service with performance streaming
 */
export function createEnhancedWebSocketService(
  server: any, 
  monitor?: IPerformanceMonitor
): EnhancedWebSocketService {
  return new EnhancedWebSocketService(server, monitor);
}