import { describe, it, expect, beforeEach, afterAll, vi, Mock } from 'vitest';
import { createLazyRoute, preloadRoute, useRoutePreloader } from '../LazyRoute';
import { codeSplitter } from '../CodeSplitter';
import React from 'react';

// Mock the code splitter
vi.mock('../CodeSplitter', () => ({
  codeSplitter: {
    loadChunk: vi.fn(),
    preloadChunk: vi.fn(),
  }
}));

const mockCodeSplitter = codeSplitter as {
  loadChunk: Mock;
  preloadChunk: Mock;
};

// Mock console methods to avoid test output noise
const consoleSpy = {
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
};

describe('LazyRoute', () => {
  beforeEach(() => {
    mockCodeSplitter.loadChunk.mockClear();
    mockCodeSplitter.preloadChunk.mockClear();
    consoleSpy.error.mockClear();
    consoleSpy.warn.mockClear();
  });

  afterAll(() => {
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('createLazyRoute', () => {
    it('should create a lazy route component', () => {
      const TestComponent = () => React.createElement('div', null, 'Test Component');
      mockCodeSplitter.loadChunk.mockResolvedValue(TestComponent);

      const LazyTestComponent = createLazyRoute('test-chunk');
      
      expect(LazyTestComponent).toBeDefined();
      expect(typeof LazyTestComponent).toBe('function');
      expect(mockCodeSplitter.loadChunk).not.toHaveBeenCalled(); // Should not load until rendered
    });

    it('should set correct display name', () => {
      const LazyTestComponent = createLazyRoute('test-chunk');
      expect(LazyTestComponent.displayName).toBe('LazyRoute(test-chunk)');
    });

    it('should create component with custom fallback', () => {
      const CustomFallback = () => React.createElement('div', null, 'Custom Loading...');
      const LazyTestComponent = createLazyRoute('test-chunk', CustomFallback);
      
      expect(LazyTestComponent).toBeDefined();
      expect(typeof LazyTestComponent).toBe('function');
    });
  });

  describe('preloadRoute', () => {
    it('should call codeSplitter.preloadChunk', async () => {
      mockCodeSplitter.preloadChunk.mockResolvedValue(undefined);
      
      await preloadRoute('test-chunk');
      
      expect(mockCodeSplitter.preloadChunk).toHaveBeenCalledWith('test-chunk');
    });

    it('should return a promise', () => {
      mockCodeSplitter.preloadChunk.mockResolvedValue(undefined);
      
      const result = preloadRoute('test-chunk');
      
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('useRoutePreloader', () => {
    it('should be a function', () => {
      expect(typeof useRoutePreloader).toBe('function');
    });
  });
});