import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesTab } from '../preferences-tab';

// Mock the queryClient module
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockPreferences = {
  id: 1,
  userId: 'user-123',
  preferredLanguages: ['JavaScript', 'TypeScript'],
  preferredTopics: ['web development', 'react'],
  excludedTopics: ['blockchain'],
  minStars: 100,
  maxAge: 'any',
  aiRecommendations: true,
  emailNotifications: false,
  updatedAt: '2024-01-15T10:00:00Z',
};

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

describe('PreferencesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<PreferencesTab />, { wrapper: createWrapper() });
    
    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display preferences when loaded', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    // Check if preferred languages are displayed
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();

    // Check if preferred topics are displayed
    expect(screen.getByText('web development')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();

    // Check if excluded topics are displayed
    expect(screen.getByText('blockchain')).toBeInTheDocument();

    // Check if minimum stars is displayed
    const minStarsInput = screen.getByLabelText(/minimum stars/i);
    expect(minStarsInput).toHaveValue(100);

    // Check if toggles are in correct state
    const aiToggle = screen.getByRole('switch', { name: /ai recommendations/i });
    const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(aiToggle).toBeChecked();
    expect(emailToggle).not.toBeChecked();
  });

  it('should handle error state', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to load'));
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
    });

    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should add a new language', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    // Type a new language
    const languageInput = screen.getByPlaceholderText(/type to search languages/i);
    await user.type(languageInput, 'Python');

    // Click add button
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    await user.click(addButtons[0]);

    // Check if language was added
    await waitFor(() => {
      expect(screen.getByText('Python')).toBeInTheDocument();
    });
  });

  it('should update minimum stars', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    // Update minimum stars
    const minStarsInput = screen.getByLabelText(/minimum stars/i);
    await user.clear(minStarsInput);
    await user.type(minStarsInput, '500');

    // Check if value was updated
    expect(minStarsInput).toHaveValue(500);
  });

  it('should enforce minimum stars range (0-1000000)', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    const minStarsInput = screen.getByLabelText(/minimum stars/i);

    // Test negative value
    await user.clear(minStarsInput);
    await user.type(minStarsInput, '-100');
    expect(minStarsInput).toHaveValue(0);

    // Test value over maximum
    await user.clear(minStarsInput);
    await user.type(minStarsInput, '2000000');
    expect(minStarsInput).toHaveValue(1000000);
  });

  it('should toggle AI recommendations', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    const aiToggle = screen.getByRole('switch', { name: /ai recommendations/i });
    expect(aiToggle).toBeChecked();

    // Toggle off
    await user.click(aiToggle);
    expect(aiToggle).not.toBeChecked();

    // Toggle back on
    await user.click(aiToggle);
    expect(aiToggle).toBeChecked();
  });

  it('should toggle email notifications', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(emailToggle).not.toBeChecked();

    // Toggle on
    await user.click(emailToggle);
    expect(emailToggle).toBeChecked();
  });

  it('should show unsaved changes indicator', async () => {
    const user = userEvent.setup();
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('All changes saved')).toBeInTheDocument();
    });

    // Make a change
    const minStarsInput = screen.getByLabelText(/minimum stars/i);
    await user.clear(minStarsInput);
    await user.type(minStarsInput, '200');

    // Check for unsaved changes indicator
    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });
  });

  it('should disable save button when no changes', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    expect(saveButton).toBeDisabled();
  });

  it('should show sensible defaults for new users', async () => {
    const emptyPreferences = {
      ...mockPreferences,
      preferredLanguages: [],
      preferredTopics: [],
      excludedTopics: [],
      minStars: 0,
      aiRecommendations: true,
      emailNotifications: false,
    };

    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(emptyPreferences);
    
    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    // Check defaults
    const minStarsInput = screen.getByLabelText(/minimum stars/i);
    expect(minStarsInput).toHaveValue(0);

    const aiToggle = screen.getByRole('switch', { name: /ai recommendations/i });
    expect(aiToggle).toBeChecked();

    const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(emailToggle).not.toBeChecked();
  });

  it('should be responsive on mobile', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    vi.mocked(apiRequest).mockResolvedValue(mockPreferences);
    
    // Mock mobile viewport
    global.innerWidth = 375;
    global.innerHeight = 667;

    render(<PreferencesTab />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    // Component should render without errors on mobile
    expect(screen.getByText('Preferred Programming Languages')).toBeInTheDocument();
    expect(screen.getByText('Preferred Topics')).toBeInTheDocument();
    expect(screen.getByText('Excluded Topics')).toBeInTheDocument();
  });
});
