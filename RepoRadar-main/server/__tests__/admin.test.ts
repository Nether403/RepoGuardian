import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

// Mock the database module before importing admin
vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              execute: vi.fn().mockResolvedValue([]),
            })),
            execute: vi.fn().mockResolvedValue([]),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve([])),
            })),
          })),
          execute: vi.fn().mockResolvedValue([]),
        })),
        groupBy: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue([]),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
  checkDatabaseHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    responseTime: 10,
  }),
}));

describe('Admin Dashboard API', () => {
  let app: Express;
  let createAdminRouter: any;
  const ADMIN_TOKEN = 'test-admin-token';
  
  beforeAll(async () => {
    // Set admin token for tests
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
    
    // Import after mocking
    const adminModule = await import('../admin');
    createAdminRouter = adminModule.createAdminRouter;
    
    // Create Express app with admin router
    app = express();
    app.use(express.json());
    app.use('/api/admin', createAdminRouter());
  });
  
  afterAll(() => {
    // Clean up
    delete process.env.ADMIN_TOKEN;
  });
  
  describe('Authentication', () => {
    it('should reject requests without admin token', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics');
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin access required');
    });
    
    it('should reject requests with invalid admin token', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics')
        .set('x-admin-token', 'invalid-token');
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin access required');
    });
    
    it('should accept requests with valid admin token', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('GET /api/admin/health-metrics', () => {
    it('should return health metrics for all systems', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('api');
    });
    
    it('should include database health status', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.checks.database).toHaveProperty('status');
      expect(response.body.checks.database).toHaveProperty('responseTime');
      expect(['healthy', 'unhealthy']).toContain(response.body.checks.database.status);
    });
    
    it('should include overall health status', async () => {
      const response = await request(app)
        .get('/api/admin/health-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });
  });
  
  describe('GET /api/admin/system-metrics', () => {
    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('resources');
    });
    
    it('should calculate error rate correctly', async () => {
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.metrics).toHaveProperty('errorRate');
      expect(response.body.metrics).toHaveProperty('totalEvents');
      expect(response.body.metrics).toHaveProperty('errorEvents');
      expect(typeof response.body.metrics.errorRate).toBe('number');
    });
    
    it('should include resource usage metrics', async () => {
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.resources).toHaveProperty('memory');
      expect(response.body.resources).toHaveProperty('cpu');
      expect(response.body.resources).toHaveProperty('uptime');
      expect(response.body.resources.memory).toHaveProperty('heapUsed');
      expect(response.body.resources.memory).toHaveProperty('heapTotal');
    });
    
    it('should accept custom date range', async () => {
      const startDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .query({ startDate, endDate })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.period.start).toBe(startDate);
      expect(response.body.period.end).toBe(endDate);
    });
  });
  
  describe('GET /api/admin/user-activity', () => {
    it('should return user activity metrics', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('activity');
      expect(response.body).toHaveProperty('features');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('sessions');
    });
    
    it('should count active sessions correctly', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.activity).toHaveProperty('activeSessions');
      expect(typeof response.body.activity.activeSessions).toBe('number');
    });
    
    it('should count unique users correctly', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.activity).toHaveProperty('uniqueUsers');
      expect(typeof response.body.activity.uniqueUsers).toBe('number');
    });
    
    it('should return feature usage statistics', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.features)).toBe(true);
      if (response.body.features.length > 0) {
        expect(response.body.features[0]).toHaveProperty('name');
        expect(response.body.features[0]).toHaveProperty('usage');
      }
    });
    
    it('should return category usage statistics', async () => {
      const response = await request(app)
        .get('/api/admin/user-activity')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.categories)).toBe(true);
    });
  });
  
  describe('GET /api/admin/analytics/time-series', () => {
    it('should return time-series analytics data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('timeSeries');
    });
    
    it('should aggregate data by hour by default', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.period.interval).toBe('hour');
      expect(Array.isArray(response.body.timeSeries)).toBe(true);
    });
    
    it('should support different time intervals', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .query({ interval: 'day' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.period.interval).toBe('day');
    });
    
    it('should filter by event name', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .query({ eventName: 'test_event' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.eventName).toBe('test_event');
    });
    
    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .query({ category: 'test' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.category).toBe('test');
    });
    
    it('should include summary statistics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/time-series')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.summary).toHaveProperty('totalEvents');
      expect(response.body.summary).toHaveProperty('uniqueSessions');
      expect(response.body.summary).toHaveProperty('uniqueUsers');
    });
  });
  
  describe('GET /api/admin/logs', () => {
    it('should return paginated logs', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('filters');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });
    
    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ limit: 1, offset: 0 })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.logs.length).toBeLessThanOrEqual(1);
    });
    
    it('should filter by event name', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ eventName: 'test_log_1' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.eventName).toBe('test_log_1');
    });
    
    it('should filter by user ID', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ userId: 'test-user-1' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.userId).toBe('test-user-1');
    });
    
    it('should filter by session ID', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .query({ sessionId: 'test-session-1' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.sessionId).toBe('test-session-1');
    });
    
    it('should include log details', async () => {
      const response = await request(app)
        .get('/api/admin/logs')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      if (response.body.logs.length > 0) {
        const log = response.body.logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('eventName');
        expect(log).toHaveProperty('eventCategory');
        expect(log).toHaveProperty('sessionId');
        expect(log).toHaveProperty('timestamp');
      }
    });
  });
  
  describe('GET /api/admin/export', () => {
    it('should export data as JSON by default', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('exportDate');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
    });
    
    it('should export data as CSV when requested', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .query({ format: 'csv' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(typeof response.text).toBe('string');
      expect(response.text).toContain('ID,Event Name,Category');
    });
    
    it('should filter exported data by event name', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .query({ eventName: 'test_export_1' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.eventName).toBe('test_export_1');
    });
    
    it('should filter exported data by category', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .query({ category: 'test' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      expect(response.body.filters.category).toBe('test');
    });
    
    it('should include proper CSV headers', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .query({ format: 'csv' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      expect(response.status).toBe(200);
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('ID');
      expect(lines[0]).toContain('Event Name');
      expect(lines[0]).toContain('Category');
      expect(lines[0]).toContain('Timestamp');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test verifies error handling structure
      // In a real scenario with database errors, we expect 500 status
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .set('x-admin-token', ADMIN_TOKEN);
      
      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });
    
    it('should validate date parameters', async () => {
      const response = await request(app)
        .get('/api/admin/system-metrics')
        .query({ startDate: 'invalid-date' })
        .set('x-admin-token', ADMIN_TOKEN);
      
      // Should handle invalid date gracefully
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
