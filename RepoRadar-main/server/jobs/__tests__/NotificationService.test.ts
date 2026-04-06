import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../NotificationService';
import { Job } from '../Job';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should notify on job completion', async () => {
    const job = new Job('batch-analysis', {
      repositories: [{ url: 'test', owner: 'test', repo: 'test' }],
    });

    const result = {
      totalRepositories: 1,
      successfulAnalyses: 1,
      failedAnalyses: 0,
      results: [],
    };

    await notificationService.notifyJobComplete(job, result);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`Job ${job.id} completed successfully`)
    );
  });

  it('should notify on job failure', async () => {
    const job = new Job('export', { format: 'csv', exportType: 'analyses' });
    const error = new Error('Export failed');

    await notificationService.notifyJobFailed(job, error);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Job ${job.id} failed`),
      'Export failed'
    );
  });

  it('should notify on significant progress milestones', async () => {
    const job = new Job('batch-analysis', { repositories: [] });

    // Should notify on 25% progress
    await notificationService.notifyJobProgress(job, 25);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`Job ${job.id} progress: 25%`)
    );

    // Should notify on 50% progress
    await notificationService.notifyJobProgress(job, 50);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`Job ${job.id} progress: 50%`)
    );

    // Should not notify on non-milestone progress
    vi.mocked(console.log).mockClear();
    await notificationService.notifyJobProgress(job, 33);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should summarize batch analysis results', async () => {
    const job = new Job('batch-analysis', { repositories: [] });
    const result = {
      totalRepositories: 10,
      successfulAnalyses: 8,
      failedAnalyses: 2,
      results: [],
    };

    await notificationService.notifyJobComplete(job, result);

    expect(console.log).toHaveBeenCalledWith(
      '[NOTIFICATION]',
      expect.stringContaining('Analyzed 10 repositories: 8 successful, 2 failed')
    );
  });

  it('should summarize export results', async () => {
    const job = new Job('export', { format: 'csv', exportType: 'analyses' });
    const result = {
      format: 'csv',
      recordCount: 100,
      data: 'test data',
      fileName: 'export.csv',
    };

    await notificationService.notifyJobComplete(job, result);

    expect(console.log).toHaveBeenCalledWith(
      '[NOTIFICATION]',
      expect.stringContaining('Exported 100 records in CSV format')
    );
  });
});
