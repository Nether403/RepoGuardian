import { Router, Request, Response } from 'express';
import { jobQueue } from './JobQueue';
import { Job } from './Job';

/**
 * Job Status API Routes
 * Provides endpoints for tracking and managing background jobs
 */

export function createJobRouter(): Router {
  const router = Router();

  /**
   * Get job status by ID
   * GET /api/jobs/:jobId
   */
  router.get('/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      const job = await jobQueue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          error: 'Job not found',
          message: `No job found with ID: ${jobId}` 
        });
      }

      res.json({
        job: job.toJSON(),
      });
    } catch (error) {
      console.error('Error fetching job status:', error);
      res.status(500).json({ 
        error: 'Failed to fetch job status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get list of jobs (admin only)
   * GET /api/jobs
   * Query params: status, type, limit, offset
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, type, limit = '50', offset = '0' } = req.query;
      
      // Get queue statistics
      const stats = await jobQueue.getStats();
      
      // For now, return stats and a message
      // In a production system, you'd want to store job metadata in a database
      // and query it here with proper filtering and pagination
      res.json({
        stats,
        message: 'Job list endpoint - full implementation requires job metadata storage',
        filters: {
          status: status || 'all',
          type: type || 'all',
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        }
      });
    } catch (error) {
      console.error('Error fetching job list:', error);
      res.status(500).json({ 
        error: 'Failed to fetch job list',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Cancel a job
   * DELETE /api/jobs/:jobId
   */
  router.delete('/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      await jobQueue.cancelJob(jobId);
      
      res.json({
        success: true,
        message: `Job ${jobId} cancelled successfully`,
      });
    } catch (error) {
      console.error('Error cancelling job:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ 
          error: 'Job not found',
          message: errorMessage
        });
      }
      
      if (errorMessage.includes('Cannot cancel')) {
        return res.status(400).json({ 
          error: 'Cannot cancel job',
          message: errorMessage
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to cancel job',
        message: errorMessage
      });
    }
  });

  /**
   * Get queue statistics
   * GET /api/jobs/stats
   */
  router.get('/stats/queue', async (req: Request, res: Response) => {
    try {
      const stats = await jobQueue.getStats();
      
      res.json({
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch queue statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
