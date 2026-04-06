import type { Job, JobStatus } from './Job';

/**
 * Job Metrics
 * Tracks and reports job processing metrics
 */
export interface JobMetricsData {
  jobType: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
  lastUpdated: Date;
}

export interface JobProcessingMetrics {
  jobId: string;
  jobType: string;
  status: JobStatus;
  startTime?: Date;
  endTime?: Date;
  processingTime?: number;
  attempts: number;
  error?: string;
}

/**
 * Job Metrics Service
 * Collects and analyzes job processing metrics
 */
export class JobMetrics {
  private metrics: Map<string, JobMetricsData> = new Map();
  private jobTimings: Map<string, JobProcessingMetrics> = new Map();

  /**
   * Record job start
   */
  recordJobStart(job: Job): void {
    const timing: JobProcessingMetrics = {
      jobId: job.id,
      jobType: job.type,
      status: job.status,
      startTime: new Date(),
      attempts: job.attempts,
    };

    this.jobTimings.set(job.id, timing);
    console.log(`[METRICS] Job ${job.id} started (type: ${job.type})`);
  }

  /**
   * Record job completion
   */
  recordJobComplete(job: Job): void {
    const timing = this.jobTimings.get(job.id);
    if (timing) {
      timing.endTime = new Date();
      timing.status = 'completed';
      
      if (timing.startTime) {
        timing.processingTime = timing.endTime.getTime() - timing.startTime.getTime();
      }

      this.updateMetrics(job.type, 'completed', timing.processingTime);
      console.log(`[METRICS] Job ${job.id} completed in ${timing.processingTime}ms`);
    }
  }

  /**
   * Record job failure
   */
  recordJobFailed(job: Job, error: Error): void {
    const timing = this.jobTimings.get(job.id);
    if (timing) {
      timing.endTime = new Date();
      timing.status = 'failed';
      timing.error = error.message;
      
      if (timing.startTime) {
        timing.processingTime = timing.endTime.getTime() - timing.startTime.getTime();
      }

      this.updateMetrics(job.type, 'failed', timing.processingTime);
      console.log(`[METRICS] Job ${job.id} failed after ${timing.processingTime}ms: ${error.message}`);
    }
  }

  /**
   * Update metrics for a job type
   */
  private updateMetrics(
    jobType: string,
    status: 'completed' | 'failed',
    processingTime?: number
  ): void {
    let metrics = this.metrics.get(jobType);

    if (!metrics) {
      metrics = {
        jobType,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        successRate: 0,
        lastUpdated: new Date(),
      };
      this.metrics.set(jobType, metrics);
    }

    metrics.totalJobs++;
    
    if (status === 'completed') {
      metrics.completedJobs++;
    } else {
      metrics.failedJobs++;
    }

    // Update average processing time
    if (processingTime !== undefined) {
      const totalTime = metrics.averageProcessingTime * (metrics.totalJobs - 1) + processingTime;
      metrics.averageProcessingTime = totalTime / metrics.totalJobs;
    }

    // Update success rate
    metrics.successRate = (metrics.completedJobs / metrics.totalJobs) * 100;
    metrics.lastUpdated = new Date();
  }

  /**
   * Get metrics for a specific job type
   */
  getMetricsForJobType(jobType: string): JobMetricsData | null {
    return this.metrics.get(jobType) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): JobMetricsData[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    overallSuccessRate: number;
    averageProcessingTime: number;
    jobTypeBreakdown: JobMetricsData[];
  } {
    const allMetrics = this.getAllMetrics();

    const totalJobs = allMetrics.reduce((sum, m) => sum + m.totalJobs, 0);
    const completedJobs = allMetrics.reduce((sum, m) => sum + m.completedJobs, 0);
    const failedJobs = allMetrics.reduce((sum, m) => sum + m.failedJobs, 0);
    
    const overallSuccessRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
    
    const totalProcessingTime = allMetrics.reduce(
      (sum, m) => sum + m.averageProcessingTime * m.totalJobs,
      0
    );
    const averageProcessingTime = totalJobs > 0 ? totalProcessingTime / totalJobs : 0;

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      overallSuccessRate,
      averageProcessingTime,
      jobTypeBreakdown: allMetrics,
    };
  }

  /**
   * Get job timing details
   */
  getJobTiming(jobId: string): JobProcessingMetrics | null {
    return this.jobTimings.get(jobId) || null;
  }

  /**
   * Get recent job timings
   */
  getRecentJobTimings(limit: number = 100): JobProcessingMetrics[] {
    const timings = Array.from(this.jobTimings.values());
    return timings
      .sort((a, b) => {
        const aTime = a.startTime?.getTime() || 0;
        const bTime = b.startTime?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  }

  /**
   * Clear old job timings to prevent memory leaks
   */
  clearOldTimings(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const [jobId, timing] of this.jobTimings.entries()) {
      const startTime = timing.startTime?.getTime() || 0;
      if (startTime < cutoffTime) {
        this.jobTimings.delete(jobId);
      }
    }

    console.log(`[METRICS] Cleared old job timings (older than ${olderThanMs}ms)`);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.jobTimings.clear();
    console.log('[METRICS] All metrics reset');
  }
}

// Export singleton instance
export const jobMetrics = new JobMetrics();
