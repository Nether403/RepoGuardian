import { describe, it, expect, beforeEach } from 'vitest';
import { Job, JobOptions } from '../Job';

describe('Job', () => {
  describe('constructor', () => {
    it('should create a job with default values', () => {
      const job = new Job('test-job', { foo: 'bar' });

      expect(job.id).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(job.type).toBe('test-job');
      expect(job.data).toEqual({ foo: 'bar' });
      expect(job.status).toBe('queued');
      expect(job.progress).toBe(0);
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.startedAt).toBeUndefined();
      expect(job.completedAt).toBeUndefined();
    });

    it('should create a job with custom options', () => {
      const options: JobOptions = {
        maxAttempts: 5,
        priority: 10,
        timeout: 30000,
      };

      const job = new Job('test-job', { foo: 'bar' }, options);

      expect(job.maxAttempts).toBe(5);
    });
  });

  describe('updateProgress', () => {
    let job: Job;

    beforeEach(() => {
      job = new Job('test-job', { foo: 'bar' });
    });

    it('should update progress within valid range', () => {
      job.updateProgress(50);
      expect(job.progress).toBe(50);

      job.updateProgress(100);
      expect(job.progress).toBe(100);

      job.updateProgress(0);
      expect(job.progress).toBe(0);
    });

    it('should throw error for progress < 0', () => {
      expect(() => job.updateProgress(-1)).toThrow('Progress must be between 0 and 100');
    });

    it('should throw error for progress > 100', () => {
      expect(() => job.updateProgress(101)).toThrow('Progress must be between 0 and 100');
    });
  });

  describe('markComplete', () => {
    it('should mark job as completed with result', () => {
      const job = new Job('test-job', { foo: 'bar' });
      const result = { success: true, data: 'test' };

      job.markComplete(result);

      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.result).toEqual(result);
      expect(job.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('markFailed', () => {
    it('should mark job as failed with error message', () => {
      const job = new Job('test-job', { foo: 'bar' });
      const error = new Error('Test error');

      job.markFailed(error);

      expect(job.status).toBe('failed');
      expect(job.error).toBe('Test error');
      expect(job.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('markCancelled', () => {
    it('should mark job as cancelled', () => {
      const job = new Job('test-job', { foo: 'bar' });

      job.markCancelled();

      expect(job.status).toBe('cancelled');
      expect(job.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('markProcessing', () => {
    it('should mark job as processing and increment attempts', () => {
      const job = new Job('test-job', { foo: 'bar' });

      job.markProcessing();

      expect(job.status).toBe('processing');
      expect(job.attempts).toBe(1);
      expect(job.startedAt).toBeInstanceOf(Date);

      job.markProcessing();
      expect(job.attempts).toBe(2);
    });
  });

  describe('canRetry', () => {
    it('should return true if job can be retried', () => {
      const job = new Job('test-job', { foo: 'bar' }, { maxAttempts: 3 });
      job.attempts = 2;
      job.status = 'failed';

      expect(job.canRetry()).toBe(true);
    });

    it('should return false if max attempts reached', () => {
      const job = new Job('test-job', { foo: 'bar' }, { maxAttempts: 3 });
      job.attempts = 3;
      job.status = 'failed';

      expect(job.canRetry()).toBe(false);
    });

    it('should return false if job is not failed', () => {
      const job = new Job('test-job', { foo: 'bar' }, { maxAttempts: 3 });
      job.attempts = 1;
      job.status = 'completed';

      expect(job.canRetry()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should convert job to plain object', () => {
      const job = new Job('test-job', { foo: 'bar' });
      job.updateProgress(50);
      job.markProcessing();

      const json = job.toJSON();

      expect(json).toEqual({
        id: job.id,
        type: 'test-job',
        data: { foo: 'bar' },
        status: 'processing',
        progress: 50,
        result: undefined,
        error: undefined,
        attempts: 1,
        maxAttempts: 3,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: undefined,
      });
    });
  });

  describe('fromJSON', () => {
    it('should create job from plain object', () => {
      const originalJob = new Job('test-job', { foo: 'bar' });
      originalJob.updateProgress(75);
      originalJob.markProcessing();
      originalJob.markComplete({ success: true });

      const json = originalJob.toJSON();
      const restoredJob = Job.fromJSON(json);

      expect(restoredJob.id).toBe(originalJob.id);
      expect(restoredJob.type).toBe(originalJob.type);
      expect(restoredJob.data).toEqual(originalJob.data);
      expect(restoredJob.status).toBe(originalJob.status);
      expect(restoredJob.progress).toBe(originalJob.progress);
      expect(restoredJob.result).toEqual(originalJob.result);
      expect(restoredJob.attempts).toBe(originalJob.attempts);
      expect(restoredJob.maxAttempts).toBe(originalJob.maxAttempts);
      expect(restoredJob.createdAt.getTime()).toBe(originalJob.createdAt.getTime());
      expect(restoredJob.startedAt?.getTime()).toBe(originalJob.startedAt?.getTime());
      expect(restoredJob.completedAt?.getTime()).toBe(originalJob.completedAt?.getTime());
    });
  });
});
