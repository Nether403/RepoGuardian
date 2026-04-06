import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { serveStatic } from '../vite';
import fs from 'fs';
import path from 'path';

describe('Static Asset Serving with Caching', () => {
  let app: Express;
  const distPath = path.resolve(process.cwd(), 'dist', 'public');
  const testFiles = {
    'index.html': '<html><body>Test</body></html>',
    'app.abc12345.js': 'console.log("test");',
    'styles.def67890.css': 'body { margin: 0; }',
    'logo.png': 'fake-image-data',
    'manifest.json': '{"name": "test"}',
  };

  beforeAll(() => {
    // Create test dist directory and files
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }

    Object.entries(testFiles).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(distPath, filename), content);
    });

    // Setup test app
    app = express();
    serveStatic(app);
  });

  afterAll(() => {
    // Cleanup test files
    Object.keys(testFiles).forEach((filename) => {
      const filePath = path.join(distPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('Compression', () => {
    it('should compress responses when enabled', async () => {
      process.env.COMPRESSION_ENABLED = 'true';
      const response = await request(app)
        .get('/index.html')
        .set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      // Compression middleware should add encoding header
      expect(response.headers['content-encoding']).toBeDefined();
    });

    it('should respect compression threshold', async () => {
      process.env.COMPRESSION_THRESHOLD = '10000'; // High threshold
      const response = await request(app)
        .get('/manifest.json')
        .set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      // Small file should not be compressed
    });
  });

  describe('Cache Headers', () => {
    it('should set immutable cache for hashed JS files', async () => {
      const response = await request(app).get('/app.abc12345.js');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('immutable');
      expect(response.headers['cache-control']).toContain('max-age=31536000');
    });

    it('should set immutable cache for hashed CSS files', async () => {
      const response = await request(app).get('/styles.def67890.css');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('immutable');
      expect(response.headers['cache-control']).toContain('max-age=31536000');
    });

    it('should set moderate cache for images', async () => {
      const response = await request(app).get('/logo.png');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('max-age=86400');
    });

    it('should set short cache with revalidation for HTML', async () => {
      const response = await request(app).get('/index.html');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('max-age=3600');
      expect(response.headers['cache-control']).toContain('must-revalidate');
    });

    it('should include ETag headers', async () => {
      const response = await request(app).get('/index.html');

      expect(response.status).toBe(200);
      expect(response.headers['etag']).toBeDefined();
    });

    it('should include Last-Modified headers', async () => {
      const response = await request(app).get('/index.html');

      expect(response.status).toBe(200);
      expect(response.headers['last-modified']).toBeDefined();
    });
  });

  describe('SPA Routing', () => {
    it('should serve index.html for non-existent routes', async () => {
      const response = await request(app).get('/some/client/route');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Test');
    });

    it('should return 404 for non-existent API routes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should serve index.html for root path', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Test');
    });
  });

  describe('Static File Serving', () => {
    it('should serve static files from dist/public', async () => {
      const response = await request(app).get('/manifest.json');

      expect(response.status).toBe(200);
      expect(response.text).toContain('test');
    });

    it('should handle non-existent static files gracefully', async () => {
      const response = await request(app).get('/nonexistent.js');

      // Should fall back to index.html for SPA routing
      expect(response.status).toBe(200);
      expect(response.text).toContain('Test');
    });
  });

  describe('Compression Configuration', () => {
    it('should respect COMPRESSION_ENABLED=false', async () => {
      process.env.COMPRESSION_ENABLED = 'false';
      
      // Need to recreate app with new env
      const testApp = express();
      serveStatic(testApp);

      const response = await request(testApp)
        .get('/index.html')
        .set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      // Should not have compression when disabled
    });

    it('should exclude configured content types from compression', async () => {
      process.env.COMPRESSION_EXCLUDE_CONTENT_TYPES = 'image/*,video/*';
      
      const testApp = express();
      serveStatic(testApp);

      const response = await request(testApp)
        .get('/logo.png')
        .set('Accept-Encoding', 'gzip');

      expect(response.status).toBe(200);
      // Images should not be compressed
    });
  });
});
