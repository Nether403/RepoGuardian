import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createJobRouter } from '../jobRoutes';
import { jobQueue } from '../JobQueue';
import { Job } from '../Job';

describe('Job Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/jobs', createJobRouter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/jobs/:jobId', () => {
    it('should return job status for existing job', async () => {
      const mockJob = new Job('test-job', { test: 'data' });
      mockJob.id = 'test-job-123';
      mockJob.status = 'processing';
      mockJob.progress = 50;

      vi.spyOn(jobQueue, 'getJob').mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/jobs/test-job-123')
        .expect(200);

      expect(response.body).toHaveProperty('job');
      expect(response.body.job.id).toBe('test-job-123');
      expect(response.body.job.status).toBe('processing');
      expect(response.body.job.progress).toBe(50);
    });

    it('should return 404 for non-existent job', async () => {
      vi.spyOn(jobQueue, 'getJob').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/jobs/non-existent-job')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Job not found');
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(jobQueue, 'getJob').mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/jobs/test-job-123')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to fetch job status');
    });
  });

  describe('GET /api/jobs', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };

      vi.spyOn(jobQueue, 'getStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/jobs')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toEqual(mockStats);
    });

    it('should accept filter parameters', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };

      vi.spyOn(jobQueue, 'getStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/jobs?status=completed&type=batch-analysis&limit=20&offset=10')
        .expect(200);

      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters.status).toBe('completed');
      expect(response.body.filters.type).toBe('batch-analysis');
      expect(response.body.filters.limit).toBe(20);
      expect(response.body.filters.offset).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(jobQueue, 'getStats').mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .get('/api/jobs')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to fetch job list');
    });
  });

  describe('DELETE /api/jobs/:jobId', () => {
    it('should cancel a job successfully', async () => {
      vi.spyOn(jobQueue, 'cancelJob').mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/jobs/test-job-123')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');
    });

    it('should return 404 for non-existent job', async () => {
      vi.spyOn(jobQueue, 'cancelJob').mockRejectedValue(
        new Error('Job test-job-123 not found')
      );

      const response = await request(app)
        .delete('/api/jobs/test-job-123')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 for jobs that cannot be cancelled', async () => {
      vi.spyOn(jobQueue, 'cancelJob').mockRejectedValue(
        new Error('Cannot cancel job test-job-123 in state: completed')
      );

      const response = await request(app)
        .delete('/api/jobs/test-job-123')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Cannot cancel job');
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(jobQueue, 'cancelJob').mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .delete('/api/jobs/test-job-123')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to cancel job');
    });
  });

  describe('GET /api/jobs/stats/queue', () => {
    it('should return queue statistics with timestamp', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };

      vi.spyOn(jobQueue, 'getStats').mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/jobs/stats/queue')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.stats).toEqual(mockStats);
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(jobQueue, 'getStats').mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .get('/api/jobs/stats/queue')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to fetch queue statistics');
    });
  });
});
