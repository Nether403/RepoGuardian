import React, { useEffect, useRef, useState, Suspense } from 'react';
import { lazyLoader } from './LazyLoader';
import { LazyLoadOptions } from './interfaces';

/**
 * Props for LazyComponent
 */
interface LazyComponentProps {
  /** Unique identifier for the component */
  componentId: string;
  /** Function that returns a promise resolving to the component */
  loader: () => Promise<React.ComponentType<any>>;
  /** Lazy loading options */
  options?: LazyLoadOptions;
  /** Props to pass to the loaded component */
  componentProps?: Record<string, any>;
  /** Custom loading fallback */
  fallback?: React.ComponentType;
  /** Custom error fallback */
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** Additional CSS classes */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
}

/**
 * Default loading fallback component
 */
const DefaultLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
);

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="flex flex-col items-center justify-center p-4 text-center">
    <div className="text-red-500 mb-2">Failed to load component</div>
    <div className="text-sm text-gray-500 mb-3">{error.message}</div>
    <button
      onClick={retry}
      className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
    >
      Retry
    </button>
  </div>
);

/**
 * LazyComponent - A component that loads lazily based on viewport intersection
 */
export const LazyComponent: React.FC<LazyComponentProps> = ({
  componentId,
  loader,
  options = {},
  componentProps = {},
  fallback: CustomFallback,
  errorFallback: CustomErrorFallback,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Register component and set up intersection observer
  useEffect(() => {
    // Register the component with the lazy loader
    lazyLoader.register(componentId, loader, options);

    const handleLoad = async () => {
      if (loadedComponent || isLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const component = await lazyLoader.loadComponent(componentId);
        setLoadedComponent(component.default || component);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load component'));
      } finally {
        setIsLoading(false);
      }
    };

    // If immediate loading is requested, load now
    if (options.immediate) {
      handleLoad();
    } else if (containerRef.current) {
      // Set up intersection observer
      lazyLoader.observeElement(componentId, containerRef.current);
      
      // Also listen for manual loading
      const checkStatus = () => {
        const status = lazyLoader.getLoadingStatus(componentId);
        if (status === 'loading' && !isLoading) {
          handleLoad();
        }
      };

      const interval = setInterval(checkStatus, 100);
      return () => clearInterval(interval);
    }

    return () => {
      lazyLoader.unregister(componentId);
    };
  }, [componentId, loader, options, loadedComponent, isLoading]);

  // Retry function for error fallback
  const retry = () => {
    setError(null);
    setLoadedComponent(null);
    lazyLoader.unregister(componentId);
    lazyLoader.register(componentId, loader, { ...options, immediate: true });
  };

  // Render error state
  if (error) {
    const ErrorComponent = CustomErrorFallback || DefaultErrorFallback;
    return (
      <div ref={containerRef} className={className} style={style}>
        <ErrorComponent error={error} retry={retry} />
      </div>
    );
  }

  // Render loaded component
  if (loadedComponent) {
    return (
      <div ref={containerRef} className={className} style={style}>
        <Suspense fallback={CustomFallback ? <CustomFallback /> : <DefaultLoadingFallback />}>
          <loadedComponent {...componentProps} />
        </Suspense>
      </div>
    );
  }

  // Render loading state
  const LoadingComponent = CustomFallback || DefaultLoadingFallback;
  return (
    <div ref={containerRef} className={className} style={style}>
      <LoadingComponent />
    </div>
  );
};

/**
 * Hook for using lazy loading functionality
 */
export function useLazyComponent(
  componentId: string,
  loader: () => Promise<React.ComponentType<any>>,
  options: LazyLoadOptions = {}
) {
  const [loadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = async () => {
    if (loadedComponent || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      lazyLoader.register(componentId, loader, options);
      const component = await lazyLoader.loadComponent(componentId);
      setLoadedComponent(component.default || component);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setIsLoading(false);
    }
  };

  const observeElement = (element: HTMLElement) => {
    lazyLoader.register(componentId, loader, options);
    lazyLoader.observeElement(componentId, element);
  };

  return {
    loadedComponent,
    isLoading,
    error,
    loadComponent,
    observeElement
  };
}

/**
 * Higher-order component for lazy loading
 */
export function withLazyLoading<P extends object>(
  componentId: string,
  loader: () => Promise<React.ComponentType<P>>,
  options: LazyLoadOptions = {}
) {
  return function LazyWrappedComponent(props: P) {
    return (
      <LazyComponent
        componentId={componentId}
        loader={loader}
        options={options}
        componentProps={props}
      />
    );
  };
}