import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { 
  createFallbackLazyRoute, 
  preloadRouteWithFallback,
  useFallbackRoutePreloader,
  useRouteFallbackStats,
  FallbackStatsDisplay
} from '../FallbackLazyRoute';
import { frontendFallbackManager } from '../FrontendFallbackManager';

// Mock the fallback manager
vi.mock('../FrontendFallbackManager', () => ({
  frontendFallbackManager: {
    registerSynchronousComponents: vi.fn(),
    loadChunkWithFallback: vi.fn(),
    createFallbackCodeSplitter: vi.fn(),
    hasFallback: vi.fn(),
    getFallbackStats: vi.fn()
  }
}));

// Mock React.lazy
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    lazy: vi.fn((factory) => {
      const LazyComponent = (props: any) => {
        const [Component, setComponent] = React.useState(null);
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          factory()
            .then((module: any) => setComponent(() => module.default))
            .catch(setError);
        }, []);

        if (error) throw error;
        if (!Component) return React.createElement('div', null, 'Loading...');
        return React.createElement(Component, props);
      };
      return LazyComponent;
    })
  };
});

// Test components
const TestComponent = () => <div>Test Component</div>;
const FallbackComponent = () => <div>Fallback Component</div>;
const LoadingComponent = () => <div>Custom Loading</div>;

describe('FallbackLazyRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (frontendFallbackManager.registerSynchronousComponents as any).mockImplementation(() => {});
    (frontendFallbackManager.loadChunkWithFallback as any).mockResolvedValue(TestComponent);
    (frontendFallbackManager.createFallbackCodeSplitter as any).mockReturnValue({
      preloadChunk: vi.fn().mockResolvedValue(undefined)
    });
    (frontendFallbackManager.hasFallback as any).mockReturnValue(false);
    (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
      totalEvents: 0,
      codeSplittingFallbacks: 0,
      lazyLoadingFallbacks: 0,
      retryAttempts: 0,
      successfulFallbacks: 0
    });
  });

  describe('createFallbackLazyRoute', () => {
    it('should create a lazy route component that loads successfully', async () => {
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      render(<LazyRoute />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Component')).toBeInTheDocument();
      });
      
      expect(frontendFallbackManager.loadChunkWithFallback).toHaveBeenCalledWith('test-chunk');
    });

    it('should register synchronous fallback when provided', () => {
      createFallbackLazyRoute('test-chunk', LoadingComponent, FallbackComponent);
      
      expect(frontendFallbackManager.registerSynchronousComponents).toHaveBeenCalledWith({
        'test-chunk': FallbackComponent
      });
    });

    it('should show custom loading component while loading', () => {
      const LazyRoute = createFallbackLazyRoute('test-chunk', LoadingComponent);
      
      render(<LazyRoute />);
      
      expect(screen.getByText('Custom Loading')).toBeInTheDocument();
    });

    it('should show default loading component when no custom fallback provided', () => {
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      render(<LazyRoute />);
      
      // Should show the default loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should handle loading failures gracefully', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadChunkWithFallback as any).mockRejectedValue(error);
      
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      render(<LazyRoute />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load page')).toBeInTheDocument();
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
      });
    });

    it('should provide reload functionality on error', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadChunkWithFallback as any).mockRejectedValue(error);
      
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true
      });
      
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      render(<LazyRoute />);
      
      await waitFor(() => {
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Reload Page'));
      expect(reloadMock).toHaveBeenCalled();
    });

    it('should set correct display name', () => {
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      expect(LazyRoute.displayName).toBe('FallbackLazyRoute(test-chunk)');
    });
  });

  describe('preloadRouteWithFallback', () => {
    it('should use fallback code splitter for preloading', async () => {
      const mockPreloadChunk = vi.fn().mockResolvedValue(undefined);
      (frontendFallbackManager.createFallbackCodeSplitter as any).mockReturnValue({
        preloadChunk: mockPreloadChunk
      });
      
      await preloadRouteWithFallback('test-chunk');
      
      expect(frontendFallbackManager.createFallbackCodeSplitter).toHaveBeenCalled();
      expect(mockPreloadChunk).toHaveBeenCalledWith('test-chunk');
    });
  });

  describe('useFallbackRoutePreloader', () => {
    it('should return preload handlers for hover and focus events', () => {
      const TestComponent = () => {
        const { preloadOnHover } = useFallbackRoutePreloader();
        const handlers = preloadOnHover('test-chunk');
        
        return (
          <div {...handlers}>
            Test Element
          </div>
        );
      };
      
      const mockPreloadChunk = vi.fn().mockResolvedValue(undefined);
      (frontendFallbackManager.createFallbackCodeSplitter as any).mockReturnValue({
        preloadChunk: mockPreloadChunk
      });
      
      render(<TestComponent />);
      
      const element = screen.getByText('Test Element');
      
      fireEvent.mouseEnter(element);
      expect(mockPreloadChunk).toHaveBeenCalledWith('test-chunk');
      
      fireEvent.focus(element);
      expect(mockPreloadChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe('useRouteFallbackStats', () => {
    it('should return current fallback statistics', () => {
      const mockStats = {
        totalEvents: 5,
        codeSplittingFallbacks: 2,
        lazyLoadingFallbacks: 1,
        retryAttempts: 2,
        successfulFallbacks: 3
      };
      
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue(mockStats);
      
      const TestComponent = () => {
        const stats = useRouteFallbackStats();
        return <div>{JSON.stringify(stats)}</div>;
      };
      
      render(<TestComponent />);
      
      expect(screen.getByText(JSON.stringify(mockStats))).toBeInTheDocument();
    });

    it('should update stats periodically', async () => {
      vi.useFakeTimers();
      
      let callCount = 0;
      (frontendFallbackManager.getFallbackStats as any).mockImplementation(() => ({
        totalEvents: callCount++,
        codeSplittingFallbacks: 0,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 0
      }));
      
      const TestComponent = () => {
        const stats = useRouteFallbackStats();
        return <div>Events: {stats.totalEvents}</div>;
      };
      
      render(<TestComponent />);
      
      expect(screen.getByText('Events: 0')).toBeInTheDocument();
      
      // Fast forward 5 seconds
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.getByText('Events: 1')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('FallbackStatsDisplay', () => {
    it('should not render when no fallback events occurred', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 0,
        codeSplittingFallbacks: 0,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 0
      });
      
      const { container } = render(<FallbackStatsDisplay />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should render fallback statistics when events occurred', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 5,
        codeSplittingFallbacks: 2,
        lazyLoadingFallbacks: 1,
        retryAttempts: 2,
        successfulFallbacks: 3
      });
      
      render(<FallbackStatsDisplay />);
      
      expect(screen.getByText('Fallback Statistics')).toBeInTheDocument();
      expect(screen.getByText('Total fallback events: 5')).toBeInTheDocument();
      expect(screen.getByText('Code splitting fallbacks: 2')).toBeInTheDocument();
      expect(screen.getByText('Lazy loading fallbacks: 1')).toBeInTheDocument();
      expect(screen.getByText('Successful fallbacks: 3')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 1,
        codeSplittingFallbacks: 1,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 1
      });
      
      render(<FallbackStatsDisplay className="custom-class" />);
      
      const statsElement = screen.getByText('Fallback Statistics').closest('div');
      expect(statsElement).toHaveClass('custom-class');
    });

    it('should update stats periodically', async () => {
      vi.useFakeTimers();
      
      let eventCount = 1;
      (frontendFallbackManager.getFallbackStats as any).mockImplementation(() => ({
        totalEvents: eventCount++,
        codeSplittingFallbacks: 1,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 1
      }));
      
      render(<FallbackStatsDisplay />);
      
      expect(screen.getByText('Total fallback events: 1')).toBeInTheDocument();
      
      // Fast forward 5 seconds
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.getByText('Total fallback events: 2')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should show fallback component when available and error occurs', async () => {
      (frontendFallbackManager.hasFallback as any).mockReturnValue(true);
      
      // Create a component that throws an error
      const ErrorComponent = () => {
        throw new Error('Component error');
      };
      
      const LazyRoute = createFallbackLazyRoute('test-chunk', LoadingComponent, FallbackComponent);
      
      // Mock the chunk loading to return the error component
      (frontendFallbackManager.loadChunkWithFallback as any).mockResolvedValue(ErrorComponent);
      
      render(<LazyRoute />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load component')).toBeInTheDocument();
        expect(screen.getByText('Use Fallback')).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadChunkWithFallback as any)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(TestComponent);
      
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true
      });
      
      const LazyRoute = createFallbackLazyRoute('test-chunk');
      
      render(<LazyRoute />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Retry'));
      expect(reloadMock).toHaveBeenCalled();
    });
  });
});