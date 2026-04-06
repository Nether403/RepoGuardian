import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AdminDashboard from '@/pages/admin';
import { HealthMetrics } from '@/components/admin/health-metrics';
import { SystemMetrics } from '@/components/admin/system-metrics';
import { UserActivity } from '@/components/admin/user-activity';
import { TimeSeriesChart } from '@/components/admin/time-series-chart';
import { LogViewer } from '@/components/admin/log-viewer';
import { DataExport } from '@/components/admin/data-export';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render login form when not authenticated', () => {
    render(<AdminDashboard />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Admin Dashboard Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin Token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should authenticate with valid token', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    });

    render(<AdminDashboard />, { wrapper: createWrapper() });
    
    const tokenInput = screen.getByLabelText('Admin Token');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/health-metrics',
        expect.objectContaining({
          headers: { 'x-admin-token': 'test-token' },
        })
      );
    });
  });

  it('should show error with invalid token', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    render(<AdminDashboard />, { wrapper: createWrapper() });
    
    const tokenInput = screen.getByLabelText('Admin Token');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(tokenInput, { target: { value: 'invalid-token' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should render dashboard tabs when authenticated', () => {
    localStorageMock.setItem('admin_token', 'test-token');

    render(<AdminDashboard />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /export/i })).toBeInTheDocument();
  });

  it('should logout and clear token', () => {
    localStorageMock.setItem('admin_token', 'test-token');

    render(<AdminDashboard />, { wrapper: createWrapper() });
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    expect(localStorageMock.getItem('admin_token')).toBeNull();
    expect(screen.getByText('Admin Dashboard Login')).toBeInTheDocument();
  });
});

describe('HealthMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render health metrics', async () => {
    const mockData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'healthy', responseTime: 10 },
        cache: { status: 'not_implemented', responseTime: 0, details: 'Redis not yet implemented' },
        api: { status: 'healthy', responseTime: 5 },
      },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<HealthMetrics adminToken="test-token" autoRefresh={false} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('Cache')).toBeInTheDocument();
      expect(screen.getByText('API')).toBeInTheDocument();
    });
  });

  it('should show error state on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    render(<HealthMetrics adminToken="test-token" autoRefresh={false} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});

describe('SystemMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render system metrics', async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      metrics: {
        errorRate: 2.5,
        totalEvents: 1000,
        errorEvents: 25,
        errorsByHour: [],
      },
      resources: {
        memory: { heapUsed: 100, heapTotal: 200, external: 10, rss: 150 },
        cpu: { user: 1000000, system: 500000 },
        uptime: 3600,
      },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<SystemMetrics adminToken="test-token" autoRefresh={false} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('System Metrics')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('2.5%')).toBeInTheDocument();
      expect(screen.getByText('100MB')).toBeInTheDocument();
    });
  });
});

describe('UserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render user activity metrics', async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      activity: {
        activeSessions: 50,
        uniqueUsers: 30,
        avgEventsPerSession: 15.5,
      },
      features: [
        { name: 'repository_analysis', usage: 100 },
        { name: 'search', usage: 75 },
      ],
      categories: [
        { name: 'analysis', usage: 150 },
        { name: 'search', usage: 75 },
      ],
      sessions: [],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<UserActivity adminToken="test-token" autoRefresh={false} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('15.5')).toBeInTheDocument();
    });
  });
});

describe('TimeSeriesChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render time series chart', async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        interval: 'hour',
      },
      filters: {
        eventName: null,
        category: null,
      },
      summary: {
        totalEvents: 1000,
        uniqueSessions: 50,
        uniqueUsers: 30,
      },
      timeSeries: [
        {
          period: new Date().toISOString(),
          count: 100,
          uniqueSessions: 10,
          uniqueUsers: 5,
        },
      ],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<TimeSeriesChart adminToken="test-token" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Analytics Time Series')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });
  });
});

describe('LogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render log viewer', async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      filters: {
        eventName: null,
        category: null,
        userId: null,
        sessionId: null,
      },
      pagination: {
        total: 100,
        limit: 50,
        offset: 0,
      },
      logs: [
        {
          id: '1',
          eventName: 'test_event',
          eventCategory: 'test',
          properties: { test: 'value' },
          userId: 'user1',
          sessionId: 'session1',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<LogViewer adminToken="test-token" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Log Viewer')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('test_event')).toBeInTheDocument();
    });
  });

  it('should handle pagination', async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      period: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      filters: {
        eventName: null,
        category: null,
        userId: null,
        sessionId: null,
      },
      pagination: {
        total: 100,
        limit: 50,
        offset: 0,
      },
      logs: [],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    render(<LogViewer adminToken="test-token" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Log Viewer')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('DataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it('should render data export options', () => {
    render(<DataExport adminToken="test-token" />, { wrapper: createWrapper() });

    expect(screen.getByText('Data Export')).toBeInTheDocument();
    expect(screen.getByText('JSON Format')).toBeInTheDocument();
    expect(screen.getByText('CSV Format')).toBeInTheDocument();
  });

  it('should handle export request', async () => {
    const mockBlob = new Blob(['test data'], { type: 'application/json' });
    
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Disposition') {
            return 'attachment; filename="test-export.json"';
          }
          return null;
        },
      },
      blob: async () => mockBlob,
    });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<DataExport adminToken="test-token" />, { wrapper: createWrapper() });

    const exportButton = screen.getByRole('button', { name: /export as json/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/export'),
        expect.objectContaining({
          headers: { 'x-admin-token': 'test-token' },
        })
      );
    });
  });
});
