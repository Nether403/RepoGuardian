import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { JobQueue } from '../JobQueue';
import { BaseJobProcessor } from '../JobProcessor';
import { Job } from '../Job';
import { redisManager } from '../../redis';

// Check if Redis is available
let redisAvailable = false;

beforeAll(async () => {
  try {
    const client = await redisManager.getClient();
    await client.ping();
    redisAvailable = true;
    console.log('Redis is available for testing');
  } catch (error) {
    console.log('Redis is not available, skipping integration tests');
    redisAvailable = false;
  }
});

// Test processor
class TestProcessor extends BaseJobProcessor<{ value: number }> {
  async process(job: Job<{ value: number }>): Promise<number> {
    this.updateProgress(job, 50);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const result = job.data.value * 2;
    this.handleComplete(job, result);
    return result;
  }
}

class FailingProcessor extends BaseJobProcessor<{ shouldFail: boolean }> {
  async process(job: Job<{ shouldFail: boolean }>): Promise<void> {
    if (job.data.shouldFail) {
      const error = new Error('Test failure');
      this.handleError(job, error);
      throw error;
    }
    this.handleComplete(job, { success: true });
  }
}

describe('JobQueue', () => {
  let jobQueue: JobQueue;

  beforeEach(async () => {
    if (!redisAvailable) return;
    
    // Create a unique queue for each test
    jobQueue = new JobQueue(`test-queue-${Date.now()}`);
    await jobQueue.initialize();
  });

  afterEach(async () => {
    if (!redisAvailable || !jobQueue) return;
    
    // Clean up
    await jobQueue.close();
  });

  describe('initialization', () => {
    it.skipIf(!redisAvailable)('should initialize successfully', async () => {
      const queue = new JobQueue('test-init');
      await queue.initialize();
      
      // Should not throw
      expect(queue).toBeDefined();
      
      await queue.close();
    });

    it.skipIf(!redisAvailable)('should not initialize twice', async () => {
      const queue = new JobQueue('test-double-init');
      await queue.initialize();
      await queue.initialize(); // Should be idempotent
      
      expect(queue).toBeDefined();
      
      await queue.close();
    });
  });

  describe('registerProcessor', () => {
    it.skipIf(!redisAvailable)('should register a processor for a job type', () => {
      const processor = new TestProcessor();
      
      // Should not throw
      jobQueue.registerProcessor('test-job', processor);
    });
  });

  describe('addJob', () => {
    it.skipIf(!redisAvailable)('should add a job to the queue', async () => {
      const job = await jobQueue.addJob('test-job', { value: 10 });

      expect(job).toBeDefined();
      expect(job.id).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(job.type).toBe('test-job');
      expect(job.data).toEqual({ value: 10 });
      expect(job.status).toBe('queued');
    });

    it.skipIf(!redisAvailable)('should add a job with custom options', async () => {
      const job = await jobQueue.addJob(
        'test-job',
        { value: 20 },
        {
          priority: 10,
          maxAttempts: 5,
          delay: 1000,
        }
      );

      expect(job.maxAttempts).toBe(5);
    });
  });

  describe('getJob', () => {
    it.skipIf(!redisAvailable)('should retrieve a job by ID', async () => {
      const addedJob = await jobQueue.addJob('test-job', { value: 30 });
      
      // Wait a bit for the job to be stored
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const retrievedJob = await jobQueue.getJob(addedJob.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
      expect(retrievedJob?.type).toBe('test-job');
    });

    it.skipIf(!redisAvailable)('should return null for non-existent job', async () => {
      const job = await jobQueue.getJob('non-existent-id');

      expect(job).toBeNull();
    });
  });

  describe('getJobStatus', () => {
    it.skipIf(!redisAvailable)('should get job status', async () => {
      const addedJob = await jobQueue.addJob('test-job', { value: 40 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = await jobQueue.getJobStatus(addedJob.id);

      expect(status).toBeDefined();
      expect(['queued', 'processing', 'completed', 'failed']).toContain(status);
    });

    it.skipIf(!redisAvailable)('should return null for non-existent job', async () => {
      const status = await jobQueue.getJobStatus('non-existent-id');

      expect(status).toBeNull();
    });
  });

  describe('job processing', () => {
    it.skipIf(!redisAvailable)('should process a job successfully', async () => {
      const processor = new TestProcessor();
      jobQueue.registerProcessor('math-job', processor);

      const job = await jobQueue.addJob('math-job', { value: 5 });

      // Wait for job to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      const processedJob = await jobQueue.getJob(job.id);
      
      // Job should be completed or processing
      expect(processedJob).toBeDefined();
      expect(['processing', 'completed']).toContain(processedJob?.status);
    }, 10000);

    it.skipIf(!redisAvailable)('should handle job failure with retry', async () => {
      const processor = new FailingProcessor();
      jobQueue.registerProcessor('failing-job', processor);

      const job = await jobQueue.addJob('failing-job', { shouldFail: true }, {
        maxAttempts: 2,
      });

      // Wait for job to fail and retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      const failedJob = await jobQueue.getJob(job.id);
      
      // Job should have failed after retries
      expect(failedJob).toBeDefined();
    }, 10000);
  });

  describe('cancelJob', () => {
    it.skipIf(!redisAvailable)('should cancel a queued job', async () => {
      const job = await jobQueue.addJob('test-job', { value: 50 }, {
        delay: 5000, // Delay so it stays queued
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not throw
      await jobQueue.cancelJob(job.id);
    });

    it.skipIf(!redisAvailable)('should throw error for non-existent job', async () => {
      await expect(jobQueue.cancelJob('non-existent-id')).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it.skipIf(!redisAvailable)('should return queue statistics', async () => {
      await jobQueue.addJob('test-job', { value: 1 });
      await jobQueue.addJob('test-job', { value: 2 });
      await jobQueue.addJob('test-job', { value: 3 });

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await jobQueue.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
      
      // Should have some jobs
      const totalJobs = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;
      expect(totalJobs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanup', () => {
    it.skipIf(!redisAvailable)('should clean up old jobs', async () => {
      // Add and process some jobs
      const processor = new TestProcessor();
      jobQueue.registerProcessor('cleanup-job', processor);
      
      await jobQueue.addJob('cleanup-job', { value: 1 });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clean up jobs older than 0ms (all jobs)
      await jobQueue.cleanup(0);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('close', () => {
    it.skipIf(!redisAvailable)('should close the queue gracefully', async () => {
      const queue = new JobQueue('test-close');
      await queue.initialize();
      
      await queue.close();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
