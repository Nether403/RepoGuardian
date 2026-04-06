import { Queue, Worker, Job as BullJob, QueueEvents } from 'bullmq';
import { redisManager } from '../redis';
import { Job, JobOptions, JobStatus } from './Job';
import type { JobProcessor } from './JobProcessor';
import { notificationService } from './NotificationService';
import { jobMetrics } from './JobMetrics';

/**
 * Job Queue Service
 * Manages background job processing using BullMQ and Redis
 */
export class JobQueue {
  private queue: Queue;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents;
  private processors: Map<string, JobProcessor> = new Map();
  private isInitialized = false;

  constructor(private queueName: string = 'default') {
    // Only initialize queue if Redis is enabled
    if (redisManager.isRedisEnabled()) {
      // Initialize queue and events (connection will be established lazily)
      this.queue = new Queue(queueName, {
        connection: this.getRedisConnection(),
      });

      this.queueEvents = new QueueEvents(queueName, {
        connection: this.getRedisConnection(),
      });

      this.setupEventHandlers();
    } else {
      console.log('JobQueue: Redis is disabled, job queue will not be available');
      // Create dummy objects to prevent null reference errors
      this.queue = null as any;
      this.queueEvents = null as any;
    }
  }

  /**
   * Check if job queue is available (Redis enabled)
   */
  private isQueueAvailable(): boolean {
    return redisManager.isRedisEnabled() && this.queue !== null;
  }

  /**
   * Get Redis connection configuration
   */
  private getRedisConnection() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const url = new URL(redisUrl);
    
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      maxRetriesPerRequest: null, // Required for BullMQ
    };
  }

  /**
   * Setup event handlers for queue monitoring
   */
  private setupEventHandlers(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed with result:`, returnvalue);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`Job ${jobId} progress:`, data);
    });
  }

  /**
   * Initialize the worker to process jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Check if Redis is enabled
    if (!redisManager.isRedisEnabled()) {
      console.log('Redis is disabled - job queue will not be available');
      return;
    }

    // Ensure Redis is connected
    try {
      await redisManager.getClient();
    } catch (error) {
      console.error('Failed to connect to Redis for job queue:', error);
      return;
    }

    // Create worker to process jobs
    this.worker = new Worker(
      this.queueName,
      async (bullJob: BullJob) => {
        return this.processJob(bullJob);
      },
      {
        connection: this.getRedisConnection(),
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Worker failed job ${job?.id}:`, err);
    });

    this.isInitialized = true;
    console.log(`JobQueue '${this.queueName}' initialized`);
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor);
    console.log(`Registered processor for job type: ${jobType}`);
  }

  /**
   * Add a job to the queue
   * Requirement 3.1: Graceful handling when Redis unavailable
   */
  async addJob<T>(jobType: string, data: T, options: JobOptions = {}): Promise<Job<T>> {
    if (!this.isQueueAvailable()) {
      console.warn(`Job queue is not available (Redis disabled) - job ${jobType} will not be queued`);
      throw new Error('Job queue is not available (Redis disabled). Background jobs are disabled.');
    }

    const job = new Job<T>(jobType, data, options);

    try {
      // Add to BullMQ queue
      await this.queue.add(
        jobType,
        {
          jobId: job.id,
          jobType,
          data,
        },
        {
          jobId: job.id,
          priority: options.priority,
          attempts: options.maxAttempts || 3,
          backoff: {
            type: 'exponential',
            delay: 1000, // Start with 1 second
          },
          removeOnComplete: false, // Keep completed jobs for tracking
          removeOnFail: false, // Keep failed jobs for debugging
          delay: options.delay,
        }
      );

      console.log(`Added job ${job.id} of type ${jobType} to queue`);
      return job;
    } catch (error) {
      console.error(`Failed to add job ${job.id} to queue:`, error);
      throw new Error(`Failed to queue job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a job from the queue
   */
  private async processJob(bullJob: BullJob): Promise<any> {
    const { jobId, jobType, data } = bullJob.data;

    console.log(`Processing job ${jobId} of type ${jobType}`);

    // Get the processor for this job type
    const processor = this.processors.get(jobType);
    if (!processor) {
      throw new Error(`No processor registered for job type: ${jobType}`);
    }

    // Create Job instance
    const job = new Job(jobType, data, {
      maxAttempts: bullJob.opts.attempts,
    });
    job.id = jobId;
    job.markProcessing();

    // Record job start in metrics
    jobMetrics.recordJobStart(job);

    // Setup progress tracking with notifications
    processor.onProgress = async (progress: number) => {
      job.updateProgress(progress);
      await bullJob.updateProgress(progress);
      await notificationService.notifyJobProgress(job, progress);
    };

    try {
      // Process the job
      const result = await processor.process(job);
      
      // Mark as complete
      job.markComplete(result);
      processor.onComplete?.(result);
      
      // Record metrics and send notification
      jobMetrics.recordJobComplete(job);
      await notificationService.notifyJobComplete(job, result);
      
      return result;
    } catch (error) {
      // Mark as failed
      const err = error instanceof Error ? error : new Error(String(error));
      job.markFailed(err);
      processor.onError?.(err);
      
      // Record metrics and send notification
      jobMetrics.recordJobFailed(job, err);
      await notificationService.notifyJobFailed(job, err);
      
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    const bullJob = await this.queue.getJob(jobId);
    if (!bullJob) {
      return null;
    }

    const { jobType, data } = bullJob.data;
    const job = new Job(jobType, data);
    job.id = jobId;

    // Map BullMQ state to our JobStatus
    const state = await bullJob.getState();
    job.status = this.mapBullJobState(state);
    job.progress = bullJob.progress as number || 0;
    job.attempts = bullJob.attemptsMade;

    if (bullJob.finishedOn) {
      job.completedAt = new Date(bullJob.finishedOn);
    }
    if (bullJob.processedOn) {
      job.startedAt = new Date(bullJob.processedOn);
    }
    if (bullJob.failedReason) {
      job.error = bullJob.failedReason;
    }
    if (bullJob.returnvalue) {
      job.result = bullJob.returnvalue;
    }

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.getJob(jobId);
    return job?.status || null;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const bullJob = await this.queue.getJob(jobId);
    if (!bullJob) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await bullJob.getState();
    if (state === 'completed' || state === 'failed') {
      throw new Error(`Cannot cancel job ${jobId} in state: ${state}`);
    }

    await bullJob.remove();
    console.log(`Cancelled job ${jobId}`);
  }

  /**
   * Map BullMQ job state to our JobStatus
   */
  private mapBullJobState(state: string): JobStatus {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return 'queued';
      case 'active':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'queued';
    }
  }

  /**
   * Get queue statistics
   * Requirement 3.1: Graceful handling when Redis unavailable
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.isQueueAvailable()) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    try {
      const counts = await this.queue.getJobCounts();
      return {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.queue.clean(olderThanMs, 100, 'completed');
    await this.queue.clean(olderThanMs, 100, 'failed');
    console.log(`Cleaned up jobs older than ${olderThanMs}ms`);
  }

  /**
   * Close the queue and worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queueEvents.close();
    await this.queue.close();
    this.isInitialized = false;
    console.log(`JobQueue '${this.queueName}' closed`);
  }
}

// Export singleton instance
export const jobQueue = new JobQueue('reporadar-jobs');
