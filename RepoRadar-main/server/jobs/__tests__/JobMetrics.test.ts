import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobMetrics } from '../JobMetrics';
import { Job } from '../Job';

describe('JobMetrics', () => {
  let metrics: JobMetrics;

  beforeEach(() => {
    metrics = new JobMetrics();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should record job start', () => {
    const job = new Job('batch-analysis', { repositories: [] });
    job.markProcessing();

    metrics.recordJobStart(job);

    const timing = metrics.getJobTiming(job.id);
    expect(timing).toBeDefined();
    expect(timing?.jobId).toBe(job.id);
    expect(timing?.jobType).toBe('batch-analysis');
    expect(timing?.startTime).toBeInstanceOf(Date);
  });

  it('should record job completion', () => {
    const job = new Job('batch-analysis', { repositories: [] });
    job.markProcessing();

    metrics.recordJobStart(job);
    
    // Simulate some processing time
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);
    
    metrics.recordJobComplete(job);

    const timing = metrics.getJobTiming(job.id);
    expect(timing?.status).toBe('completed');
    expect(timing?.endTime).toBeInstanceOf(Date);
    expect(timing?.processingTime).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('should record job failure', () => {
    const job = new Job('export', { format: 'csv', exportType: 'analyses' });
    job.markProcessing();

    metrics.recordJobStart(job);
    
    const error = new Error('Export failed');
    metrics.recordJobFailed(job, error);

    const timing = metrics.getJobTiming(job.id);
    expect(timing?.status).toBe('failed');
    expect(timing?.error).toBe('Export failed');
  });

  it('should calculate metrics for job type', () => {
    const job1 = new Job('batch-analysis', { repositories: [] });
    const job2 = new Job('batch-analysis', { repositories: [] });

    job1.markProcessing();
    job2.markProcessing();

    metrics.recordJobStart(job1);
    metrics.recordJobStart(job2);

    metrics.recordJobComplete(job1);
    metrics.recordJobFailed(job2, new Error('Failed'));

    const jobMetrics = metrics.getMetricsForJobType('batch-analysis');
    expect(jobMetrics).toBeDefined();
    expect(jobMetrics?.totalJobs).toBe(2);
    expect(jobMetrics?.completedJobs).toBe(1);
    expect(jobMetrics?.failedJobs).toBe(1);
    expect(jobMetrics?.successRate).toBe(50);
  });

  it('should calculate overall metrics summary', () => {
    // Create jobs of different types
    const batchJob = new Job('batch-analysis', { repositories: [] });
    const exportJob = new Job('export', { format: 'csv', exportType: 'analyses' });

    batchJob.markProcessing();
    exportJob.markProcessing();

    metrics.recordJobStart(batchJob);
    metrics.recordJobStart(exportJob);

    metrics.recordJobComplete(batchJob);
    metrics.recordJobComplete(exportJob);

    const summary = metrics.getMetricsSummary();
    expect(summary.totalJobs).toBe(2);
    expect(summary.completedJobs).toBe(2);
    expect(summary.failedJobs).toBe(0);
    expect(summary.overallSuccessRate).toBe(100);
    expect(summary.jobTypeBreakdown).toHaveLength(2);
  });

  it('should track average processing time', () => {
    vi.useFakeTimers();

    const job1 = new Job('batch-analysis', { repositories: [] });
    const job2 = new Job('batch-analysis', { repositories: [] });

    job1.markProcessing();
    metrics.recordJobStart(job1);
    vi.advanceTimersByTime(1000);
    metrics.recordJobComplete(job1);

    job2.markProcessing();
    metrics.recordJobStart(job2);
    vi.advanceTimersByTime(2000);
    metrics.recordJobComplete(job2);

    const jobMetrics = metrics.getMetricsForJobType('batch-analysis');
    expect(jobMetrics?.averageProcessingTime).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('should get recent job timings', () => {
    const jobs = Array.from({ length: 5 }, (_, i) => 
      new Job('batch-analysis', { repositories: [] })
    );

    jobs.forEach(job => {
      job.markProcessing();
      metrics.recordJobStart(job);
    });

    const recentTimings = metrics.getRecentJobTimings(3);
    expect(recentTimings).toHaveLength(3);
  });

  it('should clear old timings', () => {
    vi.useFakeTimers();

    const oldJob = new Job('batch-analysis', { repositories: [] });
    oldJob.markProcessing();
    metrics.recordJobStart(oldJob);

    // Advance time by 2 days
    vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

    const newJob = new Job('batch-analysis', { repositories: [] });
    newJob.markProcessing();
    metrics.recordJobStart(newJob);

    // Clear timings older than 1 day
    metrics.clearOldTimings(24 * 60 * 60 * 1000);

    expect(metrics.getJobTiming(oldJob.id)).toBeNull();
    expect(metrics.getJobTiming(newJob.id)).toBeDefined();

    vi.useRealTimers();
  });

  it('should reset all metrics', () => {
    const job = new Job('batch-analysis', { repositories: [] });
    job.markProcessing();

    metrics.recordJobStart(job);
    metrics.recordJobComplete(job);

    expect(metrics.getAllMetrics()).toHaveLength(1);

    metrics.reset();

    expect(metrics.getAllMetrics()).toHaveLength(0);
    expect(metrics.getJobTiming(job.id)).toBeNull();
  });

  it('should handle metrics for multiple job types', () => {
    const batchJob = new Job('batch-analysis', { repositories: [] });
    const exportJob = new Job('export', { format: 'csv', exportType: 'analyses' });

    batchJob.markProcessing();
    exportJob.markProcessing();

    metrics.recordJobStart(batchJob);
    metrics.recordJobStart(exportJob);

    metrics.recordJobComplete(batchJob);
    metrics.recordJobComplete(exportJob);

    const allMetrics = metrics.getAllMetrics();
    expect(allMetrics).toHaveLength(2);
    
    const batchMetrics = metrics.getMetricsForJobType('batch-analysis');
    const exportMetrics = metrics.getMetricsForJobType('export');

    expect(batchMetrics?.totalJobs).toBe(1);
    expect(exportMetrics?.totalJobs).toBe(1);
  });
});
