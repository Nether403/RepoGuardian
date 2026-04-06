import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookmarksTab } from '../bookmarks-tab';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the router
vi.mock('wouter', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock apiRequest
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

const createWrapper = (mockData?: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        queryFn: async () => {
          if (mockData instanceof Error) {
            throw mockData;
          }
          return mockData || [];
        },
      },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('BookmarksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<BookmarksTab />, { wrapper: createWrapper() });
    
    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no bookmarks', async () => {
    render(<BookmarksTab />, { wrapper: createWrapper([]) });

    await waitFor(() => {
      expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
      expect(screen.getByText(/Start bookmarking repositories/)).toBeInTheDocument();
      expect(screen.getByText('Discover Repositories')).toBeInTheDocument();
    });
  });

  it('renders bookmarks list with repository details', async () => {
    const mockBookmarks = [
      {
        id: 1,
        userId: 'user1',
        repositoryId: 'repo1',
        notes: 'Great project!',
        createdAt: '2024-01-15T10:00:00Z',
        repository: {
          id: 'repo1',
          name: 'awesome-repo',
          fullName: 'user/awesome-repo',
          description: 'An awesome repository',
          stars: 1234,
          forks: 56,
          language: 'TypeScript',
          owner: 'user',
        },
      },
    ];

    render(<BookmarksTab />, { wrapper: createWrapper(mockBookmarks) });

    await waitFor(() => {
      expect(screen.getByText('awesome-repo')).toBeInTheDocument();
      expect(screen.getByText('user/awesome-repo')).toBeInTheDocument();
      expect(screen.getByText('An awesome repository')).toBeInTheDocument();
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('56')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('"Great project!"')).toBeInTheDocument();
    });
  });

  it('displays bookmark count', async () => {
    const mockBookmarks = [
      {
        id: 1,
        userId: 'user1',
        repositoryId: 'repo1',
        createdAt: '2024-01-15T10:00:00Z',
        repository: {
          id: 'repo1',
          name: 'repo1',
          fullName: 'user/repo1',
          owner: 'user',
        },
      },
      {
        id: 2,
        userId: 'user1',
        repositoryId: 'repo2',
        createdAt: '2024-01-16T10:00:00Z',
        repository: {
          id: 'repo2',
          name: 'repo2',
          fullName: 'user/repo2',
          owner: 'user',
        },
      },
    ];

    render(<BookmarksTab />, { wrapper: createWrapper(mockBookmarks) });

    await waitFor(() => {
      expect(screen.getByText('2 Bookmarks')).toBeInTheDocument();
    });
  });

  it('shows pagination for many bookmarks', async () => {
    const mockBookmarks = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      userId: 'user1',
      repositoryId: `repo${i + 1}`,
      createdAt: '2024-01-15T10:00:00Z',
      repository: {
        id: `repo${i + 1}`,
        name: `repo${i + 1}`,
        fullName: `user/repo${i + 1}`,
        owner: 'user',
      },
    }));

    render(<BookmarksTab />, { wrapper: createWrapper(mockBookmarks) });

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('handles remove bookmark action', async () => {
    const mockBookmarks = [
      {
        id: 1,
        userId: 'user1',
        repositoryId: 'repo1',
        createdAt: '2024-01-15T10:00:00Z',
        repository: {
          id: 'repo1',
          name: 'awesome-repo',
          fullName: 'user/awesome-repo',
          owner: 'user',
        },
      },
    ];

    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue({} as any);
    
    render(<BookmarksTab />, { wrapper: createWrapper(mockBookmarks) });

    await waitFor(() => {
      expect(screen.getByText('awesome-repo')).toBeInTheDocument();
    });

    // Find and click the remove button
    const removeButton = screen.getByLabelText('Remove bookmark');
    await userEvent.click(removeButton);

    // Verify the DELETE request would be made
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('DELETE', '/api/bookmarks/repo1');
    });
  });

  it('renders error state with retry button', async () => {
    render(<BookmarksTab />, { wrapper: createWrapper(new Error('Network error')) });

    await waitFor(() => {
      expect(screen.getByText('Failed to load bookmarks')).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });
});
