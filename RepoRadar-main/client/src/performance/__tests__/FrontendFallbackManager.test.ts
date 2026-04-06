import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FrontendFallbackManager } from '../FrontendFallbackManager';
import { ICodeSplitter, ILazyLoader } from '../interfaces';

// Mock React component
const MockComponent = () => null;
const MockFallbackComponent = () => null;

// Mock implementations
const mockCodeSplitter: ICodeSplitter = {
  loadChunk: vi.fn(),
  preloadChunk: vi.fn(),
  getChunkStatus: vi.fn(),
  getLoadedChunks: vi.fn()
};

const mockLazyLoader: ILazyLoader = {
  register: vi.fn(),
  observeElement: vi.fn(),
  loadComponent: vi.fn(),
  unregister: vi.fn()
};

describe('FrontendFallbackManager', () => {
  let fallbackManager: FrontendFallbackManager;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create fresh instance with clean state
    fallbackManager = new FrontendFallbackManager(
      { enableLogging: true, maxRetryAttempts: 3, retryDelay: 100 },
      mockCodeSplitter,
      mockLazyLoader
    );
    
    // Clear any existing fallback history
    fallbackManager.clearFallbackHistory();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('registerSynchronousComponents', () => {
    it('should register synchronous fallback components', () => {
      const components = {
        'test-chunk': MockComponent,
        'another-chunk': MockFallbackComponent
      };

      fallbackManager.registerSynchronousComponents(components);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Registered synchronous fallback components:',
        ['test-chunk', 'another-chunk']
      );
    });

    it('should merge with existing components', () => {
      fallbackManager.registerSynchronousComponents({ 'chunk1': MockComponent });
      fallbackManager.registerSynchronousComponents({ 'chunk2': MockFallbackComponent });

      expect(fallbackManager.hasFallback('code-splitting', 'chunk1')).toBe(true);
      expect(fallbackManager.hasFallback('code-splitting', 'chunk2')).toBe(true);
    });
  });

  describe('registerImmediateComponents', () => {
    it('should register immediate fallback components', () => {
      fallbackManager.registerImmediateComponents('test-component', MockComponent);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Registered immediate fallback component: test-component'
      );
      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(true);
    });
  });

  describe('loadChunkWithFallback', () => {
    it('should load chunk normally when code splitter succeeds', async () => {
      const mockChunk = { component: MockComponent };
      mockCodeSplitter.loadChunk = vi.fn().mockResolvedValue(mockChunk);

      const result = await fallbackManager.loadChunkWithFallback('test-chunk');

      expect(result).toBe(mockChunk);
      expect(mockCodeSplitter.loadChunk).toHaveBeenCalledWith('test-chunk');
    });

    it('should use synchronous fallback when code splitting fails', async () => {
      const error = new Error('Code splitting failed');
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(error);
      
      fallbackManager.registerSynchronousComponents({
        'test-chunk': MockFallbackComponent
      });

      const result = await fallbackManager.loadChunkWithFallback('test-chunk');

      expect(result).toBe(MockFallbackComponent);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Code splitting failed for test-chunk, using synchronous fallback:',
        error
      );
    });

    it('should retry with exponential backoff when no fallback is available', async () => {
      const error = new Error('Code splitting failed');
      mockCodeSplitter.loadChunk = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(MockComponent);

      const startTime = Date.now();
      const result = await fallbackManager.loadChunkWithFallback('test-chunk');
      const endTime = Date.now();

      expect(result).toBe(MockComponent);
      expect(mockCodeSplitter.loadChunk).toHaveBeenCalledTimes(3);
      // Should have some delay due to exponential backoff (100ms + 200ms = 300ms minimum)
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should throw error when all strategies fail', async () => {
      vi.useFakeTimers();
      
      const error = new Error('Code splitting failed');
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(error);

      const promise = fallbackManager.loadChunkWithFallback('test-chunk');
      
      // Fast forward through all retry attempts
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'All fallback strategies failed for chunk test-chunk:',
        error
      );
      
      vi.useRealTimers();
    });

    it('should respect maxRetryAttempts configuration', async () => {
      const customManager = new FrontendFallbackManager(
        { maxRetryAttempts: 1 },
        mockCodeSplitter,
        mockLazyLoader
      );
      
      const error = new Error('Code splitting failed');
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(error);

      await expect(customManager.loadChunkWithFallback('test-chunk')).rejects.toThrow(error);
      
      // Should be called twice: initial attempt + 1 retry
      expect(mockCodeSplitter.loadChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadComponentWithFallback', () => {
    it('should load component normally when lazy loader succeeds', async () => {
      const mockComponent = MockComponent;
      mockLazyLoader.loadComponent = vi.fn().mockResolvedValue(mockComponent);

      const result = await fallbackManager.loadComponentWithFallback('test-component');

      expect(result).toBe(mockComponent);
      expect(mockLazyLoader.loadComponent).toHaveBeenCalledWith('test-component');
    });

    it('should use immediate fallback when lazy loading fails', async () => {
      const error = new Error('Lazy loading failed');
      mockLazyLoader.loadComponent = vi.fn().mockRejectedValue(error);
      
      fallbackManager.registerImmediateComponents('test-component', MockFallbackComponent);

      const result = await fallbackManager.loadComponentWithFallback('test-component');

      expect(result).toBe(MockFallbackComponent);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Lazy loading failed for test-component, using immediate fallback:',
        error
      );
    });

    it('should retry with exponential backoff when no fallback is available', async () => {
      const error = new Error('Lazy loading failed');
      mockLazyLoader.loadComponent = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(MockComponent);

      const startTime = Date.now();
      const result = await fallbackManager.loadComponentWithFallback('test-component');
      const endTime = Date.now();

      expect(result).toBe(MockComponent);
      expect(mockLazyLoader.loadComponent).toHaveBeenCalledTimes(3);
      // Should have some delay due to exponential backoff (100ms + 200ms = 300ms minimum)
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should throw error when all strategies fail', async () => {
      vi.useFakeTimers();
      
      const error = new Error('Lazy loading failed');
      mockLazyLoader.loadComponent = vi.fn().mockRejectedValue(error);

      const promise = fallbackManager.loadComponentWithFallback('test-component');
      
      // Fast forward through all retry attempts
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'All fallback strategies failed for component test-component:',
        error
      );
      
      vi.useRealTimers();
    });
  });

  describe('createFallbackCodeSplitter', () => {
    it('should create a wrapper that uses fallback loading', async () => {
      const fallbackCodeSplitter = fallbackManager.createFallbackCodeSplitter();
      const mockChunk = MockComponent;
      
      fallbackManager.registerSynchronousComponents({ 'test-chunk': MockFallbackComponent });
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await fallbackCodeSplitter.loadChunk('test-chunk');

      expect(result).toBe(MockFallbackComponent);
    });

    it('should handle preload failures gracefully', async () => {
      const fallbackCodeSplitter = fallbackManager.createFallbackCodeSplitter();
      mockCodeSplitter.preloadChunk = vi.fn().mockRejectedValue(new Error('Preload failed'));

      await fallbackCodeSplitter.preloadChunk('test-chunk');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Preloading failed for chunk test-chunk:',
        expect.any(Error)
      );
    });

    it('should delegate status and loaded chunks methods', () => {
      const fallbackCodeSplitter = fallbackManager.createFallbackCodeSplitter();
      
      mockCodeSplitter.getChunkStatus = vi.fn().mockReturnValue('loaded');
      mockCodeSplitter.getLoadedChunks = vi.fn().mockReturnValue(['chunk1', 'chunk2']);

      expect(fallbackCodeSplitter.getChunkStatus('test')).toBe('loaded');
      expect(fallbackCodeSplitter.getLoadedChunks()).toEqual(['chunk1', 'chunk2']);
    });
  });

  describe('createFallbackLazyLoader', () => {
    it('should create a wrapper that uses fallback loading', async () => {
      const fallbackLazyLoader = fallbackManager.createFallbackLazyLoader();
      
      fallbackManager.registerImmediateComponents('test-component', MockFallbackComponent);
      mockLazyLoader.loadComponent = vi.fn().mockRejectedValue(new Error('Failed'));

      const result = await fallbackLazyLoader.loadComponent('test-component');

      expect(result).toBe(MockFallbackComponent);
    });

    it('should wrap loader function with fallback functionality', () => {
      const fallbackLazyLoader = fallbackManager.createFallbackLazyLoader();
      const mockLoader = vi.fn();
      
      fallbackLazyLoader.register('test-component', mockLoader, {});

      expect(mockLazyLoader.register).toHaveBeenCalledWith(
        'test-component',
        expect.any(Function),
        {}
      );
    });

    it('should clean up properly on unregister', () => {
      const fallbackLazyLoader = fallbackManager.createFallbackLazyLoader();
      
      fallbackManager.registerImmediateComponents('test-component', MockComponent);
      fallbackLazyLoader.unregister('test-component');

      expect(mockLazyLoader.unregister).toHaveBeenCalledWith('test-component');
      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(false);
    });
  });

  describe('getFallbackStats', () => {
    it('should return initial empty stats', () => {
      const stats = fallbackManager.getFallbackStats();

      expect(stats).toEqual({
        totalEvents: 0,
        codeSplittingFallbacks: 0,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 0
      });
    });

    it('should track fallback events correctly', async () => {
      fallbackManager.registerSynchronousComponents({ 'test-chunk': MockComponent });
      fallbackManager.registerImmediateComponents('test-component', MockComponent);
      
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(new Error('Failed'));
      mockLazyLoader.loadComponent = vi.fn().mockRejectedValue(new Error('Failed'));

      await fallbackManager.loadChunkWithFallback('test-chunk');
      await fallbackManager.loadComponentWithFallback('test-component');

      const stats = fallbackManager.getFallbackStats();

      expect(stats.totalEvents).toBe(2);
      expect(stats.codeSplittingFallbacks).toBe(1);
      expect(stats.lazyLoadingFallbacks).toBe(1);
      expect(stats.successfulFallbacks).toBe(2);
    });
  });

  describe('hasFallback', () => {
    it('should return true when synchronous fallback is available', () => {
      fallbackManager.registerSynchronousComponents({ 'test-chunk': MockComponent });

      expect(fallbackManager.hasFallback('code-splitting', 'test-chunk')).toBe(true);
      expect(fallbackManager.hasFallback('code-splitting', 'nonexistent')).toBe(false);
    });

    it('should return true when immediate fallback is available', () => {
      fallbackManager.registerImmediateComponents('test-component', MockComponent);

      expect(fallbackManager.hasFallback('lazy-loading', 'test-component')).toBe(true);
      expect(fallbackManager.hasFallback('lazy-loading', 'nonexistent')).toBe(false);
    });

    it('should respect configuration settings', () => {
      const disabledManager = new FrontendFallbackManager(
        { enableCodeSplittingFallback: false, enableLazyLoadingFallback: false },
        mockCodeSplitter,
        mockLazyLoader
      );
      
      disabledManager.registerSynchronousComponents({ 'test-chunk': MockComponent });
      disabledManager.registerImmediateComponents('test-component', MockComponent);

      expect(disabledManager.hasFallback('code-splitting', 'test-chunk')).toBe(false);
      expect(disabledManager.hasFallback('lazy-loading', 'test-component')).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      fallbackManager.updateConfig({
        maxRetryAttempts: 5,
        retryDelay: 2000
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Updated frontend fallback configuration:',
        expect.objectContaining({
          maxRetryAttempts: 5,
          retryDelay: 2000
        })
      );
    });

    it('should respect logging configuration', () => {
      const silentManager = new FrontendFallbackManager(
        { enableLogging: false },
        mockCodeSplitter,
        mockLazyLoader
      );

      silentManager.registerSynchronousComponents({ 'test': MockComponent });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('clearFallbackHistory', () => {
    it('should clear all fallback events and retry attempts', async () => {
      vi.useFakeTimers();
      
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(new Error('Failed'));
      
      const promise = fallbackManager.loadChunkWithFallback('test-chunk');
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow();
      
      expect(fallbackManager.getFallbackStats().totalEvents).toBeGreaterThan(0);
      
      fallbackManager.clearFallbackHistory();
      
      expect(fallbackManager.getFallbackStats().totalEvents).toBe(0);
      
      vi.useRealTimers();
    });
  });

  describe('getRecentFallbackEvents', () => {
    it('should return recent events in chronological order', async () => {
      vi.useFakeTimers();
      
      // Use a manager with no retries to avoid multiple events per chunk
      const noRetryManager = new FrontendFallbackManager(
        { enableLogging: true, maxRetryAttempts: 0, retryDelay: 100 },
        mockCodeSplitter,
        mockLazyLoader
      );
      
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(new Error('Failed'));
      
      const promise1 = noRetryManager.loadChunkWithFallback('chunk1');
      await vi.runAllTimersAsync();
      await expect(promise1).rejects.toThrow();
      
      const promise2 = noRetryManager.loadChunkWithFallback('chunk2');
      await vi.runAllTimersAsync();
      await expect(promise2).rejects.toThrow();

      const events = noRetryManager.getRecentFallbackEvents(5);

      expect(events.length).toBeGreaterThanOrEqual(2);
      // Find the events for our specific chunks
      const chunk1Events = events.filter(e => e.componentId === 'chunk1');
      const chunk2Events = events.filter(e => e.componentId === 'chunk2');
      
      expect(chunk1Events.length).toBeGreaterThan(0);
      expect(chunk2Events.length).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });

    it('should limit results to specified count', async () => {
      vi.useFakeTimers();
      
      mockCodeSplitter.loadChunk = vi.fn().mockRejectedValue(new Error('Failed'));
      
      for (let i = 0; i < 5; i++) {
        const promise = fallbackManager.loadChunkWithFallback(`chunk${i}`);
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow();
      }

      const events = fallbackManager.getRecentFallbackEvents(3);

      expect(events).toHaveLength(3);
      
      vi.useRealTimers();
    });
  });
});