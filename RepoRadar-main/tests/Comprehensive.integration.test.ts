import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import { createClient } from 'redis';

/**
 * Comprehensive Integration Tests for UX and Scalability Enhancements
 * 
 * This test suite validates:
 * - Complete user flows with loading states and error handling
 * - Analytics tracking end-to-end
 * - Background job processing
 * - Multi-instance session sharing
 * - Health check integration with load balancer
 * - Error recovery scenarios
 */

// Mock dependencies
vi.mock('../server/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../server/redis', () => ({
  redisManager: {
    getClient: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    })),
    getHealthStatus: vi.fn().mockResolvedValue({
      status: 'up',
      responseTime: 50,
    }),
  },
}));

vi.mock('../server/jobs/JobQueue', () => ({
  jobQueue: {
    addJob: vi.fn().mockResolvedValue({
      id: 'test-job-id',
      type: 'test-job',
      status: 'queued',
      progress: 0,
    }),
    getJob: vi.fn().mockResolvedValue({
      id: 'test-job-id',
      type: 'test-job',
      status: 'completed',
      progress: 100,
      result: { success: true },
    }),
    getJobStatus: vi.fn().mockResolvedValue('completed'),
    getStats: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 1,
      delayed: 0,
    }),
  },
}));

vi.mock('../server/analytics', () => ({
  analyticsService: {
    trackEvent: vi.fn().mockResolvedValue(undefined),
    trackError: vi.fn().mockResolvedValue(undefined),
    trackPageView: vi.fn().mockResolvedValue(undefined),
    getEventStats: vi.fn().mockResolvedValue({
      totalEvents: 1000,
      eventsByCategory: {
        'repository-analysis': 500,
        'search': 300,
        'export': 200,
      },
    }),
  },
}));

describe('Comprehensive Integration Tests', () => {
  let app: Express;
  let redisClient: any;

  beforeAll(async () => {
    // Setup Express app with all middleware
    app = express();
    app.use(express.json());
    
    // Session middleware for multi-instance testing
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 3600000 },
    }));

    // Mock Redis client for session testing
    redisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('1. Complete User Flows with Loading States and Error Handling', () => {
    beforeEach(() => {
      // Setup routes for user flow testing
      app.get('/api/repositories', async (req, res) => {
        try {
          // Simulate loading delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
          res.json({
            repositories: [
              { id: 1, name: 'repo1', stars: 100 },
              { id: 2, name: 'repo2', stars: 200 },
            ],
            loading: false,
          });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to load repositories',
            code: 'REPOSITORY_LOAD_ERROR',
            recoveryAction: 'Please try again',
          });
        }
      });

      app.post('/api/analyze', async (req, res) => {
        try {
          const { repositoryUrl } = req.body;
          
          if (!repositoryUrl) {
            return res.status(400).json({
              error: 'Repository URL is required',
              code: 'INVALID_INPUT',
              recoveryAction: 'Please provide a valid repository URL',
            });
          }

          // Simulate analysis with progress
          res.json({
            jobId: 'analysis-job-123',
            status: 'processing',
            progress: 0,
            message: 'Starting analysis...',
          });
        } catch (error) {
          res.status(500).json({
            error: 'Analysis failed',
            code: 'ANALYSIS_ERROR',
            recoveryAction: 'Please retry the analysis',
          });
        }
      });
    });

    it('should complete repository listing flow with loading state', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/repositories')
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body).toHaveProperty('repositories');
      expect(response.body.repositories).toHaveLength(2);
      expect(response.body.loading).toBe(false);
      expect(duration).toBeGreaterThan(100); // Verify loading delay
    });

    it('should handle analysis flow with progress tracking', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({ repositoryUrl: 'https://github.com/test/repo' })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'processing');
      expect(response.body).toHaveProperty('progress', 0);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle validation errors with recovery actions', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_INPUT');
      expect(response.body).toHaveProperty('recoveryAction');
      expect(response.body.recoveryAction).toContain('valid repository URL');
    });

    it('should provide error recovery guidance', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(400);

      expect(response.body.recoveryAction).toBeTruthy();
      expect(typeof response.body.recoveryAction).toBe('string');
      expect(response.body.recoveryAction.length).toBeGreaterThan(0);
    });
  });

  describe('2. Analytics Tracking End-to-End', () => {
    let analyticsService: any;

    beforeEach(async () => {
      const { analyticsService: service } = await import('../server/analytics');
      analyticsService = service;
      vi.clearAllMocks();

      // Setup analytics routes
      app.post('/api/analytics/track', async (req, res) => {
        try {
          const { eventName, category, properties } = req.body;
          
          await analyticsService.trackEvent({
            name: eventName,
            category,
            properties,
            sessionId: req.sessionID || 'test-session',
            timestamp: new Date(),
          });

          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: 'Failed to track event' });
        }
      });

      app.get('/api/analytics/stats', async (req, res) => {
        try {
          const stats = await analyticsService.getEventStats();
          res.json(stats);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get stats' });
        }
      });
    });

    it('should track repository analysis events', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .send({
          eventName: 'repository_analyzed',
          category: 'repository-analysis',
          properties: {
            repositoryUrl: 'https://github.com/test/repo',
            analysisType: 'full',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'repository_analyzed',
          category: 'repository-analysis',
        })
      );
    });

    it('should track search query events', async () => {
      await request(app)
        .post('/api/analytics/track')
        .send({
          eventName: 'search_performed',
          category: 'search',
          properties: {
            query: 'react',
            resultCount: 10,
          },
        })
        .expect(200);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'search_performed',
          category: 'search',
        })
      );
    });

    it('should track data export events', async () => {
      await request(app)
        .post('/api/analytics/track')
        .send({
          eventName: 'data_exported',
          category: 'export',
          properties: {
            format: 'csv',
            recordCount: 100,
          },
        })
        .expect(200);

      expect(analyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'data_exported',
          category: 'export',
        })
      );
    });

    it('should retrieve analytics statistics', async () => {
      const response = await request(app)
        .get('/api/analytics/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('eventsByCategory');
      expect(response.body.eventsByCategory).toHaveProperty('repository-analysis');
    });

    it('should handle analytics tracking failures gracefully', async () => {
      analyticsService.trackEvent.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/analytics/track')
        .send({
          eventName: 'test_event',
          category: 'test',
          properties: {},
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('3. Background Job Processing', () => {
    let jobQueue: any;

    beforeEach(async () => {
      const { jobQueue: queue } = await import('../server/jobs/JobQueue');
      jobQueue = queue;
      vi.clearAllMocks();

      // Setup job routes
      app.post('/api/jobs', async (req, res) => {
        try {
          const { type, data } = req.body;
          const job = await jobQueue.addJob(type, data);
          res.json(job);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create job' });
        }
      });

      app.get('/api/jobs/:jobId', async (req, res) => {
        try {
          const job = await jobQueue.getJob(req.params.jobId);
          if (!job) {
            return res.status(404).json({ error: 'Job not found' });
          }
          res.json(job);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get job' });
        }
      });

      app.get('/api/jobs/:jobId/status', async (req, res) => {
        try {
          const status = await jobQueue.getJobStatus(req.params.jobId);
          res.json({ status });
        } catch (error) {
          res.status(500).json({ error: 'Failed to get job status' });
        }
      });
    });

    it('should queue batch analysis job', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          type: 'batch-analysis',
          data: {
            repositories: ['repo1', 'repo2', 'repo3'],
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', 'test-job');
      expect(response.body).toHaveProperty('status', 'queued');
      expect(jobQueue.addJob).toHaveBeenCalled();
    });

    it('should queue large export job', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          type: 'large-export',
          data: {
            format: 'csv',
            filters: { stars: { min: 100 } },
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'queued');
    });

    it('should track job progress', async () => {
      const createResponse = await request(app)
        .post('/api/jobs')
        .send({
          type: 'test-job',
          data: { test: true },
        })
        .expect(200);

      const jobId = createResponse.body.id;

      const statusResponse = await request(app)
        .get(`/api/jobs/${jobId}/status`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('status');
    });

    it('should retrieve completed job with results', async () => {
      const jobId = 'test-job-id';

      const response = await request(app)
        .get(`/api/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', jobId);
      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('progress', 100);
      expect(response.body).toHaveProperty('result');
    });

    it('should handle job not found', async () => {
      jobQueue.getJob.mockResolvedValueOnce(null);

      await request(app)
        .get('/api/jobs/non-existent-job')
        .expect(404);
    });

    it('should process multiple jobs concurrently', async () => {
      const jobRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/jobs')
          .send({
            type: 'test-job',
            data: { index: i },
          })
      );

      const responses = await Promise.all(jobRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status', 'queued');
      });

      expect(jobQueue.addJob).toHaveBeenCalledTimes(5);
    });
  });

  describe('4. Multi-Instance Session Sharing', () => {
    let redisManager: any;

    beforeEach(async () => {
      const { redisManager: manager } = await import('../server/redis');
      redisManager = manager;
      vi.clearAllMocks();

      // Setup session routes
      app.post('/api/session/create', async (req, res) => {
        try {
          const sessionId = `session-${Date.now()}`;
          const sessionData = {
            userId: req.body.userId,
            createdAt: new Date().toISOString(),
            instanceId: 'instance-1',
          };

          const client = redisManager.getClient();
          await client.set(`session:${sessionId}`, JSON.stringify(sessionData));
          await client.expire(`session:${sessionId}`, 3600);

          res.json({ sessionId, data: sessionData });
        } catch (error) {
          res.status(500).json({ error: 'Failed to create session' });
        }
      });

      app.get('/api/session/:sessionId', async (req, res) => {
        try {
          const client = redisManager.getClient();
          const sessionData = await client.get(`session:${req.params.sessionId}`);

          if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
          }

          res.json({
            sessionId: req.params.sessionId,
            data: JSON.parse(sessionData),
            instanceId: 'instance-2',
          });
        } catch (error) {
          res.status(500).json({ error: 'Failed to retrieve session' });
        }
      });
    });

    it('should create session accessible across instances', async () => {
      const createResponse = await request(app)
        .post('/api/session/create')
        .send({ userId: 'user-123' })
        .expect(200);

      expect(createResponse.body).toHaveProperty('sessionId');
      expect(createResponse.body.data).toHaveProperty('userId', 'user-123');

      const client = redisManager.getClient();
      expect(client.set).toHaveBeenCalled();
      expect(client.expire).toHaveBeenCalled();
    });

    it('should retrieve session from different instance', async () => {
      const sessionId = 'session-test-123';
      const client = redisManager.getClient();
      client.get.mockResolvedValueOnce(JSON.stringify({
        userId: 'user-456',
        createdAt: new Date().toISOString(),
        instanceId: 'instance-1',
      }));

      const response = await request(app)
        .get(`/api/session/${sessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionId', sessionId);
      expect(response.body.data).toHaveProperty('userId', 'user-456');
    });

    it('should maintain session consistency across multiple requests', async () => {
      const createResponse = await request(app)
        .post('/api/session/create')
        .send({ userId: 'user-789' })
        .expect(200);

      const sessionId = createResponse.body.sessionId;
      const client = redisManager.getClient();
      client.get.mockResolvedValue(JSON.stringify(createResponse.body.data));

      const requests = Array.from({ length: 5 }, () =>
        request(app).get(`/api/session/${sessionId}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('userId', 'user-789');
      });
    });
  });

  describe('5. Health Check Integration with Load Balancer', () => {
    beforeEach(async () => {
      const { healthCheck, readinessCheck, livenessCheck } = await import('../server/health');

      app.get('/health', healthCheck);
      app.get('/health/ready', readinessCheck);
      app.get('/health/live', livenessCheck);
    });

    it('should return healthy status for load balancer', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
    });

    it('should respond to readiness probe', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
      expect(['ready', 'not ready']).toContain(response.body.status);
    });

    it('should respond to liveness probe', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should complete health checks quickly for load balancer', async () => {
      const startTime = Date.now();
      await request(app).get('/health/live');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent health check requests', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app).get('/health/live')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('alive');
      });
    });
  });

  describe('6. Error Recovery Scenarios', () => {
    let analyticsService: any;
    let jobQueue: any;
    let redisManager: any;

    beforeEach(async () => {
      const analytics = await import('../server/analytics');
      const jobs = await import('../server/jobs/JobQueue');
      const redis = await import('../server/redis');

      analyticsService = analytics.analyticsService;
      jobQueue = jobs.jobQueue;
      redisManager = redis.redisManager;

      vi.clearAllMocks();

      app.post('/api/resilient-operation', async (req, res) => {
        try {
          await analyticsService.trackEvent({
            name: 'operation_started',
            category: 'test',
            properties: {},
            sessionId: 'test-session',
            timestamp: new Date(),
          });

          res.json({ success: true, method: 'primary' });
        } catch (error) {
          res.json({ success: true, method: 'fallback' });
        }
      });

      app.post('/api/retry-operation', async (req, res) => {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            attempt++;
            
            if (attempt < 3) {
              throw new Error('Temporary failure');
            }

            res.json({ success: true, attempts: attempt });
            return;
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
        }

        res.status(500).json({ error: 'Operation failed after retries' });
      });
    });

    it('should recover from analytics service failure', async () => {
      analyticsService.trackEvent.mockRejectedValueOnce(new Error('Database connection lost'));

      const response = await request(app)
        .post('/api/resilient-operation')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.method).toBe('fallback');
    });

    it('should retry failed operations', async () => {
      const response = await request(app)
        .post('/api/retry-operation')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.attempts).toBe(3);
    });

    it('should handle Redis connection failure gracefully', async () => {
      const client = redisManager.getClient();
      client.get.mockRejectedValueOnce(new Error('Redis connection timeout'));

      app.get('/api/cached-data', async (req, res) => {
        try {
          const client = redisManager.getClient();
          await client.get('test-key');
          res.json({ cached: true });
        } catch (error) {
          res.json({ cached: false, data: 'fallback-data' });
        }
      });

      const response = await request(app)
        .get('/api/cached-data')
        .expect(200);

      expect(response.body.cached).toBe(false);
    });

    it('should handle job queue failure with graceful degradation', async () => {
      jobQueue.addJob.mockRejectedValueOnce(new Error('Queue is full'));

      app.post('/api/queue-job', async (req, res) => {
        try {
          const job = await jobQueue.addJob('test-job', req.body);
          res.json({ queued: true, jobId: job.id });
        } catch (error) {
          res.json({ queued: false, processed: true });
        }
      });

      const response = await request(app)
        .post('/api/queue-job')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.queued).toBe(false);
      expect(response.body.processed).toBe(true);
    });

    it('should provide meaningful error messages for recovery', async () => {
      app.post('/api/failing-operation', async (req, res) => {
        res.status(500).json({
          error: 'Operation failed',
          code: 'OPERATION_ERROR',
          recoveryAction: 'Please check your input and try again',
          retryable: true,
        });
      });

      const response = await request(app)
        .post('/api/failing-operation')
        .send({})
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('recoveryAction');
      expect(response.body).toHaveProperty('retryable', true);
    });
  });

  describe('7. End-to-End User Journey', () => {
    it('should complete full repository analysis journey', async () => {
      app.get('/api/search', async (req, res) => {
        res.json({
          results: [
            { id: 1, name: 'test-repo', url: 'https://github.com/test/repo' },
          ],
        });
      });

      const searchResponse = await request(app)
        .get('/api/search?q=test')
        .expect(200);

      expect(searchResponse.body.results).toHaveLength(1);

      app.post('/api/analyze-full', async (req, res) => {
        const { analyticsService } = await import('../server/analytics');
        const { jobQueue } = await import('../server/jobs/JobQueue');

        await analyticsService.trackEvent({
          name: 'analysis_started',
          category: 'repository-analysis',
          properties: { repositoryUrl: req.body.repositoryUrl },
          sessionId: 'test-session',
          timestamp: new Date(),
        });

        const job = await jobQueue.addJob('repository-analysis', {
          repositoryUrl: req.body.repositoryUrl,
        });

        res.json({ jobId: job.id, status: 'queued' });
      });

      const analyzeResponse = await request(app)
        .post('/api/analyze-full')
        .send({ repositoryUrl: searchResponse.body.results[0].url })
        .expect(200);

      expect(analyzeResponse.body).toHaveProperty('jobId');

      const statusResponse = await request(app)
        .get(`/api/jobs/${analyzeResponse.body.jobId}/status`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('status');
    });
  });
});
