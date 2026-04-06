import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CheckCircle2, XCircle, Clock, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobData {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface JobProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * JobProgress Component
 * Displays real-time progress for a background job
 */
export function JobProgress({
  jobId,
  onComplete,
  onError,
  onCancel,
  autoRefresh = true,
  refreshInterval = 2000,
}: JobProgressProps) {
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchJobStatus = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data = await response.json();
      setJob(data.job);
      setError(null);

      // Call callbacks based on status
      if (data.job.status === 'completed' && onComplete) {
        onComplete(data.job.result);
      } else if (data.job.status === 'failed' && onError) {
        onError(data.job.error || 'Job failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching job status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel job');
      }

      toast({
        title: 'Job Cancelled',
        description: 'The job has been cancelled successfully.',
      });

      if (onCancel) {
        onCancel();
      }

      // Refresh job status
      await fetchJobStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to cancel job: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchJobStatus();

    // Set up auto-refresh if enabled and job is not in terminal state
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (job && (job.status === 'queued' || job.status === 'processing')) {
          fetchJobStatus();
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [jobId, autoRefresh, refreshInterval, job?.status]);

  if (loading && !job) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading job status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !job) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center text-destructive">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return null;
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'cancelled':
        return <X className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return '';
    }
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return 'Not started';
    
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const canCancel = job.status === 'queued' || job.status === 'processing';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">Job Progress</CardTitle>
          </div>
          <Badge className={getStatusColor()} variant="outline">
            {job.status.toUpperCase()}
          </Badge>
        </div>
        <CardDescription>
          Job ID: {job.id} • Type: {job.type}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(job.status === 'processing' || job.status === 'queued') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-2" />
          </div>
        )}

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Created:</span>
            <p className="font-medium">
              {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
          
          {job.startedAt && (
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <p className="font-medium">
                {formatDuration(job.startedAt, job.completedAt)}
              </p>
            </div>
          )}
          
          <div>
            <span className="text-muted-foreground">Attempts:</span>
            <p className="font-medium">
              {job.attempts} / {job.maxAttempts}
            </p>
          </div>
          
          {job.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed:</span>
              <p className="font-medium">
                {new Date(job.completedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {job.status === 'failed' && job.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Error:</p>
            <p>{job.error}</p>
          </div>
        )}

        {/* Result Preview */}
        {job.status === 'completed' && job.result && (
          <div className="rounded-md bg-green-50 p-3 text-sm">
            <p className="font-medium text-green-900">Completed Successfully</p>
            {typeof job.result === 'object' && (
              <p className="text-green-700 mt-1">
                {Object.keys(job.result).length} items processed
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchJobStatus}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </Button>
          
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
            >
              Cancel Job
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
