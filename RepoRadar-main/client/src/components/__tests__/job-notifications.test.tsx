import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { JobNotifications, trackJob } from '../job-notifications';
import type { JobData } from '../job-progress';

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('JobNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).trackJob;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render notification bell', () => {
    render(<JobNotifications />);
    
    const bell = screen.getByRole('button', { name: /job notifications/i });
    expect(bell).toBeInTheDocument();
  });

  it('should show no notifications initially', async () => {
    render(<JobNotifications />);
    
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should track a job and show notification', async () => {
    render(<JobNotifications />);

    // Track a job
    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    (window as any).trackJob('job-123', 'batch-analysis');

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/Job batch-analysis started/)).toBeInTheDocument();
    });
  });

  it('should show unread count badge', async () => {
    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track multiple jobs
    (window as any).trackJob('job-1', 'batch-analysis');
    (window as any).trackJob('job-2', 'export');

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should poll active jobs and update status', async () => {
    vi.useFakeTimers();

    const completedJob: JobData = {
      id: 'job-123',
      type: 'batch-analysis',
      status: 'completed',
      progress: 100,
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: { success: true },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: completedJob }),
    });

    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'batch-analysis');

    // Advance timer to trigger polling
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/jobs/job-123');
    });

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/Job batch-analysis completed successfully/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('should show failed job notification', async () => {
    vi.useFakeTimers();

    const failedJob: JobData = {
      id: 'job-123',
      type: 'export',
      status: 'failed',
      progress: 50,
      attempts: 3,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: 'Network timeout',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job: failedJob }),
    });

    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'export');

    // Advance timer to trigger polling
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/jobs/job-123');
    });

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/Job export failed: Network timeout/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('should mark notification as read when clicked', async () => {
    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'batch-analysis');

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/Job batch-analysis started/)).toBeInTheDocument();
    });

    // Check unread indicator exists
    const unreadIndicator = document.querySelector('.bg-blue-600');
    expect(unreadIndicator).toBeInTheDocument();

    // Click notification
    const notification = screen.getByText(/Job batch-analysis started/);
    fireEvent.click(notification);

    // Unread indicator should be removed
    await waitFor(() => {
      const unreadIndicatorAfter = document.querySelector('.bg-blue-600');
      expect(unreadIndicatorAfter).not.toBeInTheDocument();
    });
  });

  it('should mark all notifications as read', async () => {
    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track multiple jobs
    (window as any).trackJob('job-1', 'batch-analysis');
    (window as any).trackJob('job-2', 'export');

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    // Click mark all read
    const markAllButton = screen.getByText('Mark all read');
    fireEvent.click(markAllButton);

    // Badge should be removed
    await waitFor(() => {
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });

  it('should clear all notifications', async () => {
    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'batch-analysis');

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/Job batch-analysis started/)).toBeInTheDocument();
    });

    // Click clear all
    const clearButton = screen.getByText('Clear all notifications');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should format timestamp correctly', async () => {
    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'batch-analysis');

    // Open notifications
    const bell = screen.getByRole('button', { name: /job notifications/i });
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });
  });

  it('should remove job from active jobs when not found', async () => {
    vi.useFakeTimers();

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(<JobNotifications />);

    await waitFor(() => {
      expect((window as any).trackJob).toBeDefined();
    });

    // Track a job
    (window as any).trackJob('job-123', 'batch-analysis');

    // Advance timer to trigger polling
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/jobs/job-123');
    });

    // Job should be removed from active jobs (no more polling)
    vi.advanceTimersByTime(3000);
    
    // Should not fetch again
    expect(global.fetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should export trackJob helper function', () => {
    expect(trackJob).toBeDefined();
    expect(typeof trackJob).toBe('function');
  });
});
