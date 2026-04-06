/**
 * Job Model
 * Represents a background job with status tracking and metadata
 */

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobOptions {
  priority?: number;
  maxAttempts?: number;
  timeout?: number;
  delay?: number;
}

export interface JobData<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  constructor(type: string, data: T, options: JobOptions = {}) {
    this.id = this.generateId();
    this.type = type;
    this.data = data;
    this.status = 'queued';
    this.progress = 0;
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || 3;
    this.createdAt = new Date();
  }

  /**
   * Generate unique job ID
   */
  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Update job progress (0-100)
   */
  updateProgress(progress: number): void {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
    this.progress = progress;
  }

  /**
   * Mark job as complete with result
   */
  markComplete(result: any): void {
    this.status = 'completed';
    this.progress = 100;
    this.result = result;
    this.completedAt = new Date();
  }

  /**
   * Mark job as failed with error
   */
  markFailed(error: Error): void {
    this.status = 'failed';
    this.error = error.message;
    this.completedAt = new Date();
  }

  /**
   * Mark job as cancelled
   */
  markCancelled(): void {
    this.status = 'cancelled';
    this.completedAt = new Date();
  }

  /**
   * Mark job as processing
   */
  markProcessing(): void {
    this.status = 'processing';
    this.startedAt = new Date();
    this.attempts++;
  }

  /**
   * Check if job can be retried
   */
  canRetry(): boolean {
    return this.attempts < this.maxAttempts && this.status === 'failed';
  }

  /**
   * Convert job to plain object
   */
  toJSON(): JobData<T> {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      status: this.status,
      progress: this.progress,
      result: this.result,
      error: this.error,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  /**
   * Create job from plain object
   */
  static fromJSON<T>(data: JobData<T>): Job<T> {
    const job = new Job<T>(data.type, data.data, {
      maxAttempts: data.maxAttempts,
    });
    
    job.id = data.id;
    job.status = data.status;
    job.progress = data.progress;
    job.result = data.result;
    job.error = data.error;
    job.attempts = data.attempts;
    job.createdAt = new Date(data.createdAt);
    job.startedAt = data.startedAt ? new Date(data.startedAt) : undefined;
    job.completedAt = data.completedAt ? new Date(data.completedAt) : undefined;
    
    return job;
  }
}
