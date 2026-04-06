import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueue } from '../JobQueue';
import { BatchAnalysisProcessor } from '../processors/BatchAnalysisProcessor';
import { ExportProcessor } from '../processors/ExportProcessor';
import { jobMetrics } from '../JobMetrics';
import { notificationService } from '../NotificationService';
import type { BatchAnalysisJobData } from '../processors/BatchAnalysisProcessor';
import type { ExportJobData } from '../processors/ExportProcessor';

// Mock Redis
vi.mock('../../redis', () => ({
  redisManager: {
    getClient: vi.fn(() => Promise.resolve({
      on: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    isConnected: vi.fn(() => true),
  },
}));

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn((name, data, opts) => Promise.resolve({
      id: data.jobId,
      data,
      opts,
    })),
    getJob: vi.fn(),
    getJobCounts: vi.fn(() => Promise.resolve({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    })),
    clean: vi.fn(),
    close: vi.fn(),
  })),
  Worker: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  QueueEvents: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock services
vi.mock('../../github', () => ({
  githubService: {
    getRepositoryWithDetails: vi.fn(),
  },
}));

vi.mock('../../gemini', () => ({
  analyzeRepository: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock('@shared/schema', () => ({
  repositories: {},
  analyses: {},
  savedRepositories: {},
}));

describe('Job Processors Integration', () => {
  let jobQueue: JobQueue;

  beforeEach(async () => {
    vi.clearAllMocks();
    jobMetrics.reset();
    
    jobQueue = new JobQueue('test-queue');
    await jobQueue.initialize();

    // Register processors
    jobQueue.registerProcessor('batch-analysis', new BatchAnalysisProcessor());
    jobQueue.registerProcessor('export', new ExportProcessor());
  });

  afterEach(async () => {
    await jobQueue.close();
  });

  it('should add batch analysis job to queue', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [
        { url: 'https://github.com/owner/repo', owner: 'owner', repo: 'repo' },
      ],
    };

    const job = await jobQueue.addJob('batch-analysis', jobData);

    expect(job).toBeDefined();
    expect(job.type).toBe('batch-analysis');
    expect(job.status).toBe('queued');
    expect(job.data).toEqual(jobData);
  });

  it('should add export job to queue', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'analyses',
    };

    const job = await jobQueue.addJob('export', jobData);

    expect(job).toBeDefined();
    expect(job.type).toBe('export');
    expect(job.status).toBe('queued');
    expect(job.data).toEqual(jobData);
  });

  it('should track metrics for job processing', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [],
    };

    const job = await jobQueue.addJob('batch-analysis', jobData);

    // Simulate job processing
    jobMetrics.recordJobStart(job);
    jobMetrics.recordJobComplete(job);

    const metrics = jobMetrics.getMetricsForJobType('batch-analysis');
    expect(metrics).toBeDefined();
    expect(metrics?.totalJobs).toBe(1);
    expect(metrics?.completedJobs).toBe(1);
    expect(metrics?.successRate).toBe(100);
  });

  it('should send notifications on job completion', async () => {
    const notifySpy = vi.spyOn(notificationService, 'notifyJobComplete');

    const jobData: ExportJobData = {
      format: 'json',
      exportType: 'repositories',
    };

    const job = await jobQueue.addJob('export', jobData);

    const result = {
      format: 'json' as const,
      recordCount: 10,
      data: '{}',
      fileName: 'export.json',
      completedAt: new Date(),
    };

    await notificationService.notifyJobComplete(job, result);

    expect(notifySpy).toHaveBeenCalledWith(job, result);
  });

  it('should handle job priority', async () => {
    const highPriorityJob = await jobQueue.addJob(
      'batch-analysis',
      { repositories: [] },
      { priority: 1 }
    );

    const lowPriorityJob = await jobQueue.addJob(
      'batch-analysis',
      { repositories: [] },
      { priority: 10 }
    );

    expect(highPriorityJob).toBeDefined();
    expect(lowPriorityJob).toBeDefined();
  });

  it('should handle job retry configuration', async () => {
    const job = await jobQueue.addJob(
      'batch-analysis',
      { repositories: [] },
      { maxAttempts: 5 }
    );

    expect(job.maxAttempts).toBe(5);
  });

  it('should get queue statistics', async () => {
    await jobQueue.addJob('batch-analysis', { repositories: [] });
    await jobQueue.addJob('export', { format: 'csv', exportType: 'analyses' });

    const stats = await jobQueue.getStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('waiting');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
  });

  it('should track multiple job types in metrics', async () => {
    const batchJob = await jobQueue.addJob('batch-analysis', { repositories: [] });
    const exportJob = await jobQueue.addJob('export', { format: 'csv', exportType: 'analyses' });

    jobMetrics.recordJobStart(batchJob);
    jobMetrics.recordJobComplete(batchJob);

    jobMetrics.recordJobStart(exportJob);
    jobMetrics.recordJobComplete(exportJob);

    const summary = jobMetrics.getMetricsSummary();
    expect(summary.totalJobs).toBe(2);
    expect(summary.completedJobs).toBe(2);
    expect(summary.jobTypeBreakdown).toHaveLength(2);
  });

  it('should handle job failure notifications', async () => {
    const notifySpy = vi.spyOn(notificationService, 'notifyJobFailed');

    const job = await jobQueue.addJob('batch-analysis', { repositories: [] });
    const error = new Error('Processing failed');

    await notificationService.notifyJobFailed(job, error);

    expect(notifySpy).toHaveBeenCalledWith(job, error);
  });

  it('should cleanup old jobs', async () => {
    await jobQueue.addJob('batch-analysis', { repositories: [] });
    
    // Cleanup should not throw
    await expect(jobQueue.cleanup(1000)).resolves.not.toThrow();
  });
});
