import React, { Suspense, lazy, ComponentType } from 'react';
import { codeSplitter } from './CodeSplitter';

/**
 * Loading fallback component
 */
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

/**
 * Error boundary for lazy loaded components
 */
class LazyRouteErrorBoundary extends React.Component<
  { children: React.ReactNode; chunkName: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; chunkName: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error loading chunk ${this.props.chunkName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
          <div className="text-red-500 mb-2">Failed to load component</div>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              // Force reload the chunk
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Create a lazy-loaded route component
 */
export function createLazyRoute<T extends ComponentType<any>>(
  chunkName: string,
  fallback?: React.ComponentType
): React.ComponentType<React.ComponentProps<T>> {
  const LazyComponent = lazy(async () => {
    try {
      const component = await codeSplitter.loadChunk(chunkName);
      return { default: component };
    } catch (error) {
      console.error(`Failed to load lazy route ${chunkName}:`, error);
      // Return a fallback component that shows the error
      return {
        default: () => (
          <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
            <div className="text-red-500 mb-2">Failed to load page</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        ),
      };
    }
  });

  const WrappedComponent: React.ComponentType<React.ComponentProps<T>> = (props) => (
    <LazyRouteErrorBoundary chunkName={chunkName}>
      <Suspense fallback={fallback ? React.createElement(fallback) : <LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyRouteErrorBoundary>
  );

  // Set display name for debugging
  WrappedComponent.displayName = `LazyRoute(${chunkName})`;

  return WrappedComponent;
}

/**
 * Preload a route component
 */
export function preloadRoute(chunkName: string): Promise<void> {
  return codeSplitter.preloadChunk(chunkName);
}

/**
 * Hook to preload routes on hover or focus
 */
export function useRoutePreloader() {
  const preloadOnHover = React.useCallback((chunkName: string) => {
    return {
      onMouseEnter: () => preloadRoute(chunkName),
      onFocus: () => preloadRoute(chunkName),
    };
  }, []);

  return { preloadOnHover };
}