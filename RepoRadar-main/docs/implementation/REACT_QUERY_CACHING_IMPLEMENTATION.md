# React Query Caching Strategy Implementation

## Overview
Implemented a comprehensive React Query caching strategy for the Intelligent User Profile feature with appropriate cache times, optimistic updates, cache invalidation, and exponential backoff retry logic.

## Implementation Details

### 1. QueryClient Configuration (`client/src/lib/queryClient.ts`)

Updated the global QueryClient with:

- **Default stale time**: 5 minutes (for general queries)
- **Default gc time**: 10 minutes (formerly cacheTime)
- **Retry logic with exponential backoff**:
  - Don't retry on 4xx client errors (401, 403, 404)
  - Retry up to 3 times for other errors
  - Exponential backoff: 1s, 2s, 4s (capped at 30s)
- **Mutation retry**: Limited to 1 retry for network errors only

### 2. Intelligent Profile Hooks (`client/src/hooks/useIntelligentProfile.ts`)

Created dedicated hooks with feature-specific caching strategies:

#### Bookmarks
- **Stale time**: 2 minutes (frequently updated)
- **GC time**: 5 minutes
- **Optimistic updates**: Add/remove bookmarks immediately
- **Rollback**: Automatic rollback on error
- **Cache invalidation**: After mutations

#### Tags
- **Stale time**: 10 minutes (rarely updated)
- **GC time**: 20 minutes
- **Optimistic updates**: Create/delete tags immediately
- **Cascade invalidation**: Invalidates repository tags when tag is deleted
- **Cache invalidation**: After mutations

#### Repository Tags
- **Stale time**: 5 minutes
- **GC time**: 10 minutes
- **Optimistic updates**: Add/remove tags from repositories immediately
- **Cross-cache invalidation**: Invalidates both repository tags and tags list
- **Cache invalidation**: After mutations

#### Preferences
- **Stale time**: 5 minutes
- **GC time**: 10 minutes
- **Optimistic updates**: Update preferences immediately
- **Cascade invalidation**: Invalidates recommendations when preferences change
- **Cache invalidation**: After mutations

#### Recommendations
- **Stale time**: 24 hours (expensive to generate)
- **GC time**: 48 hours
- **Reduced retries**: Only 2 retries for expensive AI operations
- **Cache invalidation**: Triggered by preference updates or new analyses

### 3. Key Features

#### Optimistic Updates
All mutations implement optimistic updates for instant UI feedback:
- Immediately update the cache before the server responds
- Rollback to previous state if the mutation fails
- Refetch data after mutation settles

#### Cache Invalidation Strategy
- **Bookmarks**: Invalidate on add/remove
- **Tags**: Invalidate tags and repository-tags on delete
- **Repository Tags**: Invalidate both repository-tags and tags
- **Preferences**: Invalidate preferences and recommendations
- **Recommendations**: Invalidate on preference changes or new analyses

#### Exponential Backoff
Retry logic with exponential backoff prevents overwhelming the server:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 4 seconds delay
- Maximum delay: 30 seconds

#### Error Handling
- Client errors (4xx): No retry
- Server errors (5xx): Retry with backoff
- Network errors: Retry with backoff
- Mutation errors: Limited retry (1 attempt)

### 4. Query Keys
Centralized query keys for consistency:
```typescript
export const queryKeys = {
  bookmarks: ['bookmarks'],
  tags: ['tags'],
  preferences: ['preferences'],
  recommendations: ['recommendations'],
  repositoryTags: (repositoryId: string) => ['repository-tags', repositoryId],
};
```

### 5. Testing (`client/src/hooks/__tests__/useIntelligentProfile.test.tsx`)

Comprehensive test suite covering:
- ✅ Cache times for all features
- ✅ Optimistic updates for all mutations
- ✅ Rollback on error
- ✅ Cache invalidation
- ✅ Cross-cache invalidation (tags → repository-tags, preferences → recommendations)
- ✅ Exponential backoff configuration

**Test Results**: 17/17 tests passing

## Performance Benefits

1. **Reduced API calls**: Appropriate stale times prevent unnecessary refetches
2. **Instant UI updates**: Optimistic updates provide immediate feedback
3. **Smart invalidation**: Only invalidate related caches, not everything
4. **Efficient retries**: Exponential backoff prevents server overload
5. **Long-lived expensive data**: 24-hour cache for AI recommendations

## Cache Time Summary

| Feature | Stale Time | GC Time | Rationale |
|---------|-----------|---------|-----------|
| Bookmarks | 2 minutes | 5 minutes | Frequently updated by users |
| Tags | 10 minutes | 20 minutes | Rarely updated once created |
| Repository Tags | 5 minutes | 10 minutes | Moderate update frequency |
| Preferences | 5 minutes | 10 minutes | Occasionally updated |
| Recommendations | 24 hours | 48 hours | Expensive AI operation |
| Default | 5 minutes | 10 minutes | Balanced for general queries |

## Requirements Satisfied

✅ **Requirement 7.10**: Configure QueryClient with appropriate cache times  
✅ **Requirement 4.18**: Set 24-hour stale time for recommendations  
✅ Implement cache invalidation on mutations  
✅ Add optimistic updates for all mutations  
✅ Configure retry logic with exponential backoff  
✅ Set 2-minute stale time for bookmarks  
✅ Set 10-minute stale time for tags  

## Usage Example

```typescript
import {
  useBookmarks,
  useAddBookmark,
  useTags,
  usePreferences,
  useRecommendations,
} from '@/hooks/useIntelligentProfile';

function MyComponent() {
  // Fetch data with automatic caching
  const { data: bookmarks, isLoading } = useBookmarks();
  const { data: tags } = useTags();
  const { data: recommendations } = useRecommendations();
  
  // Mutations with optimistic updates
  const addBookmark = useAddBookmark();
  const updatePreferences = useUpdatePreferences();
  
  // Add bookmark with instant UI update
  const handleBookmark = (repoId: string) => {
    addBookmark.mutate({ repositoryId: repoId });
    // UI updates immediately, rolls back on error
  };
  
  return (
    // Component JSX
  );
}
```

## Next Steps

The caching strategy is now ready to be used by:
- BookmarkButton component
- TagSelector component
- BookmarksTab component
- TagsTab component
- PreferencesTab component
- RecommendationsTab component

All components can import and use these hooks for consistent caching behavior across the application.
