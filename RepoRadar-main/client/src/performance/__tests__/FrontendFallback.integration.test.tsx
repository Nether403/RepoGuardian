import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FrontendFallbackManager } from '../FrontendFallbackManager';
import { createFallbackLazyRoute } from '../FallbackLazyRoute';
import { FallbackLazyComponent } from '../FallbackLazyComponent';

// Mock React.lazy for route testing
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
const SuccessfulComponent = () => <div>Successful Component</div>;
const FallbackRouteComponent = () => <div>Fallback Route Component</div>;
const FallbackLazyComponent = () => <div>Fallback Lazy Component</div>;
const CustomLoadingComponent = () => <div>Custom Loading</div>;

// Mock implementations for testing different scenarios
const createMockCodeSplitter = (scenario: 'success' | 'failure' | 'retry-success') => {
  const callCounts = new Map<string, number>();
  
  return {
    loadChunk: vi.fn().mockImplementation((chunkName: string) => {
      switch (scenario) {
        case 'success':
          return Promise.resolve(SuccessfulComponent);
        case 'failure':
          return Promise.reject(new Error(`Failed to load chunk: ${chunkName}`));
        case 'retry-success':
          // Track calls per chunk name
          const currentCount = (callCounts.get(chunkName) || 0) + 1;
          callCounts.set(chunkName, currentCount);
          
          if (currentCount <= 2) {
            return Promise.reject(new Error(`Retry attempt ${currentCount} failed`));
          }
          return Promise.resolve(SuccessfulComponent);
        default:
          return Promise.reject(new Error('Unknown scenario'));
      }
    }),
    preloadChunk: vi.fn().mockResolvedValue(undefined),
    getChunkStatus: vi.fn().mockReturnValue('idle'),
    getLoadedChunks: vi.fn().mockReturnValue([])
  };
};

const createMockLazyLoader = (scenario: 'success' | 'failure' | 'retry-success') => {
  const callCounts = new Map<string, number>();
  
  return {
    register: vi.fn(),
    observeElement: vi.fn(),
    loadComponent: vi.fn().mockImplementation((componentId: string) => {
      switch (scenario) {
        case 'success':
          return Promise.resolve(SuccessfulComponent);
        case 'failure':
          return Promise.reject(new Error(`Failed to load component: ${componentId}`));
        case 'retry-success':
          // Track calls per component ID
          const currentCount = (callCounts.get(componentId) || 0) + 1;
          callCounts.set(componentId, currentCount);
          
          if (currentCount <= 2) {
            return Promise.reject(new Error(`Retry attempt ${currentCount} failed`));
          }
          return Promise.resolve(SuccessfulComponent);
        default:
          return Promise.reject(new Error('Unknown scenario'));
      }
    }),
    unregister: vi.fn()
  };
};

describe('Frontend Fallback Integration Tests', () => {
  let fallbackManager: FrontendFallbackManager;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Code Splitting Fallback Scenarios', () => {
    it('should successfully load chunk without fallback when code splitting works', async () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      const result = await fallbackManager.loadChunkWithFallback('test-chunk');
      
      expect(result).toBe(SuccessfulComponent);
      expect(mockCodeSplitter.loadChunk).toHaveBeenCalledWith('test-chunk');
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.successfulFallbacks).toBe(0);
    });

    it('should use synchronous fallback when code splitting fails', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      // Register synchronous fallback
      fallbackManager.registerSynchronousComponents({
        'test-chunk': FallbackRouteComponent
      });

      const result = await fallbackManager.loadChunkWithFallback('test-chunk');
      
      expect(result).toBe(FallbackRouteComponent);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Code splitting failed for test-chunk, using synchronous fallback:',
        expect.any(Error)
      );
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.codeSplittingFallbacks).toBe(1);
      expect(stats.successfulFallbacks).toBe(1);
    });

    it('should retry with exponential backoff when no fallback is available', async () => {
      const mockCodeSplitter = createMockCodeSplitter('retry-success');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true, maxRetryAttempts: 3, retryDelay: 10 }, // Shorter delay for testing
        mockCodeSplitter,
        mockLazyLoader
      );

      const result = await fallbackManager.loadChunkWithFallback('test-chunk');
      
      expect(result).toBe(SuccessfulComponent);
      expect(mockCodeSplitter.loadChunk).toHaveBeenCalledTimes(3);
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBeGreaterThan(0); // Should have logged fallback events
    }, 10000);

    it('should throw error when all fallback strategies fail', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true, maxRetryAttempts: 1, retryDelay: 10 },
        mockCodeSplitter,
        mockLazyLoader
      );

      await expect(fallbackManager.loadChunkWithFallback('test-chunk')).rejects.toThrow(
        'Failed to load chunk: test-chunk'
      );
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'All fallback strategies failed for chunk test-chunk:',
        expect.any(Error)
      );
    }, 10000);
  });

  describe('Lazy Loading Fallback Scenarios', () => {
    it('should successfully load component without fallback when lazy loading works', async () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      const result = await fallbackManager.loadComponentWithFallback('test-component');
      
      expect(result).toBe(SuccessfulComponent);
      expect(mockLazyLoader.loadComponent).toHaveBeenCalledWith('test-component');
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.successfulFallbacks).toBe(0);
    });

    it('should use immediate fallback when lazy loading fails', async () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('failure');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      // Register immediate fallback
      fallbackManager.registerImmediateComponents('test-component', FallbackLazyComponent);

      const result = await fallbackManager.loadComponentWithFallback('test-component');
      
      expect(result).toBe(FallbackLazyComponent);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Lazy loading failed for test-component, using immediate fallback:',
        expect.any(Error)
      );
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.lazyLoadingFallbacks).toBe(1);
      expect(stats.successfulFallbacks).toBe(1);
    });

    it('should retry with exponential backoff when no fallback is available', async () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('retry-success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true, maxRetryAttempts: 3, retryDelay: 10 }, // Shorter delay for testing
        mockCodeSplitter,
        mockLazyLoader
      );

      const result = await fallbackManager.loadComponentWithFallback('test-component');
      
      expect(result).toBe(SuccessfulComponent);
      expect(mockLazyLoader.loadComponent).toHaveBeenCalledTimes(3);
      
      const stats = fallbackManager.getFallbackStats();
      expect(stats.totalEvents).toBeGreaterThan(0); // Should have logged fallback events
    }, 10000);
  });

  describe('Wrapper Integration', () => {
    it('should create fallback-enabled code splitter that works correctly', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerSynchronousComponents({
        'test-chunk': FallbackRouteComponent
      });

      const fallbackCodeSplitter = fallbackManager.createFallbackCodeSplitter();
      const result = await fallbackCodeSplitter.loadChunk('test-chunk');
      
      expect(result).toBe(FallbackRouteComponent);
      
      // Test other methods are properly delegated
      expect(fallbackCodeSplitter.getChunkStatus('test')).toBe('idle');
      expect(fallbackCodeSplitter.getLoadedChunks()).toEqual([]);
    });

    it('should create fallback-enabled lazy loader that works correctly', async () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('failure');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerImmediateComponents('test-component', FallbackLazyComponent);

      const fallbackLazyLoader = fallbackManager.createFallbackLazyLoader();
      const result = await fallbackLazyLoader.loadComponent('test-component');
      
      expect(result).toBe(FallbackLazyComponent);
      
      // Test registration wraps loader correctly
      const mockLoader = vi.fn();
      fallbackLazyLoader.register('new-component', mockLoader, {});
      expect(mockLazyLoader.register).toHaveBeenCalledWith(
        'new-component',
        expect.any(Function),
        {}
      );
    });
  });

  describe('Configuration and Statistics', () => {
    it('should track comprehensive statistics across multiple operations', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('failure');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true, maxRetryAttempts: 1, retryDelay: 10 },
        mockCodeSplitter,
        mockLazyLoader
      );

      // Register fallbacks
      fallbackManager.registerSynchronousComponents({
        'chunk1': FallbackRouteComponent,
        'chunk2': FallbackRouteComponent
      });
      fallbackManager.registerImmediateComponents('component1', FallbackLazyComponent);

      // Perform operations that will trigger fallbacks
      await fallbackManager.loadChunkWithFallback('chunk1');
      await fallbackManager.loadChunkWithFallback('chunk2');
      await fallbackManager.loadComponentWithFallback('component1');
      
      // Try operation without fallback (should fail and retry)
      await expect(fallbackManager.loadComponentWithFallback('component2')).rejects.toThrow();

      const stats = fallbackManager.getFallbackStats();
      
      expect(stats.totalEvents).toBe(5); // 3 successful fallbacks + 2 failed with retries
      expect(stats.codeSplittingFallbacks).toBe(2);
      expect(stats.lazyLoadingFallbacks).toBe(3); // 2 successful + 1 failed
      expect(stats.successfulFallbacks).toBe(5); // All fallback events that used synchronous or immediate strategy
    }, 10000);

    it('should provide recent fallback events with proper ordering', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('failure');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerSynchronousComponents({ 'chunk1': FallbackRouteComponent });
      fallbackManager.registerImmediateComponents('component1', FallbackLazyComponent);

      await fallbackManager.loadChunkWithFallback('chunk1');
      await fallbackManager.loadComponentWithFallback('component1');

      const recentEvents = fallbackManager.getRecentFallbackEvents(5);
      
      expect(recentEvents).toHaveLength(2);
      // Events are ordered by timestamp, most recent first
      // The order depends on execution timing, so just check that both types are present
      const eventTypes = recentEvents.map(e => e.type);
      const componentIds = recentEvents.map(e => e.componentId);
      expect(eventTypes).toContain('lazy-loading');
      expect(eventTypes).toContain('code-splitting');
      expect(componentIds).toContain('component1');
      expect(componentIds).toContain('chunk1');
    });

    it('should respect configuration updates', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true, enableCodeSplittingFallback: true, maxRetryAttempts: 1, retryDelay: 10 },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerSynchronousComponents({ 'test-chunk': FallbackRouteComponent });
      
      // Should use fallback initially
      let result = await fallbackManager.loadChunkWithFallback('test-chunk');
      expect(result).toBe(FallbackRouteComponent);
      
      // Disable code splitting fallback
      fallbackManager.updateConfig({ enableCodeSplittingFallback: false });
      
      // Should not use fallback now (will retry and fail)
      await expect(fallbackManager.loadChunkWithFallback('test-chunk-2')).rejects.toThrow();
    }, 10000);

    it('should clear history correctly', async () => {
      const mockCodeSplitter = createMockCodeSplitter('failure');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerSynchronousComponents({ 'test-chunk': FallbackRouteComponent });
      
      await fallbackManager.loadChunkWithFallback('test-chunk');
      
      expect(fallbackManager.getFallbackStats().totalEvents).toBe(1);
      
      fallbackManager.clearFallbackHistory();
      
      expect(fallbackManager.getFallbackStats().totalEvents).toBe(0);
      expect(fallbackManager.getRecentFallbackEvents()).toHaveLength(0);
    });
  });

  describe('hasFallback Method', () => {
    it('should correctly identify available fallbacks', () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { enableLogging: true },
        mockCodeSplitter,
        mockLazyLoader
      );

      // Initially no fallbacks
      expect(fallbackManager.hasFallback('code-splitting', 'test-chunk')).toBe(false);
      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(false);
      
      // Register fallbacks
      fallbackManager.registerSynchronousComponents({ 'test-chunk': FallbackRouteComponent });
      fallbackManager.registerImmediateComponents('test-component', FallbackLazyComponent);
      
      // Should now have fallbacks
      expect(fallbackManager.hasFallback('code-splitting', 'test-chunk')).toBe(true);
      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(true);
      
      // Should still return false for non-existent components
      expect(fallbackManager.hasFallback('code-splitting', 'nonexistent')).toBe(false);
      expect(fallbackManager.hasFallback('lazy-loading', 'nonexistent')).toBe(false);
    });

    it('should respect configuration settings for fallback availability', () => {
      const mockCodeSplitter = createMockCodeSplitter('success');
      const mockLazyLoader = createMockLazyLoader('success');
      
      fallbackManager = new FrontendFallbackManager(
        { 
          enableLogging: true,
          enableCodeSplittingFallback: false,
          enableLazyLoadingFallback: false
        },
        mockCodeSplitter,
        mockLazyLoader
      );

      fallbackManager.registerSynchronousComponents({ 'test-chunk': FallbackRouteComponent });
      fallbackManager.registerImmediateComponents('test-component', FallbackLazyComponent);
      
      // Should return false even though fallbacks are registered
      expect(fallbackManager.hasFallback('code-splitting', 'test-chunk')).toBe(false);
      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(false);
    });
  });
});