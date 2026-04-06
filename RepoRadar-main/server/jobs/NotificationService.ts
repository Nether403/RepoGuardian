import type { Job } from './Job';

/**
 * Notification Service
 * Handles job completion notifications
 */
export class NotificationService {
  /**
   * Send job completion notification
   */
  async notifyJobComplete(job: Job, result: any): Promise<void> {
    console.log(`Job ${job.id} completed successfully`);
    
    // In a production environment, this would:
    // 1. Send email notification if email is provided
    // 2. Send push notification to user's devices
    // 3. Create in-app notification
    // 4. Trigger webhooks if configured
    
    // For now, we'll log the notification
    this.logNotification({
      jobId: job.id,
      jobType: job.type,
      status: 'completed',
      result: this.summarizeResult(job.type, result),
      timestamp: new Date(),
    });
  }

  /**
   * Send job failure notification
   */
  async notifyJobFailed(job: Job, error: Error): Promise<void> {
    console.error(`Job ${job.id} failed:`, error.message);
    
    // In a production environment, this would:
    // 1. Send error notification to user
    // 2. Alert administrators for critical failures
    // 3. Create error tracking entry
    
    this.logNotification({
      jobId: job.id,
      jobType: job.type,
      status: 'failed',
      error: error.message,
      timestamp: new Date(),
    });
  }

  /**
   * Send job progress notification
   */
  async notifyJobProgress(job: Job, progress: number): Promise<void> {
    // Only notify on significant progress milestones
    if (progress % 25 === 0) {
      console.log(`Job ${job.id} progress: ${progress}%`);
      
      this.logNotification({
        jobId: job.id,
        jobType: job.type,
        status: 'in_progress',
        progress,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Summarize result for notification
   */
  private summarizeResult(jobType: string, result: any): string {
    switch (jobType) {
      case 'batch-analysis':
        return `Analyzed ${result.totalRepositories} repositories: ${result.successfulAnalyses} successful, ${result.failedAnalyses} failed`;
      
      case 'export':
        return `Exported ${result.recordCount} records in ${result.format.toUpperCase()} format`;
      
      default:
        return 'Job completed successfully';
    }
  }

  /**
   * Log notification (placeholder for actual notification system)
   */
  private logNotification(notification: {
    jobId: string;
    jobType: string;
    status: string;
    result?: string;
    error?: string;
    progress?: number;
    timestamp: Date;
  }): void {
    console.log('[NOTIFICATION]', JSON.stringify(notification, null, 2));
    
    // In production, this would:
    // 1. Store notification in database
    // 2. Send to notification queue
    // 3. Trigger real-time updates via WebSocket
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
