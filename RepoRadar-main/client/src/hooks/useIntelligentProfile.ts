import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Types
export interface Bookmark {
  id: number;
  userId: string;
  repositoryId: string;
  notes?: string;
  createdAt: string;
  repository?: {
    id: string;
    fullName: string;
    description?: string;
    stars: number;
    owner: string;
    name: string;
  };
}

export interface Tag {
  id: number;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  repositoryCount?: number;
}

export interface RepositoryTag {
  id: number;
  repositoryId: string;
  tagId: number;
  userId: string;
  createdAt: string;
}

export interface UserPreferences {
  id: number;
  userId: string;
  preferredLanguages: string[];
  preferredTopics: string[];
  excludedTopics: string[];
  minStars: number;
  maxAge: string;
  aiRecommendations: boolean;
  emailNotifications: boolean;
  updatedAt: string;
}

export interface Recommendation {
  repository: {
    id: string;
    fullName: string;
    description?: string;
    stars: number;
    owner: string;
    name: string;
  };
  matchScore: number;
  reasoning: string;
  basedOn: {
    languages: string[];
    topics: string[];
    similarTo: string[];
  };
}

// Query keys
export const queryKeys = {
  bookmarks: ['bookmarks'] as const,
  tags: ['tags'] as const,
  preferences: ['preferences'] as const,
  recommendations: ['recommendations'] as const,
  repositoryTags: (repositoryId: string) => ['repository-tags', repositoryId] as const,
};

// Bookmarks hooks
export function useBookmarks() {
  return useQuery<Bookmark[]>({
    queryKey: queryKeys.bookmarks,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/bookmarks');
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAddBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { repositoryId: string; notes?: string }) => {
      const res = await apiRequest('POST', '/api/bookmarks', data);
      return res.json();
    },
    onMutate: async (newBookmark) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      // Snapshot previous value
      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(queryKeys.bookmarks);

      // Optimistically update
      queryClient.setQueryData<Bookmark[]>(queryKeys.bookmarks, (old = []) => [
        ...old,
        {
          id: Date.now(), // Temporary ID
          userId: '',
          repositoryId: newBookmark.repositoryId,
          notes: newBookmark.notes,
          createdAt: new Date().toISOString(),
        } as Bookmark,
      ]);

      return { previousBookmarks };
    },
    onError: (err, newBookmark, context) => {
      // Rollback on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousBookmarks);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repositoryId: string) => {
      const res = await apiRequest('DELETE', `/api/bookmarks/${repositoryId}`);
      return res.json();
    },
    onMutate: async (repositoryId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks });

      const previousBookmarks = queryClient.getQueryData<Bookmark[]>(queryKeys.bookmarks);

      // Optimistically remove
      queryClient.setQueryData<Bookmark[]>(queryKeys.bookmarks, (old = []) =>
        old.filter((bookmark) => bookmark.repositoryId !== repositoryId)
      );

      return { previousBookmarks };
    },
    onError: (err, repositoryId, context) => {
      if (context?.previousBookmarks) {
        queryClient.setQueryData(queryKeys.bookmarks, context.previousBookmarks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks });
    },
  });
}

// Tags hooks
export function useTags() {
  return useQuery<Tag[]>({
    queryKey: queryKeys.tags,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/tags');
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await apiRequest('POST', '/api/tags', data);
      return res.json();
    },
    onMutate: async (newTag) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tags });

      const previousTags = queryClient.getQueryData<Tag[]>(queryKeys.tags);

      queryClient.setQueryData<Tag[]>(queryKeys.tags, (old = []) => [
        ...old,
        {
          id: Date.now(),
          userId: '',
          name: newTag.name,
          color: newTag.color || '#3b82f6',
          createdAt: new Date().toISOString(),
          repositoryCount: 0,
        } as Tag,
      ]);

      return { previousTags };
    },
    onError: (err, newTag, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(queryKeys.tags, context.previousTags);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: number) => {
      const res = await apiRequest('DELETE', `/api/tags/${tagId}`);
      return res.json();
    },
    onMutate: async (tagId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tags });

      const previousTags = queryClient.getQueryData<Tag[]>(queryKeys.tags);

      queryClient.setQueryData<Tag[]>(queryKeys.tags, (old = []) =>
        old.filter((tag) => tag.id !== tagId)
      );

      return { previousTags };
    },
    onError: (err, tagId, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(queryKeys.tags, context.previousTags);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      // Also invalidate repository tags since they may be affected
      queryClient.invalidateQueries({ queryKey: ['repository-tags'] });
    },
  });
}

// Repository tags hooks
export function useRepositoryTags(repositoryId: string) {
  return useQuery<RepositoryTag[]>({
    queryKey: queryKeys.repositoryTags(repositoryId),
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/repositories/${repositoryId}/tags`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

export function useAddRepositoryTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { repositoryId: string; tagId: number }) => {
      const res = await apiRequest('POST', `/api/repositories/${data.repositoryId}/tags`, {
        tagId: data.tagId,
      });
      return res.json();
    },
    onMutate: async ({ repositoryId, tagId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.repositoryTags(repositoryId) });

      const previousTags = queryClient.getQueryData<RepositoryTag[]>(
        queryKeys.repositoryTags(repositoryId)
      );

      queryClient.setQueryData<RepositoryTag[]>(
        queryKeys.repositoryTags(repositoryId),
        (old = []) => [
          ...old,
          {
            id: Date.now(),
            repositoryId,
            tagId,
            userId: '',
            createdAt: new Date().toISOString(),
          } as RepositoryTag,
        ]
      );

      return { previousTags, repositoryId };
    },
    onError: (err, variables, context) => {
      if (context?.previousTags && context?.repositoryId) {
        queryClient.setQueryData(
          queryKeys.repositoryTags(context.repositoryId),
          context.previousTags
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositoryTags(variables.repositoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useRemoveRepositoryTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { repositoryId: string; tagId: number }) => {
      const res = await apiRequest(
        'DELETE',
        `/api/repositories/${data.repositoryId}/tags/${data.tagId}`
      );
      return res.json();
    },
    onMutate: async ({ repositoryId, tagId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.repositoryTags(repositoryId) });

      const previousTags = queryClient.getQueryData<RepositoryTag[]>(
        queryKeys.repositoryTags(repositoryId)
      );

      queryClient.setQueryData<RepositoryTag[]>(
        queryKeys.repositoryTags(repositoryId),
        (old = []) => old.filter((tag) => tag.tagId !== tagId)
      );

      return { previousTags, repositoryId };
    },
    onError: (err, variables, context) => {
      if (context?.previousTags && context?.repositoryId) {
        queryClient.setQueryData(
          queryKeys.repositoryTags(context.repositoryId),
          context.previousTags
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repositoryTags(variables.repositoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

// Preferences hooks
export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: queryKeys.preferences,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/preferences');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const res = await apiRequest('PUT', '/api/user/preferences', data);
      return res.json();
    },
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.preferences });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(queryKeys.preferences);

      queryClient.setQueryData<UserPreferences>(queryKeys.preferences, (old) => ({
        ...old!,
        ...newPreferences,
        updatedAt: new Date().toISOString(),
      }));

      return { previousPreferences };
    },
    onError: (err, newPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(queryKeys.preferences, context.previousPreferences);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
      // Invalidate recommendations since they depend on preferences
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
    },
  });
}

// Recommendations hooks
export function useRecommendations() {
  return useQuery<Recommendation[]>({
    queryKey: queryKeys.recommendations,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/recommendations');
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    retry: 2, // Retry fewer times for expensive operations
  });
}

// Helper to invalidate recommendation cache (called after new analyses)
export function useInvalidateRecommendations() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
  };
}
