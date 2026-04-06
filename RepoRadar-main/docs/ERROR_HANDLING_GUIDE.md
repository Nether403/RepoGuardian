# Error Handling and Recovery - Developer Guide

## Overview

The error handling system provides consistent, user-friendly error messages and automatic recovery mechanisms. It includes error classification, retry logic, and user-facing error components.

## Core Concepts

### AppError Class

Base error class with user-friendly messages:

```typescript
class AppError extends Error {
  code: string;
  userMessage: string;
  recoveryAction?: string;
  details?: Record<string, any>;
  statusCode: number;
  
  constructor(
    code: string,
    message: string,
    userMessage: string,
    statusCode = 500
  ) {
    super(message);
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
  }
}
```

### Error Codes

Standard error codes:

- `NETWORK_ERROR` - Network connectivity issues
- `API_ERROR` - External API failures
- `RATE_LIMIT_EXCEEDED` - API rate limiting
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `VALIDATION_ERROR` - Invalid input
- `TIMEOUT_ERROR` - Operation timeout
- `UNKNOWN_ERROR` - Unexpected errors

## Components

### ErrorBoundary

Catches React errors and provides recovery UI:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';

function App() {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div>
          <h1>Something went wrong</h1>
          <p>{error.userMessage}</p>
          <button onClick={retry}>Try Again</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('Error caught:', error, errorInfo);
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

### ErrorMessage

Displays user-friendly error messages:

```typescript
import { ErrorMessage } from '@/components/error-message';

function MyComponent() {
  const { error } = useData();
  
  if (error) {
    return (
      <ErrorMessage
        error={error}
        onRetry={() => refetch()}
        onDismiss={() => clearError()}
        severity="error"
      />
    );
  }
}
```

## Services

### ErrorHandler

Classifies and transforms errors:

```typescript
import { ErrorHandler } from '@/lib/error-handler';

try {
  await riskyOperation();
} catch (error) {
  const appError = ErrorHandler.handle(error, {
    operation: 'repository_analysis',
    repository: 'owner/name'
  });
  
  // appError.userMessage is user-friendly
  // appError.recoveryAction suggests what to do
  showError(appError);
}
```

**Methods:**

- `handle(error, context)` - Convert any error to AppError
- `isRetryable(error)` - Check if error can be retried
- `getRecoveryAction(error)` - Get suggested recovery action

### RetryHandler

Implements retry logic with exponential backoff:

```typescript
import { RetryHandler } from '@/lib/retry-handler';

const retryHandler = new RetryHandler({
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000
});

const result = await retryHandler.executeWithRetry(async () => {
  return await fetchData();
});
```

**Options:**

- `maxAttempts` - Maximum retry attempts (default: 3)
- `backoff` - 'linear' or 'exponential' (default: 'exponential')
- `initialDelay` - Initial delay in ms (default: 1000)
- `maxDelay` - Maximum delay in ms (default: 10000)
- `onRetry` - Callback before each retry

## Error Handling Patterns

### 1. API Calls

```typescript
import { ErrorHandler } from '@/lib/error-handler';
import { RetryHandler } from '@/lib/retry-handler';

async function fetchRepository(owner: string, repo: string) {
  const retryHandler = new RetryHandler();
  
  try {
    return await retryHandler.executeWithRetry(async () => {
      const response = await fetch(`/api/repos/tests/Comprehensive.integration.test.ts{owner}/tests/Comprehensive.integration.test.ts{repo}`);
      
      if (!response.ok) {
        throw new AppError(
          'API_ERROR',
          `API returned tests/Comprehensive.integration.test.ts{response.status}`,
          'Failed to fetch repository. Please try again.',
          response.status
        );
      }
      
      return response.json();
    });
  } catch (error) {
    throw ErrorHandler.handle(error, {
      operation: 'fetch_repository',
      owner,
      repo
    });
  }
}
```

### 2. Form Validation

```typescript
function validateForm(data: FormData): void {
  const errors: string[] = [];
  
  if (!data.repository) {
    errors.push('Repository name is required');
  }
  
  if (errors.length > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      errors.join(', '),
      'Please fix the following errors: ' + errors.join(', '),
      400
    );
  }
}
```

### 3. Rate Limiting

```typescript
function handleRateLimit(resetTime: number) {
  const minutesUntilReset = Math.ceil((resetTime - Date.now()) / 60000);
  
  throw new AppError(
    'RATE_LIMIT_EXCEEDED',
    'GitHub API rate limit exceeded',
    `Rate limit exceeded. Try again in tests/Comprehensive.integration.test.ts{minutesUntilReset} minutes.`,
    429
  );
}
```

### 4. Network Errors

```typescript
function handleNetworkError(error: Error) {
  if (error.message.includes('ECONNREFUSED')) {
    throw new AppError(
      'NETWORK_ERROR',
      'Connection refused',
      'Unable to connect to the server. Please check your internet connection.',
      503
    );
  }
  
  if (error.message.includes('ETIMEDOUT')) {
    throw new AppError(
      'TIMEOUT_ERROR',
      'Request timeout',
      'The request took too long. Please try again.',
      504
    );
  }
}
```

## Best Practices

### 1. Always Provide User-Friendly Messages

```typescript
// Good
throw new AppError(
  'NOT_FOUND',
  'Repository not found in database',
  'We couldn''t find that repository. It may be private or deleted.'
);

// Bad
throw new Error('Repository not found in database');
```

### 2. Include Recovery Actions

```typescript
// Good
const error = new AppError(
  'UNAUTHORIZED',
  'Authentication required',
  'Please sign in to continue.'
);
error.recoveryAction = 'Sign in with GitHub';

// Bad
throw new Error('Unauthorized');
```

### 3. Add Context to Errors

```typescript
// Good
try {
  await operation();
} catch (error) {
  throw ErrorHandler.handle(error, {
    operation: 'analyze_repository',
    repository: 'owner/name',
    timestamp: new Date().toISOString()
  });
}

// Bad
try {
  await operation();
} catch (error) {
  throw error;
}
```

### 4. Use Retry for Transient Errors

```typescript
// Good - retry network errors
const retryHandler = new RetryHandler();
await retryHandler.executeWithRetry(() => fetchData());

// Bad - no retry for transient errors
await fetchData(); // Fails on temporary network issues
```

### 5. Log Errors Appropriately

```typescript
// Good - log technical details, show user-friendly message
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error);
  const appError = ErrorHandler.handle(error);
  showToast(appError.userMessage);
}

// Bad - show technical error to user
try {
  await operation();
} catch (error) {
  showToast(error.message); // Technical message
}
```

## Testing

### Unit Tests

```typescript
import { ErrorHandler } from '@/lib/error-handler';

describe('ErrorHandler', () => {
  it('converts network errors to AppError', () => {
    const error = new Error('ECONNREFUSED');
    const appError = ErrorHandler.handle(error);
    
    expect(appError.code).toBe('NETWORK_ERROR');
    expect(appError.userMessage).toContain('internet connection');
  });
  
  it('provides recovery actions', () => {
    const error = new AppError('RATE_LIMIT_EXCEEDED', '', '');
    const action = ErrorHandler.getRecoveryAction(error);
    
    expect(action).toContain('Wait for rate limit');
  });
});
```

### Integration Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

test('shows error message and retry button', async () => {
  const onRetry = jest.fn();
  
  render(
    <ErrorMessage
      error={new AppError('API_ERROR', '', 'Failed to load data')}
      onRetry={onRetry}
    />
  );
  
  expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  
  fireEvent.click(screen.getByText('Try Again'));
  expect(onRetry).toHaveBeenCalled();
});
```

## Accessibility

### 1. ARIA Roles

```typescript
<div role="alert" aria-live="assertive">
  <ErrorMessage error={error} />
</div>
```

### 2. Focus Management

```typescript
const errorRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (error) {
    errorRef.current?.focus();
  }
}, [error]);

return (
  <div ref={errorRef} tabIndex={-1}>
    <ErrorMessage error={error} />
  </div>
);
```

### 3. Keyboard Navigation

```typescript
<ErrorMessage
  error={error}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>
// Ensure retry and dismiss buttons are keyboard accessible
```

## Files

- `shared/errors.ts` - Error classes
- `client/src/lib/error-handler.ts` - Client error handler
- `client/src/lib/retry-handler.ts` - Retry logic
- `server/utils/errorHandler.ts` - Server error handler
- `server/utils/retryHandler.ts` - Server retry logic
- `client/src/components/error-boundary.tsx` - Error boundary
- `client/src/components/error-message.tsx` - Error message component

---

**Last Updated:** January 4, 2025
