import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { corsMiddleware } from '../middleware/cors';

describe('CORS Middleware', () => {
  let app: Express;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Production Environment', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'production';
      process.env.APP_URL = 'https://reporadar.onrender.com';
      
      // Create test app
      app = express();
      app.use(corsMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    it('should allow requests from configured production domain', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://reporadar.onrender.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://reporadar.onrender.com');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block requests from unauthorized domains', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://malicious-site.com');

      expect(response.status).toBe(500);
      expect(response.text).toContain('Not allowed by CORS');
    });

    it('should allow requests with no origin (mobile apps, curl)', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://reporadar.onrender.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://reporadar.onrender.com');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('should expose custom headers', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://reporadar.onrender.com');

      expect(response.headers['access-control-expose-headers']).toContain('X-Instance-Id');
      expect(response.headers['access-control-expose-headers']).toContain('X-RateLimit-Limit');
    });

    it('should allow all standard HTTP methods', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://reporadar.onrender.com')
        .set('Access-Control-Request-Method', 'DELETE');

      expect(response.status).toBe(204);
      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).toContain('GET');
      expect(allowedMethods).toContain('POST');
      expect(allowedMethods).toContain('PUT');
      expect(allowedMethods).toContain('DELETE');
      expect(allowedMethods).toContain('PATCH');
      expect(allowedMethods).toContain('OPTIONS');
    });

    it('should allow standard request headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://reporadar.onrender.com')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.status).toBe(204);
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
      expect(allowedHeaders).toContain('X-Requested-With');
    });
  });

  describe('Development Environment', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'development';
      delete process.env.APP_URL;
      
      // Create test app
      app = express();
      app.use(corsMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    it('should allow requests from localhost:3000', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow requests from localhost:5000', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:5000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5000');
    });

    it('should allow requests from localhost:5173 (Vite default)', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should allow requests from 127.0.0.1', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://127.0.0.1:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    });

    it('should block requests from external domains in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://external-site.com');

      expect(response.status).toBe(500);
      expect(response.text).toContain('Not allowed by CORS');
    });
  });

  describe('Credentials Support', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'production';
      process.env.APP_URL = 'https://reporadar.onrender.com';
      
      // Create test app
      app = express();
      app.use(corsMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    it('should allow credentials for authenticated requests', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://reporadar.onrender.com')
        .set('Cookie', 'session=abc123');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include credentials in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://reporadar.onrender.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Missing APP_URL in Production', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.APP_URL;
      
      // Create test app
      app = express();
      app.use(corsMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    it('should fall back to wildcard when APP_URL not set (with warning)', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://any-domain.com');

      // With wildcard, any origin should be allowed
      expect(response.status).toBe(200);
    });
  });
});
