import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookmarkButton } from '../bookmark-button';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not render for free tier users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'free' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render for pro tier users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('bookmark-button-test-repo-1')).toBeInTheDocument();
  });

  it('should render for enterprise tier users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'enterprise' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('bookmark-button-test-repo-1')).toBeInTheDocument();
  });

  it('should render with small size variant', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" size="sm" />,
      { wrapper: createWrapper() }
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('h-7');
    expect(button?.className).toContain('w-7');
  });

  it('should render with medium size variant', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" size="md" />,
      { wrapper: createWrapper() }
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('h-9');
    expect(button?.className).toContain('w-9');
  });

  it('should render with large size variant', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" size="lg" />,
      { wrapper: createWrapper() }
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('h-11');
    expect(button?.className).toContain('w-11');
  });

  it('should show unfilled bookmark icon when not bookmarked', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    const icon = container.querySelector('svg');
    expect(icon?.className).not.toContain('fill-current');
  });

  it('should apply custom className', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    const { container } = render(
      <BookmarkButton repositoryId="test-repo-1" className="custom-class" />,
      { wrapper: createWrapper() }
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('custom-class');
  });

  it('should have proper aria-label for accessibility', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    const button = screen.getByLabelText('Add bookmark');
    expect(button).toBeInTheDocument();
  });

  it('should call apiRequest when clicked to add bookmark', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({})));

    render(
      <BookmarkButton repositoryId="test-repo-1" />,
      { wrapper: createWrapper() }
    );

    const button = screen.getByTestId('bookmark-button-test-repo-1');
    await user.click(button);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/bookmarks', {
        repositoryId: 'test-repo-1',
      });
    });
  });

  it('should stop event propagation when clicked', async () => {
    const user = userEvent.setup();
    const handleParentClick = vi.fn();
    
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({})));

    render(
      <div onClick={handleParentClick}>
        <BookmarkButton repositoryId="test-repo-1" />
      </div>,
      { wrapper: createWrapper() }
    );

    const button = screen.getByTestId('bookmark-button-test-repo-1');
    await user.click(button);

    expect(handleParentClick).not.toHaveBeenCalled();
  });
});
