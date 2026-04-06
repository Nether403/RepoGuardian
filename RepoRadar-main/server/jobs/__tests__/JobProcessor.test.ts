import { describe, it, expect, vi } from 'vitest';
import { BaseJobProcessor } from '../JobProcessor';
import { Job } from '../Job';

// Test implementation of BaseJobProcessor
class TestJobProcessor extends BaseJobProcessor<{ value: number }> {
  async process(job: Job<{ value: number }>): Promise<number> {
    // Simulate processing with progress updates
    this.updateProgress(job, 25);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.updateProgress(job, 50);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.updateProgress(job, 75);
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result = job.data.value * 2;
    this.handleComplete(job, result);
    
    return result;
  }
}

class FailingJobProcessor extends BaseJobProcessor<{ shouldFail: boolean }> {
  async process(job: Job<{ shouldFail: boolean }>): Promise<void> {
    if (job.data.shouldFail) {
      const error = new Error('Processing failed');
      this.handleError(job, error);
      throw error;
    }
    
    this.handleComplete(job, { success: true });
  }
}

describe('BaseJobProcessor', () => {
  describe('process with progress tracking', () => {
    it('should process job and update progress', async () => {
      const processor = new TestJobProcessor();
      const job = new Job('test-job', { value: 10 });
      
      const progressUpdates: number[] = [];
      processor.onProgress = (progress) => {
        progressUpdates.push(progress);
      };

      const result = await processor.process(job);

      expect(result).toBe(20);
      expect(progressUpdates).toEqual([25, 50, 75]);
      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.result).toBe(20);
    });

    it('should call onComplete callback', async () => {
      const processor = new TestJobProcessor();
      const job = new Job('test-job', { value: 5 });
      
      const onComplete = vi.fn();
      processor.onComplete = onComplete;

      await processor.process(job);

      expect(onComplete).toHaveBeenCalledWith(10);
    });
  });

  describe('error handling', () => {
    it('should handle job failure', async () => {
      const processor = new FailingJobProcessor();
      const job = new Job('test-job', { shouldFail: true });
      
      const onError = vi.fn();
      processor.onError = onError;

      await expect(processor.process(job)).rejects.toThrow('Processing failed');

      expect(job.status).toBe('failed');
      expect(job.error).toBe('Processing failed');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle job success', async () => {
      const processor = new FailingJobProcessor();
      const job = new Job('test-job', { shouldFail: false });
      
      const onComplete = vi.fn();
      processor.onComplete = onComplete;

      await processor.process(job);

      expect(job.status).toBe('completed');
      expect(job.result).toEqual({ success: true });
      expect(onComplete).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('callbacks', () => {
    it('should work without callbacks', async () => {
      const processor = new TestJobProcessor();
      const job = new Job('test-job', { value: 3 });

      // Should not throw even without callbacks
      const result = await processor.process(job);

      expect(result).toBe(6);
      expect(job.status).toBe('completed');
    });
  });
});
