# Loading States and User Feedback - Developer Guide

## Overview

The loading states system provides a consistent way to show users that the application is working on their request. It includes skeleton screens, progress indicators, and loading state management hooks.

## Components

### SkeletonLoader

Displays placeholder content while actual content is loading.

**Props:**
```typescript
interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'table' | 'text' | 'circle';
  count?: number;
  height?: string | number;
  width?: string | number;
  className?: string;
}
```

**Usage:**
```typescript
import { SkeletonLoader } from '@/components/skeleton-loader';

function RepositoryList() {
  const { data, loading } = useRepositories();
  
  if (loading) {
    return <SkeletonLoader variant="list" count={5} />;
  }
  
  return <div>{/* Actual content */}</div>;
}
```

### ProgressIndicator

Shows progress for long-running operations.

**Props:**
```typescript
interface ProgressIndicatorProps {
  progress: number; // 0-100
  status?: 'loading' | 'processing' | 'complete' | 'error';
  message?: string;
  showPercentage?: boolean;
}
```

**Usage:**
```typescript
import { ProgressIndicator } from '@/components/progress-indicator';

function BatchAnalysis() {
  const [progress, setProgress] = useState(0);
  
  return (
    <ProgressIndicator 
      progress={progress}
      status="processing"
      message="Analyzing repositories..."
      showPercentage
    />
  );
}
```

## Hooks

### useLoadingState

Manages loading state for a component.

**API:**
```typescript
function useLoadingState(initialState = false) {
  return {
    loading: boolean;
    startLoading: () => void;
    stopLoading: () => void;
    setLoading: (loading: boolean) => void;
  };
}
```

**Usage:**
```typescript
import { useLoadingState } from '@/hooks/useLoadingState';

function MyComponent() {
  const { loading, startLoading, stopLoading } = useLoadingState();
  
  const handleAction = async () => {
    startLoading();
    try {
      await performAction();
    } finally {
      stopLoading();
    }
  };
}
```

### useAsyncOperation

Handles async operations with automatic loading and error state management.

**API:**
```typescript
function useAsyncOperation<T>() {
  return {
    execute: (fn: () => Promise<T>) => Promise<T>;
    loading: boolean;
    error: Error | null;
    data: T | null;
    reset: () => void;
  };
}
```

**Usage:**
```typescript
import { useAsyncOperation } from '@/hooks/useAsyncOperation';

function RepositoryAnalysis() {
  const { execute, loading, error, data } = useAsyncOperation();
  
  const analyzeRepo = async (repo: string) => {
    const result = await execute(() => api.analyzeRepository(repo));
    // result is typed correctly
  };
  
  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data}</div>;
}
```

## Best Practices

### 1. Show Skeletons Immediately

Always show skeleton screens immediately when loading starts:

```typescript
// Good
if (loading) {
  return <SkeletonLoader variant="card" count={3} />;
}

// Bad - shows nothing while loading
if (loading) {
  return null;
}
```

### 2. Match Skeleton to Content

Make skeleton screens match the actual content layout:

```typescript
// Good - skeleton matches card layout
<SkeletonLoader variant="card" height={200} />

// Bad - generic skeleton doesn't match
<SkeletonLoader variant="text" />
```

### 3. Use Progress for Long Operations

For operations > 2 seconds, show progress:

```typescript
const [progress, setProgress] = useState(0);

async function longOperation() {
  for (let i = 0; i < items.length; i++) {
    await processItem(items[i]);
    setProgress((i + 1) / items.length * 100);
  }
}
```

### 4. Smooth Transitions

Use CSS transitions for smooth loading → content transitions:

```css
.content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 5. Avoid Layout Shifts

Ensure skeleton and content have same dimensions:

```typescript
// Good - consistent height
<div style={{ minHeight: '200px' }}>
  {loading ? <SkeletonLoader height={200} /> : <Content />}
</div>
```

## Performance Considerations

### 1. Render Skeletons Quickly

Skeleton components should render in < 100ms:

```typescript
// Good - simple, fast skeleton
const SkeletonCard = () => (
  <div className="skeleton-card" />
);

// Bad - complex skeleton with many elements
const SkeletonCard = () => (
  <div>
    {Array.from({ length: 100 }).map((_, i) => (
      <div key={i} className="skeleton-line" />
    ))}
  </div>
);
```

### 2. Use CSS Animations

Prefer CSS animations over JavaScript:

```css
/* Good - CSS animation */
.skeleton {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 3. Limit Skeleton Count

Don't render too many skeletons:

```typescript
// Good - reasonable count
<SkeletonLoader count={5} />

// Bad - too many skeletons
<SkeletonLoader count={100} />
```

## Testing

### Unit Tests

Test loading states:

```typescript
import { render, screen } from '@testing-library/react';
import { SkeletonLoader } from '@/components/skeleton-loader';

test('renders skeleton loader', () => {
  render(<SkeletonLoader variant="card" count={3} />);
  const skeletons = screen.getAllByTestId('skeleton');
  expect(skeletons).toHaveLength(3);
});
```

### Integration Tests

Test loading → content transitions:

```typescript
test('shows skeleton then content', async () => {
  render(<RepositoryList />);
  
  // Initially shows skeleton
  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  
  // After loading, shows content
  await waitFor(() => {
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
  });
});
```

## Accessibility

### 1. ARIA Labels

Add appropriate ARIA labels:

```typescript
<div role="status" aria-label="Loading content">
  <SkeletonLoader />
</div>
```

### 2. Screen Reader Announcements

Announce loading state changes:

```typescript
<div role="status" aria-live="polite">
  {loading ? 'Loading...' : 'Content loaded'}
</div>
```

### 3. Focus Management

Maintain focus during loading:

```typescript
const buttonRef = useRef<HTMLButtonElement>(null);

const handleClick = async () => {
  await loadData();
  buttonRef.current?.focus(); // Restore focus
};
```

## Examples

### Repository List with Skeleton

```typescript
function RepositoryList() {
  const { data, loading, error } = useRepositories();
  
  if (loading) {
    return (
      <div className="repository-list">
        <SkeletonLoader variant="card" count={5} height={120} />
      </div>
    );
  }
  
  if (error) {
    return <ErrorMessage error={error} />;
  }
  
  return (
    <div className="repository-list">
      {data.map(repo => (
        <RepositoryCard key={repo.id} repository={repo} />
      ))}
    </div>
  );
}
```

### Batch Operation with Progress

```typescript
function BatchAnalysis() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete'>('idle');
  
  const analyzeBatch = async (repos: string[]) => {
    setStatus('processing');
    
    for (let i = 0; i < repos.length; i++) {
      await analyzeRepository(repos[i]);
      setProgress((i + 1) / repos.length * 100);
    }
    
    setStatus('complete');
  };
  
  if (status === 'processing') {
    return (
      <ProgressIndicator
        progress={progress}
        status="processing"
        message={`Analyzing repositories... UTF8{Math.round(progress)}%`}
        showPercentage
      />
    );
  }
  
  return <BatchAnalysisForm onSubmit={analyzeBatch} />;
}
```

## Files

- `client/src/components/skeleton-loader.tsx`
- `client/src/components/progress-indicator.tsx`
- `client/src/hooks/useLoadingState.ts`
- `client/src/hooks/useAsyncOperation.ts`
- `client/src/__tests__/skeleton-loader.test.tsx`
- `client/src/__tests__/progress-indicator.test.tsx`

---

**Last Updated:** January 4, 2025
