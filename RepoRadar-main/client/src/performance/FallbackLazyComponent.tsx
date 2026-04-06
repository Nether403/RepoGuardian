import React, { useEffect, useRef, useState, Suspense } from 'react';
import { frontendFallbackManager } from './FrontendFallbackManager';
import { LazyLoadOptions } from './interfaces';

/**
 * Props for FallbackLazyComponent
 */
interface FallbackLazyComponentProps {
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
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void; useFallback: () => void }>;
  /** Immediate fallback component for loading failures */
  immediateFallback?: React.ComponentType<any>;
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
 * Default error fallback component with fallback options
 */
const DefaultErrorFallback: React.FC<{ 
  error: Error; 
  retry: () => void; 
  useFallback: () => void;
  hasFallback: boolean;
}> = ({ error, retry, useFallback, hasFallback }) => (
  <div className="flex flex-col items-center justify-center p-4 text-center">
    <div className="text-red-500 mb-2">Failed to load component</div>
    <div className="text-sm text-gray-500 mb-3">{error.message}</div>
    <div className="flex gap-2">
      <button
        onClick={retry}
        className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
      >
        Retry
      </button>
      {hasFallback && (
        <button
          onClick={useFallback}
          className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90"
        >
          Use Fallback
        </button>
      )}
    </div>
  </div>
);

/**
 * FallbackLazyComponent - A component that loads lazily with comprehensive fallback strategies
 */
export const FallbackLazyComponent: React.FC<FallbackLazyComponentProps> = ({
  componentId,
  loader,
  options = {},
  componentProps = {},
  fallback: CustomFallback,
  errorFallback: CustomErrorFallback,
  immediateFallback,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Register immediate fallback if provided
  useEffect(() => {
    if (immediateFallback) {
      frontendFallbackManager.registerImmediateComponents(componentId, immediateFallback);
    }
  }, [componentId, immediateFallback]);

  // Register component and set up intersection observer
  useEffect(() => {
    const fallbackLazyLoader = frontendFallbackManager.createFallbackLazyLoader();
    
    // Register the component with the fallback-enabled lazy loader
    fallbackLazyLoader.register(componentId, loader, options);

    const handleLoad = async () => {
      if (loadedComponent || isLoading) return;

      setIsLoading(true);
      setError(null);
      setUseFallback(false);

      try {
        const component = await frontendFallbackManager.loadComponentWithFallback(componentId);
        setLoadedComponent(component.default || component);
      } catch (err) {
        const loadError = err instanceof Error ? err : new Error('Failed to load component');
        setError(loadError);
        
        // Check if we should automatically use fallback
        const hasFallback = frontendFallbackManager.hasFallback('lazy-loading', componentId);
        if (hasFallback && options.immediate) {
          setUseFallback(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // If immediate loading is requested, load now
    if (options.immediate) {
      handleLoad();
    } else if (containerRef.current) {
      // Set up intersection observer
      fallbackLazyLoader.observeElement(componentId, containerRef.current);
      
      // Also listen for manual loading
      const checkStatus = () => {
        if (!isLoading && !loadedComponent && !error) {
          handleLoad();
        }
      };

      const interval = setInterval(checkStatus, 100);
      return () => {
        clearInterval(interval);
        fallbackLazyLoader.unregister(componentId);
      };
    }

    return () => {
      fallbackLazyLoader.unregister(componentId);
    };
  }, [componentId, loader, options, loadedComponent, isLoading, error]);

  // Retry function for error fallback
  const retry = () => {
    setError(null);
    setLoadedComponent(null);
    setUseFallback(false);
    
    // Re-register and load immediately
    const fallbackLazyLoader = frontendFallbackManager.createFallbackLazyLoader();
    fallbackLazyLoader.register(componentId, loader, { ...options, immediate: true });
  };

  // Use fallback function
  const handleUseFallback = () => {
    setUseFallback(true);
    setError(null);
  };

  // Render fallback component if requested and available
  if (useFallback && immediateFallback) {
    const FallbackComponent = immediateFallback;
    return (
      <div ref={containerRef} className={className} style={style}>
        <FallbackComponent {...componentProps} />
      </div>
    );
  }

  // Render error state
  if (error && !useFallback) {
    const hasFallback = frontendFallbackManager.hasFallback('lazy-loading', componentId);
    
    if (CustomErrorFallback) {
      return (
        <div ref={containerRef} className={className} style={style}>
          <CustomErrorFallback 
            error={error} 
            retry={retry} 
            useFallback={handleUseFallback}
          />
        </div>
      );
    }
    
    return (
      <div ref={containerRef} className={className} style={style}>
        <DefaultErrorFallback 
          error={error} 
          retry={retry} 
          useFallback={handleUseFallback}
          hasFallback={hasFallback}
        />
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
 * Hook for using lazy loading functionality with fallback support
 */
export function useFallbackLazyComponent(
  componentId: string,
  loader: () => Promise<React.ComponentType<any>>,
  options: LazyLoadOptions = {},
  immediateFallback?: React.ComponentType<any>
) {
  const [loadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Register immediate fallback if provided
  useEffect(() => {
    if (immediateFallback) {
      frontendFallbackManager.registerImmediateComponents(componentId, immediateFallback);
    }
  }, [componentId, immediateFallback]);

  const loadComponent = async () => {
    if (loadedComponent || isLoading) return;

    setIsLoading(true);
    setError(null);
    setUseFallback(false);

    try {
      const fallbackLazyLoader = frontendFallbackManager.createFallbackLazyLoader();
      fallbackLazyLoader.register(componentId, loader, options);
      const component = await frontendFallbackManager.loadComponentWithFallback(componentId);
      setLoadedComponent(component.default || component);
    } catch (err) {
      const loadError = err instanceof Error ? err : new Error('Failed to load component');
      setError(loadError);
      
      // Check if we should automatically use fallback
      const hasFallback = frontendFallbackManager.hasFallback('lazy-loading', componentId);
      if (hasFallback && options.immediate) {
        setUseFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const observeElement = (element: HTMLElement) => {
    const fallbackLazyLoader = frontendFallbackManager.createFallbackLazyLoader();
    fallbackLazyLoader.register(componentId, loader, options);
    fallbackLazyLoader.observeElement(componentId, element);
  };

  const retry = () => {
    setError(null);
    setLoadedComponent(null);
    setUseFallback(false);
    loadComponent();
  };

  const handleUseFallback = () => {
    setUseFallback(true);
    setError(null);
  };

  return {
    loadedComponent: useFallback && immediateFallback ? immediateFallback : loadedComponent,
    isLoading,
    error: useFallback ? null : error,
    useFallback,
    loadComponent,
    observeElement,
    retry,
    useFallbackComponent: handleUseFallback,
    hasFallback: frontendFallbackManager.hasFallback('lazy-loading', componentId)
  };
}

/**
 * Higher-order component for lazy loading with fallback support
 */
export function withFallbackLazyLoading<P extends object>(
  componentId: string,
  loader: () => Promise<React.ComponentType<P>>,
  options: LazyLoadOptions = {},
  immediateFallback?: React.ComponentType<P>
) {
  return function FallbackLazyWrappedComponent(props: P) {
    return (
      <FallbackLazyComponent
        componentId={componentId}
        loader={loader}
        options={options}
        componentProps={props}
        immediateFallback={immediateFallback}
      />
    );
  };
}

/**
 * Component to display lazy loading fallback statistics
 */
export const LazyLoadingFallbackStats: React.FC<{ className?: string }> = ({ className }) => {
  const [stats, setStats] = useState(frontendFallbackManager.getFallbackStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(frontendFallbackManager.getFallbackStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (stats.lazyLoadingFallbacks === 0) {
    return null;
  }

  return (
    <div className={`p-2 bg-blue-50 border border-blue-200 rounded text-sm ${className || ''}`}>
      <div className="font-medium text-blue-800 mb-1">Lazy Loading Fallbacks</div>
      <div className="text-blue-700">
        {stats.lazyLoadingFallbacks} components used fallback rendering
      </div>
    </div>
  );
};