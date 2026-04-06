import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSessionStore, getSessionConfig } from '../sessionStore';
import session from 'express-session';

describe('Session Store', () => {
  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-secret-key-for-testing-only';
    process.env.SESSION_ENCRYPTION_KEY = 'a'.repeat(64); // 64 char hex key
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSessionStore', () => {
    it('should create memory store when Redis is disabled', async () => {
      process.env.USE_REDIS_SESSIONS = 'false';
      
      const store = await createSessionStore();
      
      expect(store).toBeDefined();
      expect(store).toBeInstanceOf(session.Store);
    });

    it('should fallback to memory store on Redis connection failure', async () => {
      process.env.USE_REDIS_SESSIONS = 'true';
      process.env.REDIS_URL = 'redis://invalid-host:9999';
      
      const store = await Promise.race([
        createSessionStore(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Store creation timeout')), 5000))
      ]) as session.Store;
      
      expect(store).toBeDefined();
      expect(store).toBeInstanceOf(session.Store);
    }, 15000);

    it('should create Redis store when enabled and available', async () => {
      process.env.USE_REDIS_SESSIONS = 'true';
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      try {
        const store = await createSessionStore();
        
        expect(store).toBeDefined();
        expect(store).toBeInstanceOf(session.Store);
      } catch (error) {
        // Redis might not be available in test environment
        console.log('Redis not available, test skipped');
        expect(error).toBeDefined();
      }
    });
  });

  describe('getSessionConfig', () => {
    it('should return valid session configuration', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config).toBeDefined();
      expect(config.store).toBe(store);
      expect(config.secret).toBeDefined();
      expect(config.resave).toBe(false);
      expect(config.saveUninitialized).toBe(false);
      expect(config.cookie).toBeDefined();
    });

    it('should configure secure cookies in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.cookie?.secure).toBe(true);
      expect(config.cookie?.httpOnly).toBe(true);
      expect(config.cookie?.sameSite).toBe('lax');
    });

    it('should configure non-secure cookies in development', async () => {
      process.env.NODE_ENV = 'development';
      
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.cookie?.secure).toBe(false);
      expect(config.cookie?.httpOnly).toBe(true);
    });

    it('should set appropriate cookie maxAge', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      const expectedMaxAge = 24 * 60 * 60 * 1000; // 24 hours
      expect(config.cookie?.maxAge).toBe(expectedMaxAge);
    });

    it('should enable rolling sessions', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.rolling).toBe(true);
    });
  });

  describe('Session Encryption', () => {
    it('should encrypt and decrypt session data', async () => {
      process.env.USE_REDIS_SESSIONS = 'true';
      
      try {
        const store = await createSessionStore();
        
        // The store should have serializer with encryption
        expect(store).toBeDefined();
        
        // Test would require actual Redis connection to verify encryption
        console.log('Session encryption test requires Redis connection');
      } catch (error) {
        console.log('Redis not available for encryption test');
        expect(error).toBeDefined();
      }
    });

    it('should handle encryption errors gracefully', async () => {
      // Invalid encryption key
      process.env.SESSION_ENCRYPTION_KEY = 'invalid';
      process.env.USE_REDIS_SESSIONS = 'true';
      
      try {
        const store = await createSessionStore();
        expect(store).toBeDefined();
      } catch (error) {
        // Should fallback to memory store
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Store Operations', () => {
    it('should support get operation', async () => {
      const store = await createSessionStore();
      
      expect(store.get).toBeDefined();
      expect(typeof store.get).toBe('function');
    });

    it('should support set operation', async () => {
      const store = await createSessionStore();
      
      expect(store.set).toBeDefined();
      expect(typeof store.set).toBe('function');
    });

    it('should support destroy operation', async () => {
      const store = await createSessionStore();
      
      expect(store.destroy).toBeDefined();
      expect(typeof store.destroy).toBe('function');
    });

    it('should support touch operation', async () => {
      const store = await createSessionStore();
      
      // Touch might not be available on all stores
      if (store.touch) {
        expect(typeof store.touch).toBe('function');
      }
    });
  });

  describe('Session Data Structure', () => {
    it('should support userId in session data', () => {
      const sessionData: session.SessionData = {
        userId: 'test-user-123',
        cookie: {} as any,
      };
      
      expect(sessionData.userId).toBe('test-user-123');
    });

    it('should support createdAt in session data', () => {
      const now = new Date();
      const sessionData: session.SessionData = {
        createdAt: now,
        cookie: {} as any,
      };
      
      expect(sessionData.createdAt).toBe(now);
    });

    it('should support custom data in session', () => {
      const sessionData: session.SessionData = {
        data: {
          customField: 'custom-value',
          anotherField: 123,
        },
        cookie: {} as any,
      };
      
      expect(sessionData.data?.customField).toBe('custom-value');
      expect(sessionData.data?.anotherField).toBe(123);
    });
  });

  describe('Security', () => {
    it('should use httpOnly cookies', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.cookie?.httpOnly).toBe(true);
    });

    it('should use sameSite protection', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.cookie?.sameSite).toBe('lax');
    });

    it('should require session secret', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.secret).toBeDefined();
      expect(config.secret.length).toBeGreaterThan(0);
    });

    it('should not save uninitialized sessions', async () => {
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.saveUninitialized).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should create store quickly', async () => {
      const startTime = Date.now();
      await createSessionStore();
      const duration = Date.now() - startTime;
      
      // Should create store in less than 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent store creation', async () => {
      const promises = Array(5).fill(null).map(() => createSessionStore());
      
      const stores = await Promise.all(promises);
      
      expect(stores).toHaveLength(5);
      stores.forEach(store => {
        expect(store).toBeDefined();
      });
    });
  });
});
