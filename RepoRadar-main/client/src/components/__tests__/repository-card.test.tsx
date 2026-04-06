import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RepositoryCard from '../repository-card';
import type { Repository, RepositoryAnalysis } from '@shared/schema';

// Mock the child components
vi.mock('../bookmark-button', () => ({
  BookmarkButton: ({ repositoryId }: { repositoryId: string }) => (
    <button data-testid={`bookmark-button-${repositoryId}`}>Bookmark</button>
  ),
}));

vi.mock('../tag-selector', () => ({
  TagSelector: ({ repositoryId }: { repositoryId: string }) => (
    <button data-testid={`tag-selector-${repositoryId}`}>Tags</button>
  ),
}));

vi.mock('../track-repository-button', () => ({
  TrackRepositoryButton: ({ repositoryId }: { repositoryId: string }) => (
    <button data-testid={`track-button-${repositoryId}`}>Track</button>
  ),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', subscriptionTier: 'pro' },
    isAuthenticated: true,
  }),
}));

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('RepositoryCard', () => {
  let queryClient: QueryClient;

  const mockRepository: Repository = {
    id: 'test-repo-123',
    name: 'test-repo',
    fullName: 'owner/test-repo',
    description: 'A test repository',
    stars: 1000,
    forks: 100,
    language: 'TypeScript',
    owner: 'owner',
    watchers: 50,
    size: 1024,
    isPrivate: false,
    htmlUrl: 'https://github.com/owner/test-repo',
    cloneUrl: 'https://github.com/owner/test-repo.git',
    languages: null,
    topics: ['typescript', 'testing'],
    lastAnalyzed: null,
    analysisCount: 0,
    lastReanalyzedBy: null,
    reanalysisLockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAnalysis: Pick<RepositoryAnalysis, 'overallScore' | 'originality' | 'completeness' | 'marketability'> = {
    overallScore: 8.5,
    originality: 9.0,
    completeness: 8.0,
    marketability: 8.5,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('should render repository card with basic information', () => {
    renderWithProviders(
      <RepositoryCard repository={mockRepository} showAnalysis={false} />
    );

    expect(screen.getByText('test-repo')).toBeInTheDocument();
    expect(screen.getByText('owner/test-repo')).toBeInTheDocument();
    expect(screen.getByText('A test repository')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('should render BookmarkButton component', () => {
    renderWithProviders(
      <RepositoryCard repository={mockRepository} showAnalysis={false} />
    );

    expect(screen.getByTestId('bookmark-button-test-repo-123')).toBeInTheDocument();
  });

  it('should render TagSelector component', () => {
    renderWithProviders(
      <RepositoryCard repository={mockRepository} showAnalysis={false} />
    );

    expect(screen.getByTestId('tag-selector-test-repo-123')).toBeInTheDocument();
  });

  it('should render TrackRepositoryButton component', () => {
    renderWithProviders(
      <RepositoryCard repository={mockRepository} showAnalysis={false} />
    );

    expect(screen.getByTestId('track-button-test-repo-123')).toBeInTheDocument();
  });

  it('should render analysis scores when showAnalysis is true', () => {
    renderWithProviders(
      <RepositoryCard 
        repository={mockRepository} 
        analysis={mockAnalysis}
        showAnalysis={true} 
      />
    );

    expect(screen.getAllByText('8.5').length).toBeGreaterThan(0);
    expect(screen.getByText('Originality')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Marketability')).toBeInTheDocument();
    expect(screen.getByText('9.0')).toBeInTheDocument();
    expect(screen.getByText('8.0')).toBeInTheDocument();
  });

  it('should not render analysis scores when showAnalysis is false', () => {
    renderWithProviders(
      <RepositoryCard 
        repository={mockRepository} 
        analysis={mockAnalysis}
        showAnalysis={false} 
      />
    );

    expect(screen.queryByText('Originality')).not.toBeInTheDocument();
    expect(screen.queryByText('Completeness')).not.toBeInTheDocument();
    expect(screen.queryByText('Marketability')).not.toBeInTheDocument();
  });

  it('should render with no description fallback', () => {
    const repoWithoutDescription = { ...mockRepository, description: null };
    renderWithProviders(
      <RepositoryCard repository={repoWithoutDescription} showAnalysis={false} />
    );

    expect(screen.getByText('No description available')).toBeInTheDocument();
  });

  it('should render with no language badge when language is not provided', () => {
    const repoWithoutLanguage = { ...mockRepository, language: null };
    renderWithProviders(
      <RepositoryCard repository={repoWithoutLanguage} showAnalysis={false} />
    );

    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
  });

  it('should have correct link to repository detail page', () => {
    renderWithProviders(
      <RepositoryCard repository={mockRepository} showAnalysis={false} />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/repository/test-repo-123');
  });
});
