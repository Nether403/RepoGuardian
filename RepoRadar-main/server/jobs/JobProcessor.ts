import type { Job } from './Job';

/**
 * Job Processor Interface
 * Defines the contract for processing different types of jobs
 */
export interface JobProcessor<T = any> {
  /**
   * Process the job
   * @param job - The job to process
   * @returns The result of the job processing
   */
  process(job: Job<T>): Promise<any>;

  /**
   * Optional callback for progress updates
   * @param progress - Progress percentage (0-100)
   */
  onProgress?(progress: number): void;

  /**
   * Optional callback when job completes successfully
   * @param result - The result of the job
   */
  onComplete?(result: any): void;

  /**
   * Optional callback when job fails
   * @param error - The error that occurred
   */
  onError?(error: Error): void;
}

/**
 * Base Job Processor
 * Provides common functionality for job processors
 */
export abstract class BaseJobProcessor<T = any> implements JobProcessor<T> {
  /**
   * Process the job - must be implemented by subclasses
   */
  abstract process(job: Job<T>): Promise<any>;

  /**
   * Update job progress
   */
  protected updateProgress(job: Job<T>, progress: number): void {
    job.updateProgress(progress);
    this.onProgress?.(progress);
  }

  /**
   * Handle job completion
   */
  protected handleComplete(job: Job<T>, result: any): void {
    job.markComplete(result);
    this.onComplete?.(result);
  }

  /**
   * Handle job error
   */
  protected handleError(job: Job<T>, error: Error): void {
    job.markFailed(error);
    this.onError?.(error);
  }

  /**
   * Optional progress callback
   */
  onProgress?(progress: number): void;

  /**
   * Optional completion callback
   */
  onComplete?(result: any): void;

  /**
   * Optional error callback
   */
  onError?(error: Error): void;
}
