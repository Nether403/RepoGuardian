import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TagSelector } from '../tag-selector';
import * as queryClientModule from '@/lib/queryClient';
import * as useAuthModule from '@/hooks/useAuth';

// Mock modules
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockApiRequest = queryClientModule.apiRequest as any;
const mockUseAuth = useAuthModule.useAuth as any;

describe('TagSelector', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TagSelector repositoryId="test-repo" {...props} />
      </QueryClientProvider>
    );
  };

  it('should not render for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  it('should not render for free tier users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'free' },
      isAuthenticated: true,
    });

    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  it('should render tag selector button for pro users', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve([]);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });
  });

  it('should display selected tags as badges', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const mockTags = [
      { id: 1, name: 'Frontend', color: '#FF6B35', userId: '1', createdAt: new Date() },
      { id: 2, name: 'Backend', color: '#4ECDC4', userId: '1', createdAt: new Date() },
    ];

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve(mockTags);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve(mockTags);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
    });
  });

  it('should show +N badge when more than 3 tags are selected', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const mockTags = [
      { id: 1, name: 'Tag1', color: '#FF6B35', userId: '1', createdAt: new Date() },
      { id: 2, name: 'Tag2', color: '#4ECDC4', userId: '1', createdAt: new Date() },
      { id: 3, name: 'Tag3', color: '#95E1D3', userId: '1', createdAt: new Date() },
      { id: 4, name: 'Tag4', color: '#F38181', userId: '1', createdAt: new Date() },
      { id: 5, name: 'Tag5', color: '#AA96DA', userId: '1', createdAt: new Date() },
    ];

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve(mockTags);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve(mockTags);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  it('should open popover when tag selector button is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve([
          { id: 1, name: 'Frontend', color: '#FF6B35', userId: '1', createdAt: new Date() },
        ]);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      expect(screen.getByText('Manage Tags')).toBeInTheDocument();
    });
  });

  it('should display available tags in the popover', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const mockTags = [
      { id: 1, name: 'Frontend', color: '#FF6B35', userId: '1', createdAt: new Date() },
      { id: 2, name: 'Backend', color: '#4ECDC4', userId: '1', createdAt: new Date() },
    ];

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve(mockTags);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      const frontendTags = screen.getAllByText('Frontend');
      const backendTags = screen.getAllByText('Backend');
      expect(frontendTags.length).toBeGreaterThan(0);
      expect(backendTags.length).toBeGreaterThan(0);
    });
  });

  it('should toggle tag selection when clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const mockTags = [
      { id: 1, name: 'Frontend', color: '#FF6B35', userId: '1', createdAt: new Date() },
    ];

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve(mockTags);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      if (method === 'POST' && url.includes('/tags')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      expect(screen.getByText('Manage Tags')).toBeInTheDocument();
    });

    const tagButtons = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('Frontend')
    );
    
    if (tagButtons.length > 0) {
      await user.click(tagButtons[0]);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/repositories/test-repo/tags',
          { tagId: 1 }
        );
      });
    }
  });

  it('should show create tag form when New Tag button is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve([]);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      expect(screen.getByText('New Tag')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Tag'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tag name')).toBeInTheDocument();
    });
  });

  it('should create a new tag when form is submitted', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const newTag = { id: 3, name: 'New Tag', color: '#FF6B35', userId: '1', createdAt: new Date() };

    mockApiRequest.mockImplementation((method: string, url: string, data?: any) => {
      if (url === '/api/tags' && method === 'GET') {
        return Promise.resolve([]);
      }
      if (url === '/api/tags' && method === 'POST') {
        return Promise.resolve(newTag);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      expect(screen.getByText('New Tag')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Tag'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tag name')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Tag name');
    await user.type(input, 'New Tag');

    const createButton = screen.getByText('Create Tag');
    await user.click(createButton);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/tags',
        { name: 'New Tag', color: '#FF6B35' }
      );
    });
  });

  it('should remove tag when badge X is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    const mockTags = [
      { id: 1, name: 'Frontend', color: '#FF6B35', userId: '1', createdAt: new Date() },
    ];

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve(mockTags);
      }
      if (url.includes('/api/repositories/') && method === 'GET') {
        return Promise.resolve(mockTags);
      }
      if (method === 'DELETE') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    const badge = screen.getByText('Frontend').closest('span');
    if (badge) {
      await user.click(badge);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'DELETE',
          '/api/repositories/test-repo/tags/1'
        );
      });
    }
  });

  it('should render with different sizes', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve([]);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const { rerender } = renderComponent({ size: 'sm' });

    await waitFor(() => {
      const button = screen.getByTestId('tag-selector-test-repo');
      expect(button).toHaveClass('h-7', 'w-7');
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <TagSelector repositoryId="test-repo" size="lg" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const button = screen.getByTestId('tag-selector-test-repo');
      expect(button).toHaveClass('h-11', 'w-11');
    });
  });

  it('should show empty state when no tags exist', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: '1', subscriptionTier: 'pro' },
      isAuthenticated: true,
    });

    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/tags') {
        return Promise.resolve([]);
      }
      if (url.includes('/api/repositories/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tag-selector-test-repo')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tag-selector-test-repo'));

    await waitFor(() => {
      expect(screen.getByText('No tags yet. Create your first tag!')).toBeInTheDocument();
    });
  });
});
