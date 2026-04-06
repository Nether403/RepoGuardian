import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { BundleOptimizer } from '../BundleOptimizer';

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
};

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// @ts-ignore
global.localStorage = mockLocalStorage;

// Mock window.performance
const mockPerformance = {
  getEntriesByType: vi.fn(),
};

// @ts-ignore
global.window = {
  performance: mockPerformance,
};

// Mock document
const mockDocument = {
  querySelectorAll: vi.fn(),
};

// @ts-ignore
global.document = mockDocument;

describe('BundleOptimizer', () => {
  let bundleOptimizer: BundleOptimizer;

  beforeEach(() => {
    bundleOptimizer = new BundleOptimizer();
    bundleOptimizer.clearCache();
    
    // Clear all mocks
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
    Object.values(mockLocalStorage).forEach(mock => mock.mockClear());
    mockPerformance.getEntriesByType.mockClear();
    mockDocument.querySelectorAll.mockClear();
  });

  afterAll(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('analyzeBundles', () => {
    it('should return bundle analysis', async () => {
      const analysis = await bundleOptimizer.analyzeBundles();
      
      expect(analysis).toHaveProperty('totalSize');
      expect(analysis).toHaveProperty('chunks');
      expect(analysis).toHaveProperty('unusedCode');
      expect(analysis).toHaveProperty('dependencies');
      expect(typeof analysis.totalSize).toBe('number');
      expect(Array.isArray(analysis.chunks)).toBe(true);
      expect(Array.isArray(analysis.unusedCode)).toBe(true);
      expect(Array.isArray(analysis.dependencies)).toBe(true);
    });

    it('should cache analysis results', async () => {
      const analysis1 = await bundleOptimizer.analyzeBundles();
      const analysis2 = await bundleOptimizer.analyzeBundles();
      
      expect(analysis1).toStrictEqual(analysis2); // Should have the same content
    });

    it('should handle analysis errors gracefully', async () => {
      // Mock an error in the analysis process
      const originalMethod = (bundleOptimizer as any).performBundleAnalysis;
      (bundleOptimizer as any).performBundleAnalysis = vi.fn().mockRejectedValue(new Error('Analysis failed'));
      
      const analysis = await bundleOptimizer.analyzeBundles();
      
      expect(analysis).toBeDefined();
      expect(analysis.totalSize).toBeGreaterThan(0);
      expect(consoleSpy.error).toHaveBeenCalledWith('Failed to analyze bundles:', expect.any(Error));
      
      // Restore original method
      (bundleOptimizer as any).performBundleAnalysis = originalMethod;
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should return array of recommendations', () => {
      const recommendations = bundleOptimizer.getOptimizationRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('estimatedSavings');
        expect(rec).toHaveProperty('priority');
        expect(['tree-shaking', 'code-splitting', 'lazy-loading', 'caching']).toContain(rec.type);
        expect(['high', 'medium', 'low']).toContain(rec.priority);
        expect(typeof rec.estimatedSavings).toBe('number');
      });
    });

    it('should include all optimization types', () => {
      const recommendations = bundleOptimizer.getOptimizationRecommendations();
      const types = recommendations.map(rec => rec.type);
      
      expect(types).toContain('tree-shaking');
      expect(types).toContain('code-splitting');
      expect(types).toContain('lazy-loading');
      expect(types).toContain('caching');
    });
  });

  describe('applyTreeShaking', () => {
    it('should apply tree shaking configuration', () => {
      const config = {
        aggressive: true,
        exclude: ['lodash'],
        sideEffects: false
      };
      
      bundleOptimizer.applyTreeShaking(config);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Applying tree shaking configuration:', config);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bundleOptimizer.treeShaking',
        JSON.stringify(config)
      );
    });

    it('should handle empty configuration', () => {
      const config = {};
      
      bundleOptimizer.applyTreeShaking(config);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Applying tree shaking configuration:', config);
    });
  });

  describe('configureCaching', () => {
    it('should configure caching settings', () => {
      const config = {
        staticAssetsCacheDuration: 31536000, // 1 year
        jsBundlesCacheDuration: 86400, // 1 day
        cssCacheDuration: 86400, // 1 day
        serviceWorkerEnabled: true
      };
      
      bundleOptimizer.configureCaching(config);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Configuring asset caching:', config);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bundleOptimizer.caching',
        JSON.stringify(config)
      );
    });

    it('should handle partial configuration', () => {
      const config = {
        serviceWorkerEnabled: false
      };
      
      bundleOptimizer.configureCaching(config);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('Configuring asset caching:', config);
    });
  });

  describe('getCurrentBundleSize', () => {
    it('should return bundle size from performance API', async () => {
      const mockEntry = { transferSize: 500000 };
      mockPerformance.getEntriesByType.mockReturnValue([mockEntry]);
      
      const size = await bundleOptimizer.getCurrentBundleSize();
      
      expect(size).toBe(500000);
      expect(mockPerformance.getEntriesByType).toHaveBeenCalledWith('navigation');
    });

    it('should return estimated size when performance API unavailable', async () => {
      mockPerformance.getEntriesByType.mockReturnValue([]);
      
      const size = await bundleOptimizer.getCurrentBundleSize();
      
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      mockPerformance.getEntriesByType.mockImplementation(() => {
        throw new Error('Performance API error');
      });
      
      const size = await bundleOptimizer.getCurrentBundleSize();
      
      expect(size).toBe(0);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Could not determine current bundle size:',
        expect.any(Error)
      );
    });
  });

  describe('getBundleComposition', () => {
    it('should analyze script tags and return chunk info', async () => {
      const mockScript = {
        src: 'https://example.com/assets/main-abc123.js'
      };
      mockDocument.querySelectorAll.mockReturnValue([mockScript]);
      
      const chunks = await bundleOptimizer.getBundleComposition();
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('script[src]');
    });

    it('should filter out node_modules scripts', async () => {
      const mockScripts = [
        { src: 'https://example.com/assets/main-abc123.js' },
        { src: 'https://example.com/node_modules/react/index.js' }
      ];
      mockDocument.querySelectorAll.mockReturnValue(mockScripts);
      
      const chunks = await bundleOptimizer.getBundleComposition();
      
      // Should only include non-node_modules scripts
      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array when document unavailable', async () => {
      // @ts-ignore
      global.document = undefined;
      
      const chunks = await bundleOptimizer.getBundleComposition();
      
      expect(chunks).toEqual([]);
      
      // Restore document mock
      // @ts-ignore
      global.document = mockDocument;
    });
  });

  describe('detectUnusedCode', () => {
    it('should return array of unused code info', async () => {
      const unusedCode = await bundleOptimizer.detectUnusedCode();
      
      expect(Array.isArray(unusedCode)).toBe(true);
      
      unusedCode.forEach(info => {
        expect(info).toHaveProperty('file');
        expect(info).toHaveProperty('unusedExports');
        expect(info).toHaveProperty('sizeSavings');
        expect(Array.isArray(info.unusedExports)).toBe(true);
        expect(typeof info.sizeSavings).toBe('number');
      });
    });
  });

  describe('analyzeDependencies', () => {
    it('should return array of dependency info', async () => {
      const dependencies = await bundleOptimizer.analyzeDependencies();
      
      expect(Array.isArray(dependencies)).toBe(true);
      expect(dependencies.length).toBeGreaterThan(0);
      
      dependencies.forEach(dep => {
        expect(dep).toHaveProperty('name');
        expect(dep).toHaveProperty('size');
        expect(dep).toHaveProperty('used');
        expect(dep).toHaveProperty('importPath');
        expect(typeof dep.size).toBe('number');
        expect(typeof dep.used).toBe('boolean');
      });
    });

    it('should include common React dependencies', async () => {
      const dependencies = await bundleOptimizer.analyzeDependencies();
      const names = dependencies.map(dep => dep.name);
      
      expect(names).toContain('react');
      expect(names).toContain('react-dom');
    });
  });

  describe('clearCache', () => {
    it('should clear analysis cache', async () => {
      // First, populate the cache
      await bundleOptimizer.analyzeBundles();
      
      // Clear the cache
      bundleOptimizer.clearCache();
      
      // The next analysis should be fresh (we can't easily test this without mocking internals)
      const analysis = await bundleOptimizer.analyzeBundles();
      expect(analysis).toBeDefined();
    });
  });
});