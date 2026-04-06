import { describe, it, expect, beforeEach, afterAll, vi, Mock } from 'vitest';
import { LazyLoader } from '../LazyLoader';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

mockIntersectionObserver.mockImplementation((callback) => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  callback
}));

// @ts-ignore
global.IntersectionObserver = mockIntersectionObserver;

// Mock console methods
const consoleSpy = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('LazyLoader', () => {
  let lazyLoader: LazyLoader;

  beforeEach(() => {
    lazyLoader = new LazyLoader();
    mockIntersectionObserver.mockClear();
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  afterAll(() => {
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('register', () => {
    it('should register a component for lazy loading', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      
      lazyLoader.register('test-component', loader);
      
      expect(lazyLoader.getRegisteredComponents()).toContain('test-component');
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('idle');
    });

    it('should load component immediately when immediate option is true', async () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      
      lazyLoader.register('test-component', loader, { immediate: true });
      
      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(loader).toHaveBeenCalled();
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('loaded');
    });

    it('should use default options when none provided', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      
      lazyLoader.register('test-component', loader);
      
      expect(lazyLoader.getRegisteredComponents()).toContain('test-component');
    });
  });

  describe('observeElement', () => {
    it('should create intersection observer for element', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      const element = document.createElement('div');
      
      lazyLoader.register('test-component', loader);
      lazyLoader.observeElement('test-component', element);
      
      expect(mockIntersectionObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalledWith(element);
    });

    it('should warn when observing unregistered component', () => {
      const element = document.createElement('div');
      
      lazyLoader.observeElement('unregistered-component', element);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Component unregistered-component not registered for lazy loading'
      );
    });

    it('should disconnect existing observer when observing same component again', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');
      
      lazyLoader.register('test-component', loader);
      lazyLoader.observeElement('test-component', element1);
      lazyLoader.observeElement('test-component', element2);
      
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('loadComponent', () => {
    it('should load component successfully', async () => {
      const testComponent = 'TestComponent';
      const loader = vi.fn().mockResolvedValue(testComponent);
      
      lazyLoader.register('test-component', loader);
      const result = await lazyLoader.loadComponent('test-component');
      
      expect(result).toBe(testComponent);
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('loaded');
      expect(lazyLoader.getLoadedComponents()).toContain('test-component');
    });

    it('should return cached component on subsequent calls', async () => {
      const testComponent = 'TestComponent';
      const loader = vi.fn().mockResolvedValue(testComponent);
      
      lazyLoader.register('test-component', loader);
      
      const result1 = await lazyLoader.loadComponent('test-component');
      const result2 = await lazyLoader.loadComponent('test-component');
      
      expect(result1).toBe(result2);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should handle loading errors', async () => {
      const error = new Error('Load failed');
      const loader = vi.fn().mockRejectedValue(error);
      
      lazyLoader.register('test-component', loader);
      
      await expect(lazyLoader.loadComponent('test-component')).rejects.toThrow('Load failed');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to load component test-component:',
        error
      );
    });

    it('should throw error for unregistered component', async () => {
      await expect(lazyLoader.loadComponent('unregistered')).rejects.toThrow(
        'Component unregistered not registered'
      );
    });

    it('should return same promise for concurrent loads', async () => {
      const loader = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('TestComponent'), 100))
      );
      
      lazyLoader.register('test-component', loader);
      
      const promise1 = lazyLoader.loadComponent('test-component');
      const promise2 = lazyLoader.loadComponent('test-component');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(result2);
      expect(loader).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregister', () => {
    it('should unregister component and clean up resources', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      const element = document.createElement('div');
      
      lazyLoader.register('test-component', loader);
      lazyLoader.observeElement('test-component', element);
      
      lazyLoader.unregister('test-component');
      
      expect(lazyLoader.getRegisteredComponents()).not.toContain('test-component');
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('getLoadingStatus', () => {
    it('should return correct status for different states', async () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      
      // Idle state
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('error');
      
      // Registered state
      lazyLoader.register('test-component', loader);
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('idle');
      
      // Loading state
      const loadPromise = lazyLoader.loadComponent('test-component');
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('loading');
      
      // Loaded state
      await loadPromise;
      expect(lazyLoader.getLoadingStatus('test-component')).toBe('loaded');
    });
  });

  describe('getRegisteredComponents', () => {
    it('should return array of registered component IDs', () => {
      const loader1 = vi.fn().mockResolvedValue('Component1');
      const loader2 = vi.fn().mockResolvedValue('Component2');
      
      lazyLoader.register('component-1', loader1);
      lazyLoader.register('component-2', loader2);
      
      const registered = lazyLoader.getRegisteredComponents();
      expect(registered).toContain('component-1');
      expect(registered).toContain('component-2');
      expect(registered).toHaveLength(2);
    });
  });

  describe('getLoadedComponents', () => {
    it('should return array of loaded component IDs', async () => {
      const loader1 = vi.fn().mockResolvedValue('Component1');
      const loader2 = vi.fn().mockResolvedValue('Component2');
      
      lazyLoader.register('component-1', loader1);
      lazyLoader.register('component-2', loader2);
      
      await lazyLoader.loadComponent('component-1');
      
      const loaded = lazyLoader.getLoadedComponents();
      expect(loaded).toContain('component-1');
      expect(loaded).not.toContain('component-2');
      expect(loaded).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all components and observers', () => {
      const loader = vi.fn().mockResolvedValue('TestComponent');
      const element = document.createElement('div');
      
      lazyLoader.register('test-component', loader);
      lazyLoader.observeElement('test-component', element);
      
      lazyLoader.clear();
      
      expect(lazyLoader.getRegisteredComponents()).toHaveLength(0);
      expect(lazyLoader.getLoadedComponents()).toHaveLength(0);
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});