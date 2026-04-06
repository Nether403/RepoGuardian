import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { JobData } from './job-progress';

interface JobNotification {
  id: string;
  jobId: string;
  type: string;
  status: 'completed' | 'failed' | 'processing';
  message: string;
  timestamp: Date;
  read: boolean;
}

/**
 * JobNotifications Component
 * Displays a notification bell with job status updates
 */
export function JobNotifications() {
  const [notifications, setNotifications] = useState<JobNotification[]>([]);
  const [activeJobs, setActiveJobs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const unreadCount = notifications.filter(n => !n.read).length;

  /**
   * Track a job and add it to active jobs
   */
  const trackJob = (jobId: string, type: string) => {
    setActiveJobs(prev => new Set(prev).add(jobId));
    
    // Add initial notification
    const notification: JobNotification = {
      id: `${jobId}-started`,
      jobId,
      type,
      status: 'processing',
      message: `Job ${type} started`,
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [notification, ...prev]);
  };

  /**
   * Poll active jobs for status updates
   */
  const pollActiveJobs = async () => {
    if (activeJobs.size === 0) return;

    for (const jobId of activeJobs) {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        
        if (!response.ok) {
          // Job not found, remove from active jobs
          setActiveJobs(prev => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
          continue;
        }

        const data = await response.json();
        const job: JobData = data.job;

        // Check if job is in terminal state
        if (job.status === 'completed' || job.status === 'failed') {
          // Remove from active jobs
          setActiveJobs(prev => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });

          // Add completion notification
          const notification: JobNotification = {
            id: `${jobId}-${job.status}`,
            jobId,
            type: job.type,
            status: job.status,
            message: job.status === 'completed' 
              ? `Job ${job.type} completed successfully`
              : `Job ${job.type} failed: ${job.error || 'Unknown error'}`,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => {
            // Remove any existing notifications for this job
            const filtered = prev.filter(n => n.jobId !== jobId);
            return [notification, ...filtered];
          });

          // Show toast notification
          toast({
            title: job.status === 'completed' ? 'Job Completed' : 'Job Failed',
            description: notification.message,
            variant: job.status === 'completed' ? 'default' : 'destructive',
          });
        }
      } catch (error) {
        console.error(`Error polling job ${jobId}:`, error);
      }
    }
  };

  /**
   * Mark notification as read
   */
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  /**
   * Clear all notifications
   */
  const clearAll = () => {
    setNotifications([]);
  };

  /**
   * Get icon for notification status
   */
  const getStatusIcon = (status: JobNotification['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Poll active jobs every 3 seconds
  useEffect(() => {
    const interval = setInterval(pollActiveJobs, 3000);
    return () => clearInterval(interval);
  }, [activeJobs]);

  // Expose trackJob function globally for other components to use
  useEffect(() => {
    (window as any).trackJob = trackJob;
    return () => {
      delete (window as any).trackJob;
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Job notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Job Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <>
            <ScrollArea className="h-[300px]">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start space-x-3 p-3 cursor-pointer ${
                    !notification.read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="mt-0.5">
                    {getStatusIcon(notification.status)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-sm text-muted-foreground cursor-pointer"
              onClick={clearAll}
            >
              Clear all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Helper function to track a job from anywhere in the app
 */
export function trackJob(jobId: string, type: string) {
  if ((window as any).trackJob) {
    (window as any).trackJob(jobId, type);
  }
}
