import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { gzip, brotliCompress, deflate } from 'zlib';
import { promisify } from 'util';
import { CompressionMiddleware, createCompressionMiddleware } from '../CompressionMiddleware';
import type { CompressionConfig } from '../interfaces';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const deflateAsync = promisify(deflate);

describe('CompressionMiddleware', () => {
  let middleware: CompressionMiddleware;

  beforeEach(() => {
    middleware = new CompressionMiddleware();
  });

  describe('Basic Compression', () => {
    it('should compress data with gzip', async () => {
      const testData = 'Hello, World!'.repeat(100); // Make it large enough to compress
      const result = await middleware.compress(testData, ['gzip']);

      expect(result.encoding).toBe('gzip');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionTime).toBeGreaterThan(0);

      // Verify the compressed data can be decompressed
      const decompressed = await gzipAsync(Buffer.from(testData));
      expect(result.data.length).toBe(decompressed.length);
    });

    it('should compress data with brotli', async () => {
      const testData = 'Hello, World!'.repeat(100);
      const result = await middleware.compress(testData, ['brotli']);

      expect(result.encoding).toBe('brotli');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionTime).toBeGreaterThan(0);
    });

    it('should compress data with deflate', async () => {
      const testData = 'Hello, World!'.repeat(100);
      const result = await middleware.compress(testData, ['deflate']);

      expect(result.encoding).toBe('deflate');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionTime).toBeGreaterThan(0);
    });

    it('should return identity encoding when no supported algorithms', async () => {
      const testData = 'Hello, World!';
      const result = await middleware.compress(testData, ['unsupported']);

      expect(result.encoding).toBe('identity');
      expect(result.compressedSize).toBe(result.originalSize);
      expect(result.compressionTime).toBe(0);
    });

    it('should handle Buffer input', async () => {
      const testData = Buffer.from('Hello, World!'.repeat(100));
      const result = await middleware.compress(testData, ['gzip']);

      expect(result.encoding).toBe('gzip');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    });
  });

  describe('Algorithm Selection', () => {
    it('should select best algorithm based on preference order', () => {
      const config: Partial<CompressionConfig> = {
        algorithms: ['brotli', 'gzip', 'deflate'],
      };
      middleware.configure(config);

      expect(middleware.getBestAlgorithm(['gzip', 'brotli'])).toBe('brotli');
      expect(middleware.getBestAlgorithm(['deflate', 'gzip'])).toBe('gzip');
      expect(middleware.getBestAlgorithm(['deflate'])).toBe('deflate');
    });

    it('should return null when no supported algorithms', () => {
      expect(middleware.getBestAlgorithm(['unsupported'])).toBeNull();
      expect(middleware.getBestAlgorithm([])).toBeNull();
    });

    it('should handle case-insensitive encoding names', () => {
      expect(middleware.getBestAlgorithm(['GZIP', 'Brotli'])).toBe('brotli');
      expect(middleware.getBestAlgorithm(['DEFLATE'])).toBe('deflate');
    });
  });

  describe('Compression Decision', () => {
    it('should not compress small responses', () => {
      const config: Partial<CompressionConfig> = { threshold: 1024 };
      middleware.configure(config);

      expect(middleware.shouldCompress(500)).toBe(false);
      expect(middleware.shouldCompress(1024)).toBe(true);
      expect(middleware.shouldCompress(2000)).toBe(true);
    });

    it('should not compress already compressed content types', () => {
      expect(middleware.shouldCompress(2000, 'image/jpeg')).toBe(false);
      expect(middleware.shouldCompress(2000, 'image/png')).toBe(false);
      expect(middleware.shouldCompress(2000, 'video/mp4')).toBe(false);
      expect(middleware.shouldCompress(2000, 'audio/mpeg')).toBe(false);
      expect(middleware.shouldCompress(2000, 'application/zip')).toBe(false);
      expect(middleware.shouldCompress(2000, 'application/gzip')).toBe(false);
    });

    it('should compress text content types', () => {
      expect(middleware.shouldCompress(2000, 'text/html')).toBe(true);
      expect(middleware.shouldCompress(2000, 'text/css')).toBe(true);
      expect(middleware.shouldCompress(2000, 'application/json')).toBe(true);
      expect(middleware.shouldCompress(2000, 'application/javascript')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track compression statistics', async () => {
      const testData = 'Hello, World!'.repeat(100);
      
      await middleware.compress(testData, ['gzip']);
      await middleware.compress(testData, ['brotli']);
      await middleware.compress(testData, ['deflate']);

      const stats = middleware.getStats();
      expect(stats.compressedRequests).toBe(3);
      expect(stats.algorithmUsage.gzip).toBe(1);
      expect(stats.algorithmUsage.brotli).toBe(1);
      expect(stats.algorithmUsage.deflate).toBe(1);
      expect(stats.bytesSaved).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.processingTime).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const testData = 'Hello, World!'.repeat(100);
      await middleware.compress(testData, ['gzip']);

      middleware.resetStats();
      const stats = middleware.getStats();
      
      expect(stats.compressedRequests).toBe(0);
      expect(stats.bytesSaved).toBe(0);
      expect(stats.algorithmUsage).toEqual({});
    });
  });

  describe('Configuration', () => {
    it('should apply configuration changes', () => {
      const config: Partial<CompressionConfig> = {
        threshold: 2048,
        algorithms: ['gzip'],
        level: 9,
      };

      middleware.configure(config);

      expect(middleware.shouldCompress(1000)).toBe(false);
      expect(middleware.shouldCompress(3000)).toBe(true);
      expect(middleware.getBestAlgorithm(['brotli', 'gzip'])).toBe('gzip');
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported algorithms gracefully', async () => {
      const testData = 'Hello, World!';
      const result = await middleware.compress(testData, ['unsupported-algorithm']);

      // Should fallback to identity encoding
      expect(result.encoding).toBe('identity');
      expect(result.data).toEqual(Buffer.from(testData));
      expect(result.originalSize).toBe(result.compressedSize);
      expect(result.compressionTime).toBe(0);
    });
  });
});

describe('Express Integration', () => {
  let app: express.Application;
  let compressionMiddleware: CompressionMiddleware;

  beforeEach(() => {
    app = express();
    compressionMiddleware = createCompressionMiddleware({
      threshold: 100, // Low threshold for testing
    });
    app.use(compressionMiddleware.middleware());
  });

  describe('JSON Responses', () => {
    it('should compress large JSON responses', async () => {
      const largeData = { message: 'Hello, World!'.repeat(100) };
      
      app.get('/test', (req, res) => {
        res.json(largeData);
      });

      const response = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers['vary']).toContain('Accept-Encoding');
      expect(parseInt(response.headers['content-length'])).toBeLessThan(
        Buffer.byteLength(JSON.stringify(largeData))
      );
    });

    it('should not compress small JSON responses', async () => {
      const smallData = { message: 'Hi' };
      
      app.get('/test', (req, res) => {
        res.json(smallData);
      });

      const response = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Text Responses', () => {
    it('should compress large text responses', async () => {
      const largeText = 'Hello, World!'.repeat(100);
      
      app.get('/test', (req, res) => {
        res.send(largeText);
      });

      const response = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });

    it('should handle different encoding preferences', async () => {
      const largeText = 'Hello, World!'.repeat(100);
      
      app.get('/test', (req, res) => {
        res.send(largeText);
      });

      // Test brotli preference
      const brotliResponse = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'brotli, gzip')
        .expect(200);

      expect(brotliResponse.headers['content-encoding']).toBe('brotli');

      // Test gzip only
      const gzipResponse = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(gzipResponse.headers['content-encoding']).toBe('gzip');
    });
  });

  describe('Fallback Behavior', () => {
    it('should serve uncompressed when client does not support compression', async () => {
      const largeText = 'Hello, World!'.repeat(100);
      
      app.get('/test', (req, res) => {
        res.send(largeText);
      });

      const response = await request(app)
        .get('/test')
        .set('Accept-Encoding', 'identity') // Explicitly request no compression
        .expect(200);

      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.text).toBe(largeText);
    });

    it('should handle compression middleware errors gracefully', async () => {
      // Create middleware that will fail
      const faultyMiddleware = createCompressionMiddleware();
      vi.spyOn(faultyMiddleware, 'compress').mockRejectedValue(new Error('Compression failed'));
      
      const faultyApp = express();
      faultyApp.use(faultyMiddleware.middleware());
      
      const largeText = 'Hello, World!'.repeat(100);
      faultyApp.get('/test', (req, res) => {
        res.send(largeText);
      });

      const response = await request(faultyApp)
        .get('/test')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Should fallback to uncompressed
      expect(response.text).toBe(largeText);
    });
  });

  describe('Statistics Integration', () => {
    it('should track requests through middleware', async () => {
      const largeData = { message: 'Hello, World!'.repeat(100) };
      
      app.get('/test', (req, res) => {
        res.json(largeData);
      });

      await request(app)
        .get('/test')
        .set('Accept-Encoding', 'gzip');

      await request(app)
        .get('/test')
        .set('Accept-Encoding', 'brotli');

      const stats = compressionMiddleware.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.compressedRequests).toBe(2);
    });
  });
});

describe('createCompressionMiddleware factory', () => {
  it('should create compression middleware with default config', () => {
    const middleware = createCompressionMiddleware();
    expect(middleware).toBeInstanceOf(CompressionMiddleware);
  });

  it('should create compression middleware with custom config', () => {
    const config: Partial<CompressionConfig> = {
      threshold: 2048,
      algorithms: ['gzip'],
    };
    const middleware = createCompressionMiddleware(config);
    expect(middleware).toBeInstanceOf(CompressionMiddleware);
    
    expect(middleware.shouldCompress(1000)).toBe(false);
    expect(middleware.getBestAlgorithm(['brotli', 'gzip'])).toBe('gzip');
  });
});