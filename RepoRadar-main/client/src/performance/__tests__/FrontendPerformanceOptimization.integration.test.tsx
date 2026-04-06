import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'wouter';
import { CodeSplitter } from '../CodeSplitter';
import { LazyLoader } from '../LazyLoader';
import { BundleOptimizer } from '../BundleOptimizer';
import { FrontendFallbackManager } from '../FrontendFallbackManager';
import { LazyComponent } from '../LazyComponent';
import { LazyRoute } from '../LazyRoute';
import { FallbackLazyComponent } from '../FallbackLazyComponent';
import { FallbackLazyRoute } from '../FallbackLazyRoute';
import React, { Suspense } from 'react';

// Mock components for testing
const TestComponent = () => <div data-testid="test-component">Test Component</div>;
const TestRoute = () => <div data-testid="test-route">Test Route</div>;
const FallbackComponent = () => <div data-testid="fallback">Loading...</div>;

describe('Frontend Performance Optimization Integration Tests', () => {
  let codeSplitter: CodeSplitter;
  let lazyLoader: LazyLoader;
  let bundleOptimizer: BundleOptimizer;
  let fallbackManager: FrontendFallbackManager;

  beforeEach(() => {
    codeSplitter = new CodeSplitter();
    lazyLoader = new LazyLoader();
    bundleOptimizer = new BundleOptimizer();
    fallbackManager = new FrontendFallbackManager();

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    }));

    // Mock performance API
    global.performance = {
      ...global.performance,
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn().mockReturnValue([]),
      getEntriesByName: vi.fn().mockReturnValue([]),
      now: vi.fn().mockReturnValue(Date.now()),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Frontend Performance Workflow', () => {
    it('should handle code splitting with lazy loading', async () => {
      const LazyTestComponent = LazyComponent({
        loader: () => Promise.resolve({ default: TestComponent }),
        fallback: FallbackComponent,
      });

      render(
        <Suspense fallback={<FallbackComponent />}>
          <LazyTestComponent />
        </Suspense>
      );

      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Should load actual component
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      });
    });

    it('should handle route-based code splitting', async () => {
      const LazyTestRoute = LazyRoute({
        loader: () => Promise.resolve({ default: TestRoute }),
        fallback: FallbackComponent,
      });

      render(
        <BrowserRouter>
          <Suspense fallback={<FallbackComponent />}>
            <LazyTestRoute />
          </Suspense>
        </BrowserRouter>
      );

      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Should load actual route
      await waitFor(() => {
        expect(screen.getByTestId('test-route')).toBeInTheDocument();
      });
    });

    it('should implement viewport-based lazy loading', async () => {
      const mockIntersectionObserver = vi.fn();
      const mockObserve = vi.fn();
      const mockUnobserve = vi.fn();

      global.IntersectionObserver = vi.fn().mockImplementation((callback) => {
        mockIntersectionObserver.mockImplementation(callback);
        return {
          observe: mockObserve,
          unobserve: mockUnobserve,
          disconnect: vi.fn(),
        };
      });

      const TestLazyComponent = () => {
        const [isVisible, setIsVisible] = React.useState(false);
        const ref = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
          if (ref.current) {
            lazyLoader.observeElement(ref.current, () => setIsVisible(true));
          }
        }, []);

        return (
          <div ref={ref} data-testid="lazy-container">
            {isVisible ? <TestComponent /> : <div data-testid="placeholder">Placeholder</div>}
          </div>
        );
      };

      render(<TestLazyComponent />);

      expect(screen.getByTestId('placeholder')).toBeInTheDocument();
      expect(mockObserve).toHaveBeenCalled();

      // Simulate intersection
      const callback = mockIntersectionObserver.mock.calls[0][0];
      callback([{ isIntersecting: true, target: screen.getByTestId('lazy-container') }]);

      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      });
    });

    it('should optimize bundle loading with caching', async () => {
      const mockChunk = {
        name: 'test-chunk',
        size: 1024,
        hash: 'abc123',
      };

      bundleOptimizer.trackChunk(mockChunk);
      const chunks = bundleOptimizer.getOptimizedChunks();

      expect(chunks).toContain(mockChunk);
      expect(bundleOptimizer.getCacheStatus('test-chunk')).toBe('cached');
    });
  });

  describe('Graceful Degradation Scenarios', () => {
    it('should handle lazy loading failures gracefully', async () => {
      const FallbackLazyTestComponent = FallbackLazyComponent({
        loader: () => Promise.reject(new Error('Loading failed')),
        fallback: FallbackComponent,
        errorFallback: () => <div data-testid="error-fallback">Error occurred</div>,
      });

      render(
        <Suspense fallback={<FallbackComponent />}>
          <FallbackLazyTestComponent />
        </Suspense>
      );

      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Should show error fallback after failure
      await waitFor(() => {
        expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      });
    });

    it('should handle route loading failures gracefully', async () => {
      const FallbackLazyTestRoute = FallbackLazyRoute({
        loader: () => Promise.reject(new Error('Route loading failed')),
        fallback: FallbackComponent,
        errorFallback: () => <div data-testid="route-error">Route failed to load</div>,
      });

      render(
        <BrowserRouter>
          <Suspense fallback={<FallbackComponent />}>
            <FallbackLazyTestRoute />
          </Suspense>
        </BrowserRouter>
      );

      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Should show error fallback after failure
      await waitFor(() => {
        expect(screen.getByTestId('route-error')).toBeInTheDocument();
      });
    });

    it('should handle code splitting failures with synchronous fallback', async () => {
      const failingLoader = () => Promise.reject(new Error('Code splitting failed'));
      const syncFallback = TestComponent;

      const result = await fallbackManager.handleCodeSplittingFailure(
        failingLoader,
        syncFallback
      );

      expect(result).toBe(TestComponent);
    });

    it('should handle lazy loading failures with immediate rendering', async () => {
      const element = document.createElement('div');
      element.setAttribute('data-testid', 'immediate-render');

      const result = await fallbackManager.handleLazyLoadingFailure(
        () => Promise.reject(new Error('Lazy loading failed')),
        element
      );

      expect(result).toBe(element);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent lazy loads', async () => {
      const components = Array.from({ length: 10 }, (_, i) =>
        LazyComponent({
          loader: () => Promise.resolve({ 
            default: () => <div data-testid={`component-${i}`}>Component {i}</div>
          }),
          fallback: () => <div data-testid={`fallback-${i}`}>Loading {i}...</div>,
        })
      );

      const TestApp = () => (
        <div>
          {components.map((Component, i) => (
            <Suspense key={i} fallback={<div data-testid={`suspense-${i}`}>Suspense {i}</div>}>
              <Component />
            </Suspense>
          ))}
        </div>
      );

      render(<TestApp />);

      // All components should eventually load
      await waitFor(() => {
        for (let i = 0; i < 10; i++) {
          expect(screen.getByTestId(`component-${i}`)).toBeInTheDocument();
        }
      });
    });

    it('should maintain performance metrics during heavy loading', async () => {
      const startTime = performance.now();

      // Simulate heavy component loading
      const heavyComponents = Array.from({ length: 20 }, (_, i) =>
        LazyComponent({
          loader: () => new Promise(resolve => 
            setTimeout(() => resolve({ 
              default: () => <div data-testid={`heavy-${i}`}>Heavy {i}</div>
            }), 50)
          ),
          fallback: () => <div data-testid={`heavy-fallback-${i}`}>Loading heavy {i}...</div>,
        })
      );

      const HeavyApp = () => (
        <div>
          {heavyComponents.map((Component, i) => (
            <Suspense key={i} fallback={<div>Loading...</div>}>
              <Component />
            </Suspense>
          ))}
        </div>
      );

      render(<HeavyApp />);

      await waitFor(() => {
        for (let i = 0; i < 20; i++) {
          expect(screen.getByTestId(`heavy-${i}`)).toBeInTheDocument();
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000);
    });

    it('should handle rapid route changes efficiently', async () => {
      const routes = ['home', 'about', 'contact', 'services'];
      const routeComponents = routes.map(route =>
        LazyRoute({
          loader: () => Promise.resolve({ 
            default: () => <div data-testid={`route-${route}`}>Route {route}</div>
          }),
          fallback: () => <div data-testid={`route-fallback-${route}`}>Loading {route}...</div>,
        })
      );

      const RouterApp = () => {
        const [currentRoute, setCurrentRoute] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCurrentRoute(prev => (prev + 1) % routes.length);
          }, 100);

          return () => clearInterval(interval);
        }, []);

        const CurrentRoute = routeComponents[currentRoute];

        return (
          <BrowserRouter>
            <Suspense fallback={<div>Loading route...</div>}>
              <CurrentRoute />
            </Suspense>
          </BrowserRouter>
        );
      };

      render(<RouterApp />);

      // Should handle rapid route changes without crashing
      await waitFor(() => {
        expect(screen.getByText(/Route/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Bundle Optimization Integration', () => {
    it('should track and optimize chunk loading', async () => {
      const chunks = [
        { name: 'vendor', size: 2048, hash: 'vendor123' },
        { name: 'main', size: 1024, hash: 'main456' },
        { name: 'lazy', size: 512, hash: 'lazy789' },
      ];

      chunks.forEach(chunk => bundleOptimizer.trackChunk(chunk));

      const optimizedChunks = bundleOptimizer.getOptimizedChunks();
      expect(optimizedChunks).toHaveLength(3);

      const totalSize = bundleOptimizer.getTotalBundleSize();
      expect(totalSize).toBe(3584); // 2048 + 1024 + 512
    });

    it('should implement effective caching strategies', async () => {
      const chunkName = 'test-chunk';
      
      bundleOptimizer.setCacheStatus(chunkName, 'loading');
      expect(bundleOptimizer.getCacheStatus(chunkName)).toBe('loading');

      bundleOptimizer.setCacheStatus(chunkName, 'cached');
      expect(bundleOptimizer.getCacheStatus(chunkName)).toBe('cached');

      bundleOptimizer.invalidateCache(chunkName);
      expect(bundleOptimizer.getCacheStatus(chunkName)).toBe('invalid');
    });
  });

  describe('Error Recovery and Monitoring', () => {
    it('should recover from component loading errors', async () => {
      let shouldFail = true;
      
      const RecoveringComponent = FallbackLazyComponent({
        loader: () => {
          if (shouldFail) {
            shouldFail = false;
            return Promise.reject(new Error('First attempt failed'));
          }
          return Promise.resolve({ default: TestComponent });
        },
        fallback: FallbackComponent,
        errorFallback: ({ retry }) => (
          <div>
            <div data-testid="error-with-retry">Error occurred</div>
            <button data-testid="retry-button" onClick={retry}>Retry</button>
          </div>
        ),
      });

      render(
        <Suspense fallback={<FallbackComponent />}>
          <RecoveringComponent />
        </Suspense>
      );

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByTestId('error-with-retry')).toBeInTheDocument();
      });

      // Click retry
      fireEvent.click(screen.getByTestId('retry-button'));

      // Should recover and show component
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      });
    });

    it('should maintain performance monitoring during errors', async () => {
      const performanceSpy = vi.spyOn(performance, 'mark');
      
      const FailingComponent = FallbackLazyComponent({
        loader: () => Promise.reject(new Error('Always fails')),
        fallback: FallbackComponent,
        errorFallback: () => <div data-testid="permanent-error">Permanent error</div>,
      });

      render(
        <Suspense fallback={<FallbackComponent />}>
          <FailingComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('permanent-error')).toBeInTheDocument();
      });

      // Performance monitoring should continue even during errors
      expect(performanceSpy).toHaveBeenCalled();
    });
  });
});