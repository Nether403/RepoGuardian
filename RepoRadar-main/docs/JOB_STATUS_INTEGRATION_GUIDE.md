# Job Status API and UI Integration Guide

This guide shows how to integrate the job status tracking system into your RepoRadar application.

## Quick Start

### 1. Add Job Notifications to Header

Add the notification bell to your application header:

```tsx
// client/src/components/header.tsx
import { JobNotifications } from './job-notifications';

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex items-center justify-between py-4">
        <h1>RepoRadar</h1>
        
        <div className="flex items-center space-x-4">
          {/* Other header items */}
          <JobNotifications />
        </div>
      </div>
    </header>
  );
}
```

### 2. Track Jobs When Created

When you create a background job, track it for notifications:

```tsx
// Example: Batch analysis
import { trackJob } from '@/components/job-notifications';
import { jobQueue } from '@/server/jobs/JobQueue';

async function handleBatchAnalysis(repositories: string[]) {
  try {
    // Create the job
    const job = await jobQueue.addJob('batch-analysis', {
      repositories,
      userId: currentUser.id,
    });

    // Track it for notifications
    trackJob(job.id, 'batch-analysis');

    // Show initial toast
    toast({
      title: 'Batch Analysis Started',
      description: `Analyzing ${repositories.length} repositories in the background.`,
    });

    return job.id;
  } catch (error) {
    console.error('Failed to start batch analysis:', error);
    toast({
      title: 'Error',
      description: 'Failed to start batch analysis',
      variant: 'destructive',
    });
  }
}
```

### 3. Display Job Progress

Show detailed progress for a specific job:

```tsx
// Example: Job progress page
import { JobProgress } from '@/components/job-progress';
import { useParams, useNavigate } from 'react-router-dom';

export function JobProgressPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Job Progress</h1>
      
      <JobProgress
        jobId={jobId!}
        onComplete={(result) => {
          // Navigate to results page
          navigate(`/results/${jobId}`);
        }}
        onError={(error) => {
          // Show error and stay on page
          console.error('Job failed:', error);
        }}
        onCancel={() => {
          // Navigate back
          navigate('/dashboard');
        }}
      />
    </div>
  );
}
```

### 4. Add Job List to Admin Dashboard

Display job queue statistics in the admin dashboard:

```tsx
// client/src/pages/admin.tsx
import { JobList } from '@/components/admin/job-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminDashboard() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Background Jobs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="jobs">
          <JobList />
        </TabsContent>
        
        {/* Other tabs */}
      </Tabs>
    </div>
  );
}
```

## API Usage

### Get Job Status

```typescript
// GET /api/jobs/:jobId
const response = await fetch(`/api/jobs/${jobId}`);
const data = await response.json();

console.log(data.job);
// {
//   id: 'job-123',
//   type: 'batch-analysis',
//   status: 'processing',
//   progress: 50,
//   attempts: 1,
//   maxAttempts: 3,
//   createdAt: '2025-10-03T...',
//   startedAt: '2025-10-03T...',
// }
```

### Get Queue Statistics

```typescript
// GET /api/jobs/stats/queue
const response = await fetch('/api/jobs/stats/queue');
const data = await response.json();

console.log(data.stats);
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   delayed: 1,
// }
```

### Cancel a Job

```typescript
// DELETE /api/jobs/:jobId
const response = await fetch(`/api/jobs/${jobId}`, {
  method: 'DELETE',
});

if (response.ok) {
  console.log('Job cancelled successfully');
}
```

## Component Props

### JobProgress

```typescript
interface JobProgressProps {
  jobId: string;                    // Required: Job ID to track
  onComplete?: (result: any) => void;  // Called when job completes
  onError?: (error: string) => void;   // Called when job fails
  onCancel?: () => void;               // Called when job is cancelled
  autoRefresh?: boolean;               // Enable auto-refresh (default: true)
  refreshInterval?: number;            // Refresh interval in ms (default: 2000)
}
```

### JobNotifications

No props required - just add to your component tree:

```tsx
<JobNotifications />
```

### JobList

No props required - displays queue statistics:

```tsx
<JobList />
```

## Advanced Usage

### Custom Job Progress Display

Create a custom wrapper with additional features:

```tsx
import { JobProgress } from '@/components/job-progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function CustomJobProgress({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>
      </div>

      <JobProgress
        jobId={jobId}
        onComplete={(result) => {
          // Custom completion handling
          console.log('Job completed with result:', result);
          // Maybe show a success modal
        }}
        onError={(error) => {
          // Custom error handling
          console.error('Job failed:', error);
          // Maybe show an error modal with retry option
        }}
      />

      {showDetails && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Job Details</h3>
          {/* Additional job information */}
        </Card>
      )}
    </div>
  );
}
```

### Programmatic Job Tracking

Track jobs programmatically without user interaction:

```typescript
import { trackJob } from '@/components/job-notifications';

// In a service or utility function
export async function startBackgroundExport(data: any) {
  const job = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'export',
      data,
    }),
  }).then(r => r.json());

  // Automatically track the job
  trackJob(job.id, 'export');

  return job.id;
}
```

### Batch Job Tracking

Track multiple jobs at once:

```typescript
async function startBatchJobs(items: any[]) {
  const jobIds: string[] = [];

  for (const item of items) {
    const job = await jobQueue.addJob('process-item', item);
    trackJob(job.id, 'process-item');
    jobIds.push(job.id);
  }

  toast({
    title: 'Batch Processing Started',
    description: `Started ${jobIds.length} background jobs`,
  });

  return jobIds;
}
```

## Styling Customization

### Custom Status Colors

Override the default status colors:

```tsx
// In your component
<JobProgress
  jobId={jobId}
  className="custom-job-progress"
/>

// In your CSS
.custom-job-progress [data-status="processing"] {
  background-color: #your-color;
}
```

### Custom Notification Bell

Customize the notification bell appearance:

```tsx
// Wrap JobNotifications with custom styling
<div className="relative">
  <JobNotifications />
  {/* Add custom badge or indicator */}
</div>
```

## Error Handling

### Handle API Errors

```typescript
try {
  const response = await fetch(`/api/jobs/${jobId}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      // Job not found
      toast({
        title: 'Job Not Found',
        description: 'The requested job could not be found',
        variant: 'destructive',
      });
    } else {
      // Other error
      throw new Error('Failed to fetch job status');
    }
  }
  
  const data = await response.json();
  return data.job;
} catch (error) {
  console.error('Error fetching job:', error);
  // Handle error appropriately
}
```

### Handle Component Errors

```tsx
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary
  fallback={(error, retry) => (
    <div className="p-4 text-center">
      <p className="text-destructive mb-2">Failed to load job status</p>
      <Button onClick={retry}>Retry</Button>
    </div>
  )}
>
  <JobProgress jobId={jobId} />
</ErrorBoundary>
```

## Performance Tips

1. **Disable Auto-refresh When Not Visible:**
   ```tsx
   const [isVisible, setIsVisible] = useState(true);
   
   <JobProgress
     jobId={jobId}
     autoRefresh={isVisible}
   />
   ```

2. **Adjust Refresh Intervals:**
   ```tsx
   // For less critical jobs, use longer intervals
   <JobProgress
     jobId={jobId}
     refreshInterval={5000} // 5 seconds instead of 2
   />
   ```

3. **Clean Up Completed Jobs:**
   The notification system automatically removes completed jobs from active tracking.

## Testing

### Test Job Progress Component

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { JobProgress } from '@/components/job-progress';

test('displays job progress', async () => {
  // Mock fetch
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      job: {
        id: 'test-job',
        status: 'processing',
        progress: 50,
      },
    }),
  });

  render(<JobProgress jobId="test-job" />);

  await waitFor(() => {
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
```

### Test Job Tracking

```typescript
import { trackJob } from '@/components/job-notifications';

test('tracks job for notifications', () => {
  // Render component with JobNotifications
  render(<App />);

  // Track a job
  trackJob('test-job', 'batch-analysis');

  // Verify notification appears
  // (implementation depends on your test setup)
});
```

## Troubleshooting

### Jobs Not Updating

1. Check that auto-refresh is enabled
2. Verify the job ID is correct
3. Check browser console for API errors
4. Ensure Redis is running (for job queue)

### Notifications Not Appearing

1. Verify JobNotifications is rendered in your component tree
2. Check that trackJob is called after job creation
3. Verify the job ID matches between creation and tracking
4. Check browser console for errors

### Performance Issues

1. Reduce refresh intervals for non-critical jobs
2. Disable auto-refresh when components are not visible
3. Limit the number of simultaneously tracked jobs
4. Consider implementing WebSocket for real-time updates

## Next Steps

1. **Add WebSocket Support:** Replace polling with WebSocket for real-time updates
2. **Implement Job History:** Store job metadata in database for historical tracking
3. **Add Job Retry:** Allow users to retry failed jobs
4. **Enhance Filtering:** Add more filter options in admin dashboard
5. **Add Job Details Modal:** Show detailed job information in a modal

## Support

For issues or questions:
1. Check the test files for usage examples
2. Review the component source code
3. Check the API documentation
4. Open an issue on GitHub
