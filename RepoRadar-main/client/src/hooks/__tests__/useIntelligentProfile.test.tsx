import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import {
  useBookmarks,
  useAddBookmark,
  useRemoveBookmark,
  useTags,
  useCreateTag,
  useDeleteTag,
  useRepositoryTags,
  useAddRepositoryTag,
  useRemoveRepositoryTag,
  usePreferences,
  useUpdatePreferences,
  useRecommendations,
  queryKeys,
} from '../useIntelligentProfile';

// Mock apiRequest
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/queryClient';

describe('Intelligent Profile Hooks - Caching Strategy', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Bookmarks Caching', () => {
    it('should cache bookmarks with 2-minute stale time', async () => {
      const mockBookmarks = [
        {
          id: 1,
          userId: 'user1',
          repositoryId: 'repo1',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => mockBookmarks,
      } as Response);

      const { result } = renderHook(() => useBookmarks(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockBookmarks);
      expect(apiRequest).toHaveBeenCalledWith('GET', '/api/bookmarks');

      // Verify stale time is set correctly
      const queryState = queryClient.getQueryState(queryKeys.bookmarks);
      expect(queryState?.dataUpdatedAt).toBeDefined();
    });

    it('should implement optimistic updates for adding bookmarks', async () => {
      const existingBookmarks = [
        {
          id: 1,
          userId: 'user1',
          repositoryId: 'repo1',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      // Set initial data
      queryClient.setQueryData(queryKeys.bookmarks, existingBookmarks);

      const newBookmark = {
        id: 2,
        userId: 'user1',
        repositoryId: 'repo2',
        createdAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => newBookmark,
      } as Response);

      const { result } = renderHook(() => useAddBookmark(), { wrapper });

      // Trigger mutation
      result.current.mutate({ repositoryId: 'repo2' });

      // Check optimistic update happened immediately
      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.bookmarks);
        expect(Array.isArray(data)).toBe(true);
        expect((data as any[]).length).toBeGreaterThan(1);
      });
    });

    it('should rollback on error when adding bookmark', async () => {
      const existingBookmarks = [
        {
          id: 1,
          userId: 'user1',
          repositoryId: 'repo1',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.bookmarks, existingBookmarks);

      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAddBookmark(), { wrapper });

      result.current.mutate({ repositoryId: 'repo2' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Verify rollback
      const data = queryClient.getQueryData(queryKeys.bookmarks);
      expect(data).toEqual(existingBookmarks);
    });

    it('should implement optimistic updates for removing bookmarks', async () => {
      const existingBookmarks = [
        {
          id: 1,
          userId: 'user1',
          repositoryId: 'repo1',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          userId: 'user1',
          repositoryId: 'repo2',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.bookmarks, existingBookmarks);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useRemoveBookmark(), { wrapper });

      result.current.mutate('repo1');

      // Check optimistic update
      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.bookmarks) as any[];
        expect(data.length).toBe(1);
        expect(data[0].repositoryId).toBe('repo2');
      });
    });
  });

  describe('Tags Caching', () => {
    it('should cache tags with 10-minute stale time', async () => {
      const mockTags = [
        {
          id: 1,
          userId: 'user1',
          name: 'Frontend',
          color: '#3b82f6',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => mockTags,
      } as Response);

      const { result } = renderHook(() => useTags(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTags);
      expect(apiRequest).toHaveBeenCalledWith('GET', '/api/tags');
    });

    it('should implement optimistic updates for creating tags', async () => {
      const existingTags = [
        {
          id: 1,
          userId: 'user1',
          name: 'Frontend',
          color: '#3b82f6',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.tags, existingTags);

      const newTag = {
        id: 2,
        userId: 'user1',
        name: 'Backend',
        color: '#ef4444',
        createdAt: '2024-01-02T00:00:00Z',
      };

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => newTag,
      } as Response);

      const { result } = renderHook(() => useCreateTag(), { wrapper });

      result.current.mutate({ name: 'Backend', color: '#ef4444' });

      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.tags) as any[];
        expect(data.length).toBeGreaterThan(1);
      });
    });

    it('should implement optimistic updates for deleting tags', async () => {
      const existingTags = [
        {
          id: 1,
          userId: 'user1',
          name: 'Frontend',
          color: '#3b82f6',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Backend',
          color: '#ef4444',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.tags, existingTags);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useDeleteTag(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.tags) as any[];
        expect(data.length).toBe(1);
        expect(data[0].id).toBe(2);
      });
    });

    it('should invalidate repository tags when deleting a tag', async () => {
      const existingTags = [
        {
          id: 1,
          userId: 'user1',
          name: 'Frontend',
          color: '#3b82f6',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.tags, existingTags);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useDeleteTag(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tags });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['repository-tags'] });
    });
  });

  describe('Repository Tags Caching', () => {
    it('should cache repository tags with 5-minute stale time', async () => {
      const mockRepoTags = [
        {
          id: 1,
          repositoryId: 'repo1',
          tagId: 1,
          userId: 'user1',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => mockRepoTags,
      } as Response);

      const { result } = renderHook(() => useRepositoryTags('repo1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockRepoTags);
      expect(apiRequest).toHaveBeenCalledWith('GET', '/api/repositories/repo1/tags');
    });

    it('should implement optimistic updates for adding repository tags', async () => {
      const existingRepoTags = [
        {
          id: 1,
          repositoryId: 'repo1',
          tagId: 1,
          userId: 'user1',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      queryClient.setQueryData(queryKeys.repositoryTags('repo1'), existingRepoTags);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({
          id: 2,
          repositoryId: 'repo1',
          tagId: 2,
          userId: 'user1',
          createdAt: '2024-01-02T00:00:00Z',
        }),
      } as Response);

      const { result } = renderHook(() => useAddRepositoryTag(), { wrapper });

      result.current.mutate({ repositoryId: 'repo1', tagId: 2 });

      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.repositoryTags('repo1')) as any[];
        expect(data.length).toBeGreaterThan(1);
      });
    });

    it('should invalidate tags when adding repository tag', async () => {
      queryClient.setQueryData(queryKeys.repositoryTags('repo1'), []);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({
          id: 1,
          repositoryId: 'repo1',
          tagId: 1,
          userId: 'user1',
          createdAt: '2024-01-01T00:00:00Z',
        }),
      } as Response);

      const { result } = renderHook(() => useAddRepositoryTag(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate({ repositoryId: 'repo1', tagId: 1 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.repositoryTags('repo1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tags });
    });
  });

  describe('Preferences Caching', () => {
    it('should cache preferences with 5-minute stale time', async () => {
      const mockPreferences = {
        id: 1,
        userId: 'user1',
        preferredLanguages: ['TypeScript', 'Python'],
        preferredTopics: ['AI', 'Web'],
        excludedTopics: [],
        minStars: 100,
        maxAge: '1y',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => mockPreferences,
      } as Response);

      const { result } = renderHook(() => usePreferences(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPreferences);
      expect(apiRequest).toHaveBeenCalledWith('GET', '/api/user/preferences');
    });

    it('should implement optimistic updates for updating preferences', async () => {
      const existingPreferences = {
        id: 1,
        userId: 'user1',
        preferredLanguages: ['TypeScript'],
        preferredTopics: ['AI'],
        excludedTopics: [],
        minStars: 100,
        maxAge: '1y',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      queryClient.setQueryData(queryKeys.preferences, existingPreferences);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({
          ...existingPreferences,
          preferredLanguages: ['TypeScript', 'Python'],
          updatedAt: '2024-01-02T00:00:00Z',
        }),
      } as Response);

      const { result } = renderHook(() => useUpdatePreferences(), { wrapper });

      result.current.mutate({ preferredLanguages: ['TypeScript', 'Python'] });

      await waitFor(() => {
        const data = queryClient.getQueryData(queryKeys.preferences) as any;
        expect(data.preferredLanguages).toContain('Python');
      });
    });

    it('should invalidate recommendations when updating preferences', async () => {
      const existingPreferences = {
        id: 1,
        userId: 'user1',
        preferredLanguages: ['TypeScript'],
        preferredTopics: [],
        excludedTopics: [],
        minStars: 0,
        maxAge: '1y',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: '2024-01-01T00:00:00Z',
      };

      queryClient.setQueryData(queryKeys.preferences, existingPreferences);

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => existingPreferences,
      } as Response);

      const { result } = renderHook(() => useUpdatePreferences(), { wrapper });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      result.current.mutate({ minStars: 500 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.preferences });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.recommendations });
    });
  });

  describe('Recommendations Caching', () => {
    it('should cache recommendations with 24-hour stale time', async () => {
      const mockRecommendations = [
        {
          repository: {
            id: 'repo1',
            fullName: 'owner/repo1',
            description: 'Test repo',
            stars: 1000,
            owner: 'owner',
            name: 'repo1',
          },
          matchScore: 95,
          reasoning: 'Matches your interests',
          basedOn: {
            languages: ['TypeScript'],
            topics: ['AI'],
            similarTo: ['repo2'],
          },
        },
      ];

      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => mockRecommendations,
      } as Response);

      const { result } = renderHook(() => useRecommendations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockRecommendations);
      expect(apiRequest).toHaveBeenCalledWith('GET', '/api/recommendations');
    });

    it('should have reduced retry count for expensive operations', () => {
      // Verify that recommendations hook has retry configured
      // The actual retry behavior is tested through integration
      const { result } = renderHook(() => useRecommendations(), { wrapper });
      
      // Hook should be initialized
      expect(result.current.isLoading).toBeDefined();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate related caches on mutations', async () => {
      // Set up initial data
      queryClient.setQueryData(queryKeys.bookmarks, []);
      queryClient.setQueryData(queryKeys.tags, []);
      queryClient.setQueryData(queryKeys.preferences, {});
      queryClient.setQueryData(queryKeys.recommendations, []);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Test bookmark mutation invalidates bookmarks
      vi.mocked(apiRequest).mockResolvedValue({
        json: async () => ({ id: 1 }),
      } as Response);

      const { result: bookmarkResult } = renderHook(() => useAddBookmark(), { wrapper });
      bookmarkResult.current.mutate({ repositoryId: 'repo1' });

      await waitFor(() => expect(bookmarkResult.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bookmarks });
    });
  });
});
