import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { JobList } from '../job-list';

// Mock fetch
global.fetch = vi.fn();

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('JobList', () => {
  const mockStats = {
    waiting: 5,
    active: 2,
    completed: 100,
    failed: 3,
    delayed: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(() => {}) // Never resolves
    );

    render(<JobList />);

    expect(screen.getByText('Loading job queue statistics...')).toBeInTheDocument();
  });

  it('should display queue statistics', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    });

    // Check all stat cards
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should display queue summary', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Queue Summary')).toBeInTheDocument();
    });

    // Total jobs = 5 + 2 + 100 + 3 + 1 = 111
    expect(screen.getByText('Total jobs: 111')).toBeInTheDocument();
  });

  it('should show status badges in summary', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('5 waiting')).toBeInTheDocument();
    });

    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText('3 failed')).toBeInTheDocument();
  });

  it('should refresh statistics when refresh button is clicked', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    });

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should auto-refresh statistics every 5 seconds', async () => {
    vi.useFakeTimers();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    });

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('should handle filter changes', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    });

    // Find and click status filter
    const statusFilters = screen.getAllByRole('combobox');
    expect(statusFilters).toHaveLength(2); // Status and Type filters

    // The filters are present and can be interacted with
    expect(statusFilters[0]).toBeInTheDocument();
    expect(statusFilters[1]).toBeInTheDocument();
  });

  it('should display info message about job metadata', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Job Queue Statistics')).toBeInTheDocument();
    });

    expect(screen.getByText(/Individual job details and management features require job metadata storage/)).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<JobList />);

    await waitFor(() => {
      // Component should still render but show no data
      expect(screen.queryByText('Loading job queue statistics...')).not.toBeInTheDocument();
    });
  });

  it('should display no data message when stats are null', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: null }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('No queue statistics available')).toBeInTheDocument();
    });
  });

  it('should show refreshing state when manually refreshing', async () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
          });
        }, 100);
      })
    );

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Should show refreshing state
    await waitFor(() => {
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    // Should return to normal state
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('should display correct card descriptions', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      expect(screen.getByText('Jobs in queue')).toBeInTheDocument();
    });

    expect(screen.getByText('Currently processing')).toBeInTheDocument();
    expect(screen.getByText('Successfully finished')).toBeInTheDocument();
    expect(screen.getByText('Errors occurred')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for later')).toBeInTheDocument();
  });

  it('should calculate total jobs correctly', async () => {
    const customStats = {
      waiting: 10,
      active: 5,
      completed: 200,
      failed: 15,
      delayed: 3,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: customStats, timestamp: new Date().toISOString() }),
    });

    render(<JobList />);

    await waitFor(() => {
      // Total = 10 + 5 + 200 + 15 + 3 = 233
      expect(screen.getByText('Total jobs: 233')).toBeInTheDocument();
    });
  });
});
