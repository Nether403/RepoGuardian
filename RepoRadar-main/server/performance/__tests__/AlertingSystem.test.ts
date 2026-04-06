import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceAlertingSystem, 
  AlertConfig, 
  PerformanceAlert,
  ConsoleAlertDelivery,
  WebSocketAlertDelivery,
  IAlertDelivery
} from '../AlertingSystem.js';
import { PerformanceMonitor } from '../PerformanceMonitor.js';
import { MetricsCollector } from '../MetricsCollector.js';
import { InMemoryMetricsStorage } from '../InMemoryMetricsStorage.js';
import { PerformanceMetrics } from '../interfaces.js';

// Mock WebSocket service
const mockWebSocketService = {
  broadcastToAll: vi.fn()
};

// Mock console methods
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

describe('PerformanceAlertingSystem', () => {
  let alertingSystem: PerformanceAlertingSystem;
  let monitor: PerformanceMonitor;
  let collector: MetricsCollector;

  beforeEach(async () => {
    // Create test performance monitor
    monitor = new PerformanceMonitor({
      maxMetrics: 1000,
      retentionHours: 1,
      bufferSize: 10,
      flushIntervalMs: 100
    });

    collector = monitor.getDefaultCollector() as MetricsCollector;
    await monitor.start();

    // Create alerting system
    alertingSystem = new PerformanceAlertingSystem(monitor);
  });

  afterEach(async () => {
    await alertingSystem.stop();
    await monitor.stop();
  });

  describe('Alert Configuration Management', () => {
    it('should add alert configuration', () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      };

      alertingSystem.addAlertConfig(config);
      
      const retrieved = alertingSystem.getAlertConfig('test-alert');
      expect(retrieved).toEqual(config);
    });

    it('should remove alert configuration', () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      };

      alertingSystem.addAlertConfig(config);
      expect(alertingSystem.getAlertConfig('test-alert')).toBeDefined();

      const removed = alertingSystem.removeAlertConfig('test-alert');
      expect(removed).toBe(true);
      expect(alertingSystem.getAlertConfig('test-alert')).toBeUndefined();
    });

    it('should update alert configuration', () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      };

      alertingSystem.addAlertConfig(config);

      const updated = alertingSystem.updateAlertConfig('test-alert', {
        threshold: 2000,
        severity: 'high'
      });

      expect(updated).toBe(true);
      
      const retrieved = alertingSystem.getAlertConfig('test-alert');
      expect(retrieved?.threshold).toBe(2000);
      expect(retrieved?.severity).toBe('high');
    });

    it('should get all alert configurations', () => {
      const config1: AlertConfig = {
        id: 'test-alert-1',
        name: 'Test Alert 1',
        description: 'Test alert 1',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      };

      const config2: AlertConfig = {
        id: 'test-alert-2',
        name: 'Test Alert 2',
        description: 'Test alert 2',
        category: 'api',
        metric: 'responseTime',
        threshold: 2000,
        operator: 'gt',
        severity: 'high',
        enabled: true,
        cooldownMs: 300000
      };

      alertingSystem.addAlertConfig(config1);
      alertingSystem.addAlertConfig(config2);

      const configs = alertingSystem.getAlertConfigs();
      expect(configs).toHaveLength(2);
      expect(configs.find(c => c.id === 'test-alert-1')).toBeDefined();
      expect(configs.find(c => c.id === 'test-alert-2')).toBeDefined();
    });
  });

  describe('Delivery Method Management', () => {
    it('should register delivery method', () => {
      const mockDelivery: IAlertDelivery = {
        getName: () => 'mock',
        isAvailable: () => true,
        deliver: vi.fn().mockResolvedValue(undefined)
      };

      alertingSystem.registerDeliveryMethod(mockDelivery);
      
      const stats = alertingSystem.getStats();
      expect(stats.deliveryMethods).toContain('mock');
    });

    it('should unregister delivery method', () => {
      const mockDelivery: IAlertDelivery = {
        getName: () => 'mock',
        isAvailable: () => true,
        deliver: vi.fn().mockResolvedValue(undefined)
      };

      alertingSystem.registerDeliveryMethod(mockDelivery);
      expect(alertingSystem.getStats().deliveryMethods).toContain('mock');

      const removed = alertingSystem.unregisterDeliveryMethod('mock');
      expect(removed).toBe(true);
      expect(alertingSystem.getStats().deliveryMethods).not.toContain('mock');
    });
  });

  describe('Alert Evaluation', () => {
    it('should evaluate threshold violations correctly', async () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 0 // No cooldown for testing
      };

      alertingSystem.addAlertConfig(config);

      // Add a metric that violates the threshold
      const violatingMetric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500, // Greater than threshold of 1000
        threshold: 1000
      };

      await collector.collect(violatingMetric);
      await collector.flush();

      // Evaluate alerts
      await alertingSystem.evaluateAlerts();

      // Check that an alert was created
      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].configId).toBe('test-alert');
      expect(activeAlerts[0].actualValue).toBe(1500);
    });

    it('should respect cooldown periods', async () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 60000 // 1 minute cooldown
      };

      alertingSystem.addAlertConfig(config);

      // Add violating metrics
      const violatingMetric1: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      };

      const violatingMetric2: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1600,
        threshold: 1000
      };

      await collector.collect(violatingMetric1);
      await collector.flush();
      await alertingSystem.evaluateAlerts();

      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);

      // Add another violating metric immediately
      await collector.collect(violatingMetric2);
      await collector.flush();
      await alertingSystem.evaluateAlerts();

      // Should still only have one alert due to cooldown
      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);
    });

    it('should handle consecutive violations requirement', async () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 0,
        consecutiveViolations: 3
      };

      alertingSystem.addAlertConfig(config);

      // First violation - should not trigger alert
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      });
      await collector.flush();
      await alertingSystem.evaluateAlerts();
      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);

      // Second violation - should not trigger alert
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1600,
        threshold: 1000
      });
      await collector.flush();
      await alertingSystem.evaluateAlerts();
      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);

      // Third violation - should trigger alert
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1700,
        threshold: 1000
      });
      await collector.flush();
      await alertingSystem.evaluateAlerts();
      expect(alertingSystem.getActiveAlerts()).toHaveLength(1);
    });

    it('should not trigger alerts for disabled configurations', async () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: false, // Disabled
        cooldownMs: 0
      };

      alertingSystem.addAlertConfig(config);

      // Add violating metric
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      });
      await collector.flush();

      await alertingSystem.evaluateAlerts();

      // Should not create any alerts
      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);
    });
  });

  describe('Alert Resolution', () => {
    it('should resolve active alerts', async () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 0
      };

      alertingSystem.addAlertConfig(config);

      // Create an alert
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      });
      await collector.flush();
      await alertingSystem.evaluateAlerts();

      const activeAlerts = alertingSystem.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);

      const alertId = activeAlerts[0].id;
      const resolved = alertingSystem.resolveAlert(alertId);

      expect(resolved).toBe(true);
      expect(alertingSystem.getActiveAlerts()).toHaveLength(0);
      expect(alertingSystem.getAlertHistory()).toHaveLength(1);
      expect(alertingSystem.getAlertHistory()[0].resolved).toBe(true);
      expect(alertingSystem.getAlertHistory()[0].resolvedAt).toBeDefined();
    });
  });

  describe('System Management', () => {
    it('should start and stop alerting system', async () => {
      expect(alertingSystem.getStats().isRunning).toBe(false);

      await alertingSystem.start(1000);
      expect(alertingSystem.getStats().isRunning).toBe(true);

      await alertingSystem.stop();
      expect(alertingSystem.getStats().isRunning).toBe(false);
    });

    it('should provide system statistics', () => {
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000
      };

      alertingSystem.addAlertConfig(config);

      const stats = alertingSystem.getStats();
      expect(stats.configCount).toBe(1);
      expect(stats.activeAlertCount).toBe(0);
      expect(stats.deliveryMethodCount).toBeGreaterThan(0);
      expect(stats.deliveryMethods).toContain('console');
    });

    it('should create default alert configurations', () => {
      alertingSystem.createDefaultAlerts();
      
      const configs = alertingSystem.getAlertConfigs();
      expect(configs.length).toBeGreaterThan(0);
      
      // Check for specific default alerts
      const slowQueryAlert = configs.find(c => c.id === 'db_slow_query');
      expect(slowQueryAlert).toBeDefined();
      expect(slowQueryAlert?.category).toBe('database');
      expect(slowQueryAlert?.metric).toBe('executionTime');
    });

    it('should clear alert history', async () => {
      // Create and resolve an alert to add to history
      const config: AlertConfig = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        category: 'database',
        metric: 'executionTime',
        threshold: 1000,
        operator: 'gt',
        severity: 'medium',
        enabled: true,
        cooldownMs: 0
      };

      alertingSystem.addAlertConfig(config);

      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      });
      await collector.flush();
      await alertingSystem.evaluateAlerts();

      const alertId = alertingSystem.getActiveAlerts()[0].id;
      alertingSystem.resolveAlert(alertId);

      expect(alertingSystem.getAlertHistory()).toHaveLength(1);

      const clearedCount = alertingSystem.clearHistory();
      expect(clearedCount).toBe(1);
      expect(alertingSystem.getAlertHistory()).toHaveLength(0);
    });
  });
});

describe('ConsoleAlertDelivery', () => {
  let delivery: ConsoleAlertDelivery;

  beforeEach(() => {
    delivery = new ConsoleAlertDelivery();
  });

  it('should have correct name and availability', () => {
    expect(delivery.getName()).toBe('console');
    expect(delivery.isAvailable()).toBe(true);
  });

  it('should deliver alerts to console', async () => {
    const alert: PerformanceAlert = {
      id: 'test-alert-1',
      configId: 'test-config',
      timestamp: new Date(),
      metric: {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      },
      threshold: 1000,
      actualValue: 1500,
      severity: 'medium',
      message: 'Test alert message',
      resolved: false
    };

    await delivery.deliver(alert);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('PERFORMANCE ALERT'),
      expect.objectContaining({
        id: 'test-alert-1',
        configId: 'test-config'
      })
    );
  });
});

describe('WebSocketAlertDelivery', () => {
  let delivery: WebSocketAlertDelivery;

  beforeEach(() => {
    delivery = new WebSocketAlertDelivery(mockWebSocketService as any);
    mockWebSocketService.broadcastToAll.mockClear();
  });

  it('should have correct name and availability', () => {
    expect(delivery.getName()).toBe('websocket');
    expect(delivery.isAvailable()).toBe(true);
  });

  it('should deliver alerts via WebSocket', async () => {
    const alert: PerformanceAlert = {
      id: 'test-alert-1',
      configId: 'test-config',
      timestamp: new Date(),
      metric: {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      },
      threshold: 1000,
      actualValue: 1500,
      severity: 'medium',
      message: 'Test alert message',
      resolved: false
    };

    await delivery.deliver(alert);

    expect(mockWebSocketService.broadcastToAll).toHaveBeenCalledWith(
      'performance_alert',
      expect.objectContaining({
        id: 'test-alert-1',
        configId: 'test-config',
        severity: 'medium',
        message: 'Test alert message'
      })
    );
  });
});