import React, { Suspense, lazy, ComponentType } from 'react';
import { frontendFallbackManager } from './FrontendFallbackManager';

/**
 * Loading fallback component
 */
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

/**
 * Error boundary for lazy loaded components with fallback support
 */
class FallbackLazyRouteErrorBoundary extends React.Component<
  { 
    children: React.ReactNode; 
    chunkName: string;
    fallbackComponent?: React.ComponentType<any>;
  },
  { hasError: boolean; error?: Error; useFallback: boolean }
> {
  constructor(props: { 
    children: React.ReactNode; 
    chunkName: string;
    fallbackComponent?: React.ComponentType<any>;
  }) {
    super(props);
    this.state = { hasError: false, useFallback: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error loading chunk ${this.props.chunkName}:`, error, errorInfo);
    
    // Check if we have a synchronous fallback available
    const hasFallback = frontendFallbackManager.hasFallback('code-splitting', this.props.chunkName);
    if (hasFallback) {
      this.setState({ useFallback: true });
    }
  }

  render() {
    if (this.state.hasError) {
      // Try to use synchronous fallback if available
      if (this.state.useFallback && this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return <FallbackComponent />;
      }

      // Show error UI with retry option
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
          <div className="text-red-500 mb-2">Failed to load component</div>
          <div className="text-sm text-gray-500 mb-3">
            {this.state.error?.message || 'Unknown error occurred'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, useFallback: false });
                // Force reload the chunk
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Reload Page
            </button>
            {this.props.fallbackComponent && (
              <button
                onClick={() => {
                  this.setState({ useFallback: true });
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
              >
                Use Fallback
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Create a lazy-loaded route component with fallback support
 */
export function createFallbackLazyRoute<T extends ComponentType<any>>(
  chunkName: string,
  fallback?: React.ComponentType,
  synchronousFallback?: React.ComponentType<any>
): React.ComponentType<React.ComponentProps<T>> {
  // Register synchronous fallback if provided
  if (synchronousFallback) {
    frontendFallbackManager.registerSynchronousComponents({
      [chunkName]: synchronousFallback
    });
  }

  const LazyComponent = lazy(async () => {
    try {
      // Use fallback manager for loading with automatic fallback
      const component = await frontendFallbackManager.loadChunkWithFallback(chunkName);
      return { default: component };
    } catch (error) {
      console.error(`All fallback strategies failed for lazy route ${chunkName}:`, error);
      
      // Return a final error component
      return {
        default: () => (
          <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
            <div className="text-red-500 mb-2">Failed to load page</div>
            <div className="text-sm text-gray-500 mb-3">
              All loading strategies failed. Please try refreshing the page.
            </div>
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
    <FallbackLazyRouteErrorBoundary 
      chunkName={chunkName}
      fallbackComponent={synchronousFallback}
    >
      <Suspense fallback={fallback ? React.createElement(fallback) : <LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    </FallbackLazyRouteErrorBoundary>
  );

  // Set display name for debugging
  WrappedComponent.displayName = `FallbackLazyRoute(${chunkName})`;

  return WrappedComponent;
}

/**
 * Preload a route component with fallback support
 */
export function preloadRouteWithFallback(chunkName: string): Promise<void> {
  const fallbackCodeSplitter = frontendFallbackManager.createFallbackCodeSplitter();
  return fallbackCodeSplitter.preloadChunk(chunkName);
}

/**
 * Hook to preload routes on hover or focus with fallback support
 */
export function useFallbackRoutePreloader() {
  const preloadOnHover = React.useCallback((chunkName: string) => {
    return {
      onMouseEnter: () => preloadRouteWithFallback(chunkName),
      onFocus: () => preloadRouteWithFallback(chunkName),
    };
  }, []);

  return { preloadOnHover };
}

/**
 * Hook to get fallback statistics for routes
 */
export function useRouteFallbackStats() {
  const [stats, setStats] = React.useState(frontendFallbackManager.getFallbackStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(frontendFallbackManager.getFallbackStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return stats;
}

/**
 * Component to display fallback statistics
 */
export const FallbackStatsDisplay: React.FC<{ className?: string }> = ({ className }) => {
  const stats = useRouteFallbackStats();

  if (stats.totalEvents === 0) {
    return null;
  }

  return (
    <div className={`p-2 bg-yellow-50 border border-yellow-200 rounded text-sm ${className || ''}`}>
      <div className="font-medium text-yellow-800 mb-1">Fallback Statistics</div>
      <div className="text-yellow-700 space-y-1">
        <div>Total fallback events: {stats.totalEvents}</div>
        <div>Code splitting fallbacks: {stats.codeSplittingFallbacks}</div>
        <div>Lazy loading fallbacks: {stats.lazyLoadingFallbacks}</div>
        <div>Successful fallbacks: {stats.successfulFallbacks}</div>
      </div>
    </div>
  );
};