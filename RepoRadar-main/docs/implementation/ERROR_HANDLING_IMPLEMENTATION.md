# Error Handling and Loading States Implementation

## Overview
Comprehensive error handling and loading states have been implemented for the intelligent profile feature, covering all components and API interactions.

## Components Implemented

### 1. Error Boundary (`client/src/components/error-boundary.tsx`)
- React error boundary component that catches JavaScript errors anywhere in the component tree
- Displays user-friendly error UI with retry functionality
- Supports custom fallback components
- Logs errors to console for debugging

### 2. Error Display (`client/src/components/error-display.tsx`)
- Reusable component for displaying API and application errors
- Automatically detects error types and shows appropriate icons/messages
- Supports compact mode for inline error display
- Shows retry button for retryable errors
- Integrates with UpgradePrompt for tier restriction errors

### 3. Loading Skeletons (`client/src/components/loading-skeletons.tsx`)
- Pre-built skeleton components for consistent loading states:
  - `RepositoryCardSkeleton` - For repository lists
  - `TagCardSkeleton` - For tag grids
  - `PreferenceFormSkeleton` - For preference forms
  - `ListSkeleton` - Generic list loading state
  - `GridSkeleton` - Generic grid loading state

## Error Handling Utilities (`client/src/lib/error-handling.ts`)

### Error Classes
1. **AppError** - Base error class with code, status, and retryable flag
2. **TierRestrictionError** - For feature access restrictions (403)
3. **ValidationError** - For input validation failures (400)
4. **NetworkError** - For network/connectivity issues

### Key Functions

#### `parseApiError(error: any): AppError`
Intelligently parses various error formats:
- Response objects (fetch API)
- Error objects
- Plain objects (API error responses)
- Automatically detects error types based on status codes and messages

#### `retryWithBackoff<T>(fn, config, shouldRetry): Promise<T>`
Implements automatic retry with exponential backoff:
- Configurable max retries, delays, and backoff multiplier
- Only retries errors marked as retryable
- Default: 3 retries with 1s, 2s, 4s delays (max 30s)

#### `getUserFriendlyErrorMessage(error): string`
Converts technical errors to user-friendly messages:
- Tier restrictions → "Upgrade to unlock"
- Network errors → "Check your connection"
- Server errors → "Try again later"
- Validation errors → Original message

#### Utility Functions
- `isTierRestrictionError(error)` - Check if error is tier-related
- `isRetryableError(error)` - Check if error can be retried
- `calculateBackoffDelay(attempt, config)` - Calculate exponential delay
- `sleep(ms)` - Promise-based delay utility

## React Query Integration

### Enhanced Query Client (`client/src/lib/queryClient.ts`)
Updated with intelligent retry logic:

**Queries:**
- Automatic retry for 5xx errors (up to 3 times)
- No retry for 4xx errors (client errors)
- Exponential backoff: 1s, 2s, 4s (max 30s)
- Uses `isRetryableError()` to determine retry eligibility

**Mutations:**
- Single retry for retryable errors
- No retry for client errors (4xx)
- Exponential backoff: 1s, 2s (max 5s)
- More conservative than queries (mutations modify data)

### Error Response Parsing
- Attempts to parse JSON error responses
- Falls back to status text if JSON parsing fails
- Integrates with `parseApiError()` for consistent error handling

## Component Integration

### Existing Components Enhanced
All profile tab components already have comprehensive error handling:

1. **BookmarksTab** ✅
   - Loading skeletons
   - Error display with retry
   - Tier restriction detection
   - Empty state handling
   - Optimistic updates with rollback

2. **TagsTab** ✅
   - Loading skeletons
   - Error display with retry
   - Tier restriction detection
   - Empty state handling
   - Form validation errors

3. **PreferencesTab** ✅
   - Loading skeletons
   - Error display with retry
   - Tier restriction detection
   - Field-specific validation errors
   - Unsaved changes tracking

4. **RecommendationsTab** ✅
   - Loading skeletons
   - Error display with retry
   - Tier restriction detection
   - Empty state handling

5. **BookmarkButton** ✅
   - Optimistic updates
   - Error handling with rollback
   - Tier restriction detection
   - Loading states

6. **TagSelector** ✅
   - Error handling for all operations
   - Tier restriction detection
   - Loading states
   - Validation errors

## Error Handling Patterns

### 1. API Request Pattern
```typescript
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["/api/endpoint"],
  staleTime: 2 * 60 * 1000,
});

if (isLoading) return <ListSkeleton />;
if (isError) return <ErrorDisplay error={error} onRetry={refetch} />;
```

### 2. Mutation Pattern
```typescript
const mutation = useMutation({
  mutationFn: async (data) => await apiRequest("POST", "/api/endpoint", data),
  onMutate: async () => {
    // Optimistic update
  },
  onSuccess: () => {
    // Invalidate queries
  },
  onError: (error, _, context) => {
    // Rollback optimistic update
    // Show error toast
  },
});
```

### 3. Tier Restriction Pattern
```typescript
if (isError) {
  const errorMessage = error instanceof Error ? error.message : "";
  const is403Error = errorMessage.includes("403") || 
                     errorMessage.includes("FEATURE_NOT_AVAILABLE");
  
  if (is403Error) {
    return <UpgradePrompt feature="feature-name" />;
  }
  
  return <ErrorDisplay error={error} onRetry={refetch} />;
}
```

### 4. Validation Error Pattern
```typescript
const [fieldError, setFieldError] = useState("");

const handleSubmit = () => {
  if (!value.trim()) {
    setFieldError("Field is required");
    return;
  }
  mutation.mutate(value);
};
```

## Testing

### Test Coverage
- ✅ Error class creation and properties
- ✅ Error parsing for all formats
- ✅ Exponential backoff calculation
- ✅ Retry logic with various scenarios
- ✅ User-friendly message generation
- ✅ Error type detection utilities
- ✅ Error boundary rendering and reset
- ✅ Error display component variants

### Test Files
- `client/src/lib/__tests__/error-handling.test.ts`
- `client/src/components/__tests__/error-boundary.test.tsx`
- `client/src/components/__tests__/error-display.test.tsx`

## Requirements Satisfied

✅ **7.8** - Error handling with user-friendly messages
- All errors converted to readable messages
- Context-specific error displays
- Helpful guidance for resolution

✅ **8.4** - Retry functionality for failed requests
- Automatic retry with exponential backoff
- Manual retry buttons in UI
- Configurable retry behavior

✅ **8.5** - Loading states for all async operations
- Skeleton loaders for all list/grid views
- Loading indicators on buttons
- Optimistic updates for better UX

✅ **8.10** - Tier restriction error handling
- Automatic detection of 403 errors
- Upgrade prompts with clear CTAs
- Graceful degradation for free users

## Additional Features

### Optimistic Updates
- Immediate UI feedback for mutations
- Automatic rollback on error
- Maintains data consistency

### Exponential Backoff
- Prevents server overload
- Increases success rate for transient errors
- Configurable delays and max retries

### Error Categorization
- Network errors (retryable)
- Server errors (retryable)
- Client errors (not retryable)
- Tier restrictions (upgrade required)
- Validation errors (user action required)

### Accessibility
- Screen reader friendly error messages
- Keyboard accessible retry buttons
- Clear visual error indicators
- ARIA labels on all interactive elements

## Usage Examples

### Basic Error Handling
```typescript
import { ErrorDisplay } from "@/components/error-display";
import { ListSkeleton } from "@/components/loading-skeletons";

function MyComponent() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["/api/data"],
  });

  if (isLoading) return <ListSkeleton count={5} />;
  if (isError) return <ErrorDisplay error={error} onRetry={refetch} />;

  return <div>{/* Render data */}</div>;
}
```

### Manual Retry with Backoff
```typescript
import { retryWithBackoff } from "@/lib/error-handling";

async function fetchData() {
  return await retryWithBackoff(
    () => apiRequest("GET", "/api/data"),
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    }
  );
}
```

### Custom Error Handling
```typescript
import { parseApiError, getUserFriendlyErrorMessage } from "@/lib/error-handling";

try {
  await apiRequest("POST", "/api/data", payload);
} catch (error) {
  const parsedError = parseApiError(error);
  const message = getUserFriendlyErrorMessage(error);
  
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}
```

## Best Practices

1. **Always use loading skeletons** - Better UX than spinners
2. **Provide retry buttons** - For retryable errors only
3. **Show specific error messages** - Help users understand what went wrong
4. **Implement optimistic updates** - For better perceived performance
5. **Handle tier restrictions gracefully** - Show upgrade prompts, not errors
6. **Log errors to console** - For debugging in development
7. **Use error boundaries** - Catch unexpected errors
8. **Test error scenarios** - Ensure proper error handling

## Future Enhancements

- Error reporting service integration (e.g., Sentry)
- Error analytics and monitoring
- Custom error pages for specific error types
- Offline mode detection and handling
- Rate limit error handling with countdown
- Bulk operation error aggregation
