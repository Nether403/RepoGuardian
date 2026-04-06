import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { JobProgress } from '../job-progress';
import type { JobData } from '../job-progress';

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('JobProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockJobData: JobData = {
    id: 'job-123',
    type: 'batch-analysis',
    status: 'processing',
    progress: 50,
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(() => {}) // Never resolves
    );

    render(<JobProgress jobId="job-123" />);

    expect(screen.getByText('Loading job status...')).toBeInTheDocument();
  });

  it('should display job progress for processing job', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobData }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText('Job Progress')).toBeInTheDocument();
    });

    expect(screen.getByText('PROCESSING')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/Job ID: job-123/)).toBeInTheDocument();
    expect(screen.getByText(/Type: batch-analysis/)).toBeInTheDocument();
  });

  it('should display completed job status', async () => {
    const completedJob: JobData = {
      ...mockJobData,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
      result: { processed: 10 },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: completedJob }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed Successfully')).toBeInTheDocument();
    expect(screen.getByText('1 items processed')).toBeInTheDocument();
  });

  it('should display failed job with error message', async () => {
    const failedJob: JobData = {
      ...mockJobData,
      status: 'failed',
      error: 'Network timeout',
      completedAt: new Date().toISOString(),
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: failedJob }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('should call onComplete callback when job completes', async () => {
    const completedJob: JobData = {
      ...mockJobData,
      status: 'completed',
      progress: 100,
      result: { success: true },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: completedJob }),
    });

    const onComplete = vi.fn();
    render(<JobProgress jobId="job-123" onComplete={onComplete} />);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ success: true });
    });
  });

  it('should call onError callback when job fails', async () => {
    const failedJob: JobData = {
      ...mockJobData,
      status: 'failed',
      error: 'Processing error',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: failedJob }),
    });

    const onError = vi.fn();
    render(<JobProgress jobId="job-123" onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Processing error');
    });
  });

  it('should refresh job status when refresh button is clicked', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobData }),
    });

    render(<JobProgress jobId="job-123" autoRefresh={false} />);

    await waitFor(() => {
      expect(screen.getByText('Job Progress')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should allow cancelling a queued job', async () => {
    const queuedJob: JobData = {
      ...mockJobData,
      status: 'queued',
      progress: 0,
      startedAt: undefined,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: queuedJob }),
    });

    render(<JobProgress jobId="job-123" autoRefresh={false} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Job')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel Job');
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/jobs/job-123', {
        method: 'DELETE',
      });
    });
  });

  it('should not show cancel button for completed jobs', async () => {
    const completedJob: JobData = {
      ...mockJobData,
      status: 'completed',
      progress: 100,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: completedJob }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    expect(screen.queryByText('Cancel Job')).not.toBeInTheDocument();
  });

  it('should display error when job fetch fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('should format duration correctly', async () => {
    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() - 65); // 1 minute 5 seconds ago

    const jobWithDuration: JobData = {
      ...mockJobData,
      startedAt: startTime.toISOString(),
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: jobWithDuration }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText(/1m 5s/)).toBeInTheDocument();
    });
  });

  it('should auto-refresh for processing jobs', async () => {
    vi.useFakeTimers();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobData }),
    });

    render(<JobProgress jobId="job-123" autoRefresh={true} refreshInterval={1000} />);

    await waitFor(() => {
      expect(screen.getByText('Job Progress')).toBeInTheDocument();
    });

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance timer
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('should display attempts information', async () => {
    const jobWithAttempts: JobData = {
      ...mockJobData,
      attempts: 2,
      maxAttempts: 3,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: jobWithAttempts }),
    });

    render(<JobProgress jobId="job-123" />);

    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
  });
});
