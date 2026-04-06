import request from 'supertest';
import express from 'express';
import { PerformanceMonitor } from '../PerformanceMonitor.js';
import { MetricsCollector } from '../MetricsCollector.js';
import { createAlertingSystem, AlertConfig } from '../AlertingSystem.js';
import { PerformanceMetrics } from '../interfaces.js';

describe('Alerting API Integration Tests', () => {
  let app: express.Application;
  let monitor: PerformanceMonitor;
  let collector: MetricsCollector;
  let alertingSystem: any;

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
    alertingSystem = createAlertingSystem(monitor);

    // Create Express app with alerting endpoints
    app = express();
    app.use(express.json());

    // Add alerting endpoints (simplified version of what's in routes.ts)
    app.get('/api/performance/alerts/configs', (req, res) => {
      try {
        const configs = alertingSystem.getAlertConfigs();
        res.json({ configs });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve alert configurations' });
      }
    });

    app.post('/api/performance/alerts/configs', (req, res) => {
      try {
        const config = req.body;
        alertingSystem.addAlertConfig(config);
        res.json({ message: 'Alert configuration added', config });
      } catch (error) {
        res.status(500).json({ error: 'Failed to add alert configuration' });
      }
    });

    app.put('/api/performance/alerts/configs/:id', (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const updated = alertingSystem.updateAlertConfig(id, updates);
        
        if (updated) {
          res.json({ message: 'Alert configuration updated' });
        } else {
          res.status(404).json({ error: 'Alert configuration not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to update alert configuration' });
      }
    });

    app.delete('/api/performance/alerts/configs/:id', (req, res) => {
      try {
        const { id } = req.params;
        const removed = alertingSystem.removeAlertConfig(id);
        
        if (removed) {
          res.json({ message: 'Alert configuration removed' });
        } else {
          res.status(404).json({ error: 'Alert configuration not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to remove alert configuration' });
      }
    });

    app.get('/api/performance/alerts/active', (req, res) => {
      try {
        const alerts = alertingSystem.getActiveAlerts();
        res.json({ alerts });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve active alerts' });
      }
    });

    app.get('/api/performance/alerts/history', (req, res) => {
      try {
        const { limit } = req.query;
        const alerts = alertingSystem.getAlertHistory(limit ? parseInt(limit as string) : undefined);
        res.json({ alerts });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve alert history' });
      }
    });

    app.post('/api/performance/alerts/:id/resolve', (req, res) => {
      try {
        const { id } = req.params;
        const resolved = alertingSystem.resolveAlert(id);
        
        if (resolved) {
          res.json({ message: 'Alert resolved' });
        } else {
          res.status(404).json({ error: 'Alert not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to resolve alert' });
      }
    });

    app.get('/api/performance/alerts/stats', (req, res) => {
      try {
        const stats = alertingSystem.getStats();
        res.json({ stats });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve alerting statistics' });
      }
    });

    app.post('/api/performance/alerts/evaluate', async (req, res) => {
      try {
        await alertingSystem.evaluateAlerts();
        res.json({ message: 'Alert evaluation completed' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to evaluate alerts' });
      }
    });
  });

  afterEach(async () => {
    await alertingSystem.stop();
    await monitor.stop();
  });

  describe('Alert Configuration Management', () => {
    it('should get empty alert configurations initially', async () => {
      const response = await request(app)
        .get('/api/performance/alerts/configs')
        .expect(200);

      expect(response.body).toHaveProperty('configs');
      expect(response.body.configs).toBeInstanceOf(Array);
      expect(response.body.configs).toHaveLength(0);
    });

    it('should add alert configuration', async () => {
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

      const response = await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert configuration added');
      expect(response.body).toHaveProperty('config');
      expect(response.body.config.id).toBe('test-alert');
    });

    it('should get alert configurations after adding', async () => {
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

      await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      const response = await request(app)
        .get('/api/performance/alerts/configs')
        .expect(200);

      expect(response.body.configs).toHaveLength(1);
      expect(response.body.configs[0].id).toBe('test-alert');
    });

    it('should update alert configuration', async () => {
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

      await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      const response = await request(app)
        .put('/api/performance/alerts/configs/test-alert')
        .send({ threshold: 2000, severity: 'high' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert configuration updated');

      // Verify the update
      const getResponse = await request(app)
        .get('/api/performance/alerts/configs')
        .expect(200);

      const updatedConfig = getResponse.body.configs.find((c: any) => c.id === 'test-alert');
      expect(updatedConfig.threshold).toBe(2000);
      expect(updatedConfig.severity).toBe('high');
    });

    it('should return 404 when updating non-existent configuration', async () => {
      const response = await request(app)
        .put('/api/performance/alerts/configs/non-existent')
        .send({ threshold: 2000 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert configuration not found');
    });

    it('should delete alert configuration', async () => {
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

      await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      const response = await request(app)
        .delete('/api/performance/alerts/configs/test-alert')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert configuration removed');

      // Verify deletion
      const getResponse = await request(app)
        .get('/api/performance/alerts/configs')
        .expect(200);

      expect(getResponse.body.configs).toHaveLength(0);
    });

    it('should return 404 when deleting non-existent configuration', async () => {
      const response = await request(app)
        .delete('/api/performance/alerts/configs/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert configuration not found');
    });
  });

  describe('Alert Management', () => {
    it('should get empty active alerts initially', async () => {
      const response = await request(app)
        .get('/api/performance/alerts/active')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body.alerts).toBeInstanceOf(Array);
      expect(response.body.alerts).toHaveLength(0);
    });

    it('should get empty alert history initially', async () => {
      const response = await request(app)
        .get('/api/performance/alerts/history')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body.alerts).toBeInstanceOf(Array);
      expect(response.body.alerts).toHaveLength(0);
    });

    it('should get alert history with limit', async () => {
      const response = await request(app)
        .get('/api/performance/alerts/history?limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body.alerts).toBeInstanceOf(Array);
    });

    it('should return 404 when resolving non-existent alert', async () => {
      const response = await request(app)
        .post('/api/performance/alerts/non-existent/resolve')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert not found');
    });
  });

  describe('Alert Statistics', () => {
    it('should get alerting system statistics', async () => {
      const response = await request(app)
        .get('/api/performance/alerts/stats')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('isRunning');
      expect(response.body.stats).toHaveProperty('configCount');
      expect(response.body.stats).toHaveProperty('activeAlertCount');
      expect(response.body.stats).toHaveProperty('totalAlertCount');
      expect(response.body.stats).toHaveProperty('deliveryMethodCount');
      expect(response.body.stats).toHaveProperty('deliveryMethods');
      expect(response.body.stats.deliveryMethods).toBeInstanceOf(Array);
    });
  });

  describe('Alert Evaluation', () => {
    it('should manually trigger alert evaluation', async () => {
      const response = await request(app)
        .post('/api/performance/alerts/evaluate')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alert evaluation completed');
    });

    it('should create alert when threshold is violated', async () => {
      // Add alert configuration
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

      await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      // Add violating metric
      const violatingMetric: PerformanceMetrics = {
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500, // Greater than threshold of 1000
        threshold: 1000
      };

      await collector.collect(violatingMetric);
      await collector.flush();

      // Trigger evaluation
      await request(app)
        .post('/api/performance/alerts/evaluate')
        .expect(200);

      // Check for active alerts
      const alertsResponse = await request(app)
        .get('/api/performance/alerts/active')
        .expect(200);

      expect(alertsResponse.body.alerts).toHaveLength(1);
      expect(alertsResponse.body.alerts[0].configId).toBe('test-alert');
      expect(alertsResponse.body.alerts[0].actualValue).toBe(1500);
    });

    it('should resolve alert', async () => {
      // Add alert configuration
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

      await request(app)
        .post('/api/performance/alerts/configs')
        .send(config)
        .expect(200);

      // Create alert
      await collector.collect({
        timestamp: new Date(),
        category: 'database',
        metric: 'executionTime',
        value: 1500,
        threshold: 1000
      });
      await collector.flush();
      await request(app).post('/api/performance/alerts/evaluate').expect(200);

      // Get active alert
      const alertsResponse = await request(app)
        .get('/api/performance/alerts/active')
        .expect(200);

      expect(alertsResponse.body.alerts).toHaveLength(1);
      const alertId = alertsResponse.body.alerts[0].id;

      // Resolve alert
      const resolveResponse = await request(app)
        .post(`/api/performance/alerts/${alertId}/resolve`)
        .expect(200);

      expect(resolveResponse.body).toHaveProperty('message', 'Alert resolved');

      // Verify alert is no longer active
      const activeAlertsResponse = await request(app)
        .get('/api/performance/alerts/active')
        .expect(200);

      expect(activeAlertsResponse.body.alerts).toHaveLength(0);

      // Verify alert is in history
      const historyResponse = await request(app)
        .get('/api/performance/alerts/history')
        .expect(200);

      expect(historyResponse.body.alerts).toHaveLength(1);
      expect(historyResponse.body.alerts[0].resolved).toBe(true);
    });
  });
});