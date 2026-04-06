import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { CodeSplitter } from '../CodeSplitter';

// Mock dynamic imports
const mockImports: Record<string, any> = {
  '../pages/landing': { default: () => 'Landing Component' },
  '../pages/home': { default: () => 'Home Component' },
  '../pages/search': { default: () => 'Search Component' },
};

// Mock import function
const mockImport = vi.fn();

// Mock dynamic import
vi.mock('import', () => ({
  default: mockImport
}));

describe('CodeSplitter', () => {
  let codeSplitter: CodeSplitter;

  beforeEach(() => {
    codeSplitter = new CodeSplitter();
    codeSplitter.clearCache();
    mockImport.mockClear();
    
    // Setup mock import behavior
    mockImport.mockImplementation((path: string) => {
      if (mockImports[path]) {
        return Promise.resolve(mockImports[path]);
      }
      return Promise.reject(new Error(`Module not found: ${path}`));
    });
  });

  describe('loadChunk', () => {
    it('should load a chunk successfully', async () => {
      // Mock the dynamic import for this test
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');

      const result = await codeSplitter.loadChunk('test-chunk');
      
      expect(result).toEqual(expect.any(Function));
      expect(codeSplitter.getChunkStatus('test-chunk')).toBe('loaded');
      expect(codeSplitter.getLoadedChunks()).toContain('test-chunk');

      // Restore original method
      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });

    it('should return cached chunk on subsequent calls', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      const mockPerformChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');
      (codeSplitter as any).performChunkLoad = mockPerformChunkLoad;

      // First call
      const result1 = await codeSplitter.loadChunk('test-chunk');
      
      // Second call
      const result2 = await codeSplitter.loadChunk('test-chunk');
      
      expect(result1).toBe(result2);
      expect(mockPerformChunkLoad).toHaveBeenCalledTimes(1);

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });

    it('should handle loading errors', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockRejectedValue(new Error('Load failed'));

      await expect(codeSplitter.loadChunk('failing-chunk')).rejects.toThrow('Load failed');
      expect(codeSplitter.getChunkStatus('failing-chunk')).toBe('error');

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });

    it('should not duplicate loading for concurrent loads', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      const mockPerformChunkLoad = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(() => 'Test Component'), 100))
      );
      (codeSplitter as any).performChunkLoad = mockPerformChunkLoad;

      // Start two concurrent loads
      const promise1 = codeSplitter.loadChunk('concurrent-chunk');
      const promise2 = codeSplitter.loadChunk('concurrent-chunk');
      
      // Both promises should resolve to the same value
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(result2);
      
      // performChunkLoad should only be called once
      expect(mockPerformChunkLoad).toHaveBeenCalledTimes(1);

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });
  });

  describe('preloadChunk', () => {
    it('should preload a chunk without throwing', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');

      await expect(codeSplitter.preloadChunk('preload-chunk')).resolves.toBeUndefined();
      expect(codeSplitter.getChunkStatus('preload-chunk')).toBe('loaded');

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });

    it('should not throw on preload failure', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockRejectedValue(new Error('Preload failed'));

      // Mock console.warn to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(codeSplitter.preloadChunk('failing-preload')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to preload chunk failing-preload'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });

    it('should not preload already cached chunks', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      const mockPerformChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');
      (codeSplitter as any).performChunkLoad = mockPerformChunkLoad;

      // Load chunk first
      await codeSplitter.loadChunk('cached-chunk');
      
      // Preload should not call performChunkLoad again
      await codeSplitter.preloadChunk('cached-chunk');
      
      expect(mockPerformChunkLoad).toHaveBeenCalledTimes(1);

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });
  });

  describe('getChunkStatus', () => {
    it('should return idle for unknown chunks', () => {
      expect(codeSplitter.getChunkStatus('unknown-chunk')).toBe('idle');
    });

    it('should return loading during chunk load', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      let resolveLoad: (value: any) => void;
      const loadPromise = new Promise(resolve => { resolveLoad = resolve; });
      (codeSplitter as any).performChunkLoad = vi.fn().mockReturnValue(loadPromise);

      // Start loading
      const chunkPromise = codeSplitter.loadChunk('loading-chunk');
      
      // Check status during loading
      expect(codeSplitter.getChunkStatus('loading-chunk')).toBe('loading');
      
      // Complete loading
      resolveLoad!(() => 'Test Component');
      await chunkPromise;
      
      expect(codeSplitter.getChunkStatus('loading-chunk')).toBe('loaded');

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });
  });

  describe('getLoadedChunks', () => {
    it('should return empty array initially', () => {
      expect(codeSplitter.getLoadedChunks()).toEqual([]);
    });

    it('should return loaded chunk names', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');

      await codeSplitter.loadChunk('chunk1');
      await codeSplitter.loadChunk('chunk2');
      
      const loadedChunks = codeSplitter.getLoadedChunks();
      expect(loadedChunks).toContain('chunk1');
      expect(loadedChunks).toContain('chunk2');
      expect(loadedChunks).toHaveLength(2);

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      const originalPerformChunkLoad = (codeSplitter as any).performChunkLoad;
      (codeSplitter as any).performChunkLoad = vi.fn().mockResolvedValue(() => 'Test Component');

      // Load a chunk
      await codeSplitter.loadChunk('test-chunk');
      expect(codeSplitter.getLoadedChunks()).toHaveLength(1);
      expect(codeSplitter.getChunkStatus('test-chunk')).toBe('loaded');
      
      // Clear cache
      codeSplitter.clearCache();
      
      expect(codeSplitter.getLoadedChunks()).toHaveLength(0);
      expect(codeSplitter.getChunkStatus('test-chunk')).toBe('idle');

      (codeSplitter as any).performChunkLoad = originalPerformChunkLoad;
    });
  });

  describe('performChunkLoad', () => {
    it('should handle known chunk names', async () => {
      const result = await (codeSplitter as any).performChunkLoad('landing');
      expect(result).toEqual(expect.any(Function));
    });

    it('should throw error for unknown chunk names', async () => {
      await expect((codeSplitter as any).performChunkLoad('unknown-chunk'))
        .rejects.toThrow('Unknown chunk: unknown-chunk');
    });
  });
});