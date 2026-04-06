import { 
  PerformanceMetrics, 
  IPerformanceMonitor,
  IMetricsCollector 
} from './interfaces.js';
import { getGlobalPerformanceMonitor } from './index.js';
import { WebSocketService } from '../websocket.js';

/**
 * Performance alert configuration
 */
export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  category: PerformanceMetrics['category'];
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMs: number; // Minimum time between alerts
  consecutiveViolations?: number; // Number of consecutive violations before alerting
  windowMs?: number; // Time window for evaluation
}

/**
 * Performance alert instance
 */
export interface PerformanceAlert {
  id: string;
  configId: string;
  timestamp: Date;
  metric: PerformanceMetrics;
  threshold: number;
  actualValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Alert delivery mechanism interface
 */
export interface IAlertDelivery {
  /**
   * Deliver an alert
   */
  deliver(alert: PerformanceAlert): Promise<void>;
  
  /**
   * Get delivery method name
   */
  getName(): string;
  
  /**
   * Check if delivery method is available
   */
  isAvailable(): boolean;
}

/**
 * Console logging alert delivery
 */
export class ConsoleAlertDelivery implements IAlertDelivery {
  getName(): string {
    return 'console';
  }

  isAvailable(): boolean {
    return true;
  }

  async deliver(alert: PerformanceAlert): Promise<void> {
    const level = this.getSeverityLogLevel(alert.severity);
    const message = `[PERFORMANCE ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`;
    const details = {
      id: alert.id,
      configId: alert.configId,
      timestamp: alert.timestamp.toISOString(),
      metric: alert.metric.metric,
      category: alert.metric.category,
      threshold: alert.threshold,
      actualValue: alert.actualValue,
      metadata: alert.metadata
    };

    console[level](message, details);
  }

  private getSeverityLogLevel(severity: string): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'low': return 'log';
      case 'medium': return 'warn';
      case 'high':
      case 'critical': return 'error';
      default: return 'log';
    }
  }
}

/**
 * WebSocket alert delivery
 */
export class WebSocketAlertDelivery implements IAlertDelivery {
  constructor(private wsService: WebSocketService) {}

  getName(): string {
    return 'websocket';
  }

  isAvailable(): boolean {
    return !!this.wsService;
  }

  async deliver(alert: PerformanceAlert): Promise<void> {
    if (!this.wsService) {
      throw new Error('WebSocket service not available');
    }

    // Broadcast to all connected clients
    this.wsService.broadcastToAll('performance_alert', {
      id: alert.id,
      configId: alert.configId,
      timestamp: alert.timestamp.toISOString(),
      severity: alert.severity,
      message: alert.message,
      metric: {
        category: alert.metric.category,
        metric: alert.metric.metric,
        value: alert.actualValue,
        threshold: alert.threshold
      },
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt?.toISOString(),
      metadata: alert.metadata
    });
  }
}

/**
 * Performance alerting system
 */
export class PerformanceAlertingSystem {
  private monitor: IPerformanceMonitor;
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private alertHistory: PerformanceAlert[] = [];
  private deliveryMethods: Map<string, IAlertDelivery> = new Map();
  private lastAlertTimes: Map<string, Date> = new Map();
  private violationCounts: Map<string, number> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(monitor?: IPerformanceMonitor) {
    this.monitor = monitor || getGlobalPerformanceMonitor();
    
    // Register default delivery methods
    this.registerDeliveryMethod(new ConsoleAlertDelivery());
  }

  /**
   * Start the alerting system
   */
  async start(intervalMs: number = 30000): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        console.error('Error evaluating alerts:', error);
      }
    }, intervalMs);

    console.log(`Performance alerting system started with ${intervalMs}ms interval`);
  }

  /**
   * Stop the alerting system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance alerting system stopped');
  }

  /**
   * Add an alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.alertConfigs.set(config.id, config);
    console.log(`Added alert configuration: ${config.name} (${config.id})`);
  }

  /**
   * Remove an alert configuration
   */
  removeAlertConfig(configId: string): boolean {
    const removed = this.alertConfigs.delete(configId);
    if (removed) {
      // Clean up related data
      this.lastAlertTimes.delete(configId);
      this.violationCounts.delete(configId);
      
      // Resolve any active alerts for this config
      for (const [alertId, alert] of this.activeAlerts.entries()) {
        if (alert.configId === configId) {
          this.resolveAlert(alertId);
        }
      }
      
      console.log(`Removed alert configuration: ${configId}`);
    }
    return removed;
  }

  /**
   * Update an alert configuration
   */
  updateAlertConfig(configId: string, updates: Partial<AlertConfig>): boolean {
    const config = this.alertConfigs.get(configId);
    if (!config) {
      return false;
    }

    const updatedConfig = { ...config, ...updates };
    this.alertConfigs.set(configId, updatedConfig);
    console.log(`Updated alert configuration: ${configId}`);
    return true;
  }

  /**
   * Get all alert configurations
   */
  getAlertConfigs(): AlertConfig[] {
    return Array.from(this.alertConfigs.values());
  }

  /**
   * Get alert configuration by ID
   */
  getAlertConfig(configId: string): AlertConfig | undefined {
    return this.alertConfigs.get(configId);
  }

  /**
   * Register an alert delivery method
   */
  registerDeliveryMethod(delivery: IAlertDelivery): void {
    this.deliveryMethods.set(delivery.getName(), delivery);
    console.log(`Registered alert delivery method: ${delivery.getName()}`);
  }

  /**
   * Unregister an alert delivery method
   */
  unregisterDeliveryMethod(name: string): boolean {
    const removed = this.deliveryMethods.delete(name);
    if (removed) {
      console.log(`Unregistered alert delivery method: ${name}`);
    }
    return removed;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): PerformanceAlert[] {
    const history = [...this.alertHistory].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    // Deliver resolution notification
    this.deliverAlert(alert).catch(error => {
      console.error('Error delivering alert resolution:', error);
    });

    console.log(`Resolved alert: ${alertId}`);
    return true;
  }

  /**
   * Manually trigger an alert evaluation
   */
  async evaluateAlerts(): Promise<void> {
    if (!this.monitor.isActive()) {
      return;
    }

    const now = new Date();
    const collector = this.monitor.getDefaultCollector();

    for (const config of this.alertConfigs.values()) {
      if (!config.enabled) {
        continue;
      }

      try {
        // Get recent metrics for this configuration
        const windowStart = config.windowMs ? new Date(now.getTime() - config.windowMs) : new Date(now.getTime() - 60000);
        const metrics = await collector.getMetrics(config.category, windowStart, now);
        const relevantMetrics = metrics.filter(m => m.metric === config.metric);

        if (relevantMetrics.length === 0) {
          continue;
        }

        // Evaluate the most recent metric
        const latestMetric = relevantMetrics[0];
        const violation = this.evaluateThreshold(latestMetric.value, config.threshold, config.operator);

        if (violation) {
          await this.handleViolation(config, latestMetric);
        } else {
          await this.handleNoViolation(config);
        }
      } catch (error) {
        console.error(`Error evaluating alert config ${config.id}:`, error);
      }
    }
  }

  /**
   * Evaluate if a value violates a threshold
   */
  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Handle a threshold violation
   */
  private async handleViolation(config: AlertConfig, metric: PerformanceMetrics): Promise<void> {
    const configId = config.id;
    const now = new Date();

    // Check cooldown period
    const lastAlertTime = this.lastAlertTimes.get(configId);
    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < config.cooldownMs) {
      return;
    }

    // Handle consecutive violations requirement
    if (config.consecutiveViolations && config.consecutiveViolations > 1) {
      const currentCount = (this.violationCounts.get(configId) || 0) + 1;
      this.violationCounts.set(configId, currentCount);

      if (currentCount < config.consecutiveViolations) {
        return; // Not enough consecutive violations yet
      }
    }

    // Create and trigger alert
    const alert: PerformanceAlert = {
      id: `alert_${configId}_${Date.now()}`,
      configId,
      timestamp: now,
      metric,
      threshold: config.threshold,
      actualValue: metric.value,
      severity: config.severity,
      message: this.generateAlertMessage(config, metric),
      resolved: false,
      metadata: {
        operator: config.operator,
        windowMs: config.windowMs,
        consecutiveViolations: this.violationCounts.get(configId) || 1
      }
    };

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.lastAlertTimes.set(configId, now);
    this.violationCounts.set(configId, 0); // Reset violation count

    // Deliver alert
    await this.deliverAlert(alert);

    console.log(`Triggered alert: ${alert.id} - ${alert.message}`);
  }

  /**
   * Handle when there's no violation (reset violation count)
   */
  private async handleNoViolation(config: AlertConfig): Promise<void> {
    this.violationCounts.set(config.id, 0);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(config: AlertConfig, metric: PerformanceMetrics): string {
    const operatorText = this.getOperatorText(config.operator);
    return `${config.name}: ${metric.category}/${metric.metric} is ${metric.value} (${operatorText} ${config.threshold})`;
  }

  /**
   * Get human-readable operator text
   */
  private getOperatorText(operator: string): string {
    switch (operator) {
      case 'gt': return 'greater than';
      case 'lt': return 'less than';
      case 'gte': return 'greater than or equal to';
      case 'lte': return 'less than or equal to';
      case 'eq': return 'equal to';
      case 'ne': return 'not equal to';
      default: return operator;
    }
  }

  /**
   * Deliver alert through all available delivery methods
   */
  private async deliverAlert(alert: PerformanceAlert): Promise<void> {
    const deliveryPromises = Array.from(this.deliveryMethods.values())
      .filter(delivery => delivery.isAvailable())
      .map(delivery => delivery.deliver(alert).catch(error => {
        console.error(`Alert delivery failed for ${delivery.getName()}:`, error);
      }));

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Get alerting system statistics
   */
  getStats(): {
    isRunning: boolean;
    configCount: number;
    activeAlertCount: number;
    totalAlertCount: number;
    deliveryMethodCount: number;
    deliveryMethods: string[];
  } {
    return {
      isRunning: this.isRunning,
      configCount: this.alertConfigs.size,
      activeAlertCount: this.activeAlerts.size,
      totalAlertCount: this.alertHistory.length + this.activeAlerts.size,
      deliveryMethodCount: this.deliveryMethods.size,
      deliveryMethods: Array.from(this.deliveryMethods.keys())
    };
  }

  /**
   * Clear alert history
   */
  clearHistory(): number {
    const count = this.alertHistory.length;
    this.alertHistory = [];
    return count;
  }

  /**
   * Create default alert configurations
   */
  createDefaultAlerts(): void {
    const defaultConfigs: AlertConfig[] = [
      {
        id: 'db_slow_query',
        name: 'Slow Database Query',
        description: 'Alert when database queries take longer than 1 second',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000, // 5 minutes
        consecutiveViolations: 2,
        windowMs: 60000 // 1 minute
      },
      {
        id: 'api_slow_response',
        name: 'Slow API Response',
        description: 'Alert when API responses take longer than 2 seconds',
        category: 'api',
        metric: 'responseTime',
        threshold: 2000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000, // 5 minutes
        consecutiveViolations: 3,
        windowMs: 120000 // 2 minutes
      },
      {
        id: 'frontend_slow_load',
        name: 'Slow Frontend Load',
        description: 'Alert when frontend components take longer than 3 seconds to load',
        category: 'frontend',
        metric: 'loadTime',
        threshold: 3000,
        operator: 'gt',
        severity: 'low',
        enabled: true,
        cooldownMs: 600000, // 10 minutes
        consecutiveViolations: 2,
        windowMs: 180000 // 3 minutes
      },
      {
        id: 'db_critical_query',
        name: 'Critical Database Query',
        description: 'Critical alert when database queries take longer than 5 seconds',
        category: 'database',
        metric: 'executionTime',
        threshold: 5000,
        operator: 'gt',
        severity: 'critical',
        enabled: true,
        cooldownMs: 60000, // 1 minute
        consecutiveViolations: 1,
        windowMs: 30000 // 30 seconds
      }
    ];

    defaultConfigs.forEach(config => this.addAlertConfig(config));
    console.log(`Created ${defaultConfigs.length} default alert configurations`);
  }
}

/**
 * Factory function to create alerting system
 */
export function createAlertingSystem(
  monitor?: IPerformanceMonitor,
  wsService?: WebSocketService
): PerformanceAlertingSystem {
  const alerting = new PerformanceAlertingSystem(monitor);
  
  if (wsService) {
    alerting.registerDeliveryMethod(new WebSocketAlertDelivery(wsService));
  }
  
  return alerting;
}