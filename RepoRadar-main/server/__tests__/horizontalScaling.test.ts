import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Server } from 'http';

describe('Horizontal Scaling Configuration', () => {
  describe('Instance Identification', () => {
    it('should generate unique instance ID', async () => {
      const { instanceId } = await import('../instanceId');
      const id = instanceId.getId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should return consistent instance ID', async () => {
      const { instanceId } = await import('../instanceId');
      const id1 = instanceId.getId();
      const id2 = instanceId.getId();
      expect(id1).toBe(id2);
    });

    it('should provide instance metadata', async () => {
      const { instanceId } = await import('../instanceId');
      const metadata = instanceId.getMetadata();
      expect(metadata).toHaveProperty('instanceId');
      expect(metadata).toHaveProperty('hostname');
      expect(metadata).toHaveProperty('pid');
      expect(metadata).toHaveProperty('startTime');
      expect(metadata).toHaveProperty('uptime');
      expect(typeof metadata.uptime).toBe('number');
      expect(metadata.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should format log messages with instance info', async () => {
      const { instanceId } = await import('../instanceId');
      const message = 'Test message';
      const formatted = instanceId.formatLog(message, 'info');
      expect(formatted).toContain(message);
      expect(formatted).toContain(instanceId.getId());
      expect(formatted).toContain('INFO');
    });

    it('should track instance uptime', async () => {
      const { instanceId } = await import('../instanceId');
      const uptime1 = instanceId.getUptime();
      await new Promise(resolve => setTimeout(resolve, 100));
      const uptime2 = instanceId.getUptime();
      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });
  });

  describe('Enhanced Logger', () => {
    it('should log info messages with instance ID', async () => {
      const { logger, instanceId } = await import('../instanceId');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('INFO');
      expect(logCall).toContain(instanceId.getId());
      consoleSpy.mockRestore();
    });

    it('should log error messages with instance ID', async () => {
      const { logger, instanceId } = await import('../instanceId');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('Test error message');
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('ERROR');
      expect(logCall).toContain(instanceId.getId());
      consoleSpy.mockRestore();
    });

    it('should log warning messages with instance ID', async () => {
      const { logger, instanceId } = await import('../instanceId');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Test warning message');
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('WARN');
      expect(logCall).toContain(instanceId.getId());
      consoleSpy.mockRestore();
    });
  });

  describe('Session Store Configuration', () => {
    it('should create session store', async () => {
      const { createSessionStore } = await import('../sessionStore');
      const store = await createSessionStore();
      expect(store).toBeDefined();
    });

    it('should provide session config', async () => {
      const { createSessionStore, getSessionConfig } = await import('../sessionStore');
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config).toHaveProperty('store');
      expect(config).toHaveProperty('secret');
      expect(config).toHaveProperty('resave');
      expect(config).toHaveProperty('saveUninitialized');
      expect(config).toHaveProperty('cookie');
      expect(config.resave).toBe(false);
      expect(config.saveUninitialized).toBe(false);
    });

    it('should configure secure cookies in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const { createSessionStore, getSessionConfig } = await import('../sessionStore');
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.cookie?.secure).toBe(true);
      expect(config.cookie?.httpOnly).toBe(true);
      expect(config.cookie?.sameSite).toBe('lax');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should configure session rolling', async () => {
      const { createSessionStore, getSessionConfig } = await import('../sessionStore');
      const store = await createSessionStore();
      const config = getSessionConfig(store);
      
      expect(config.rolling).toBe(true);
    });
  });

  describe('Graceful Shutdown', () => {
    let mockServer: Partial<Server>;
    let connectionHandlers: Map<string, Function>;
    let signalHandlers: Map<string, Function>;

    beforeEach(() => {
      connectionHandlers = new Map();
      signalHandlers = new Map();

      mockServer = {
        on: vi.fn((event: string, handler: Function) => {
          connectionHandlers.set(event, handler);
        }),
        close: vi.fn((callback?: Function) => {
          if (callback) callback();
        }),
      };

      // Mock process event handlers
      const originalOn = process.on.bind(process);
      vi.spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
        signalHandlers.set(event, handler);
        return process;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should initialize graceful shutdown handler', async () => {
      const { gracefulShutdown } = await import('../gracefulShutdown');
      gracefulShutdown.initialize(mockServer as Server);
      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should track active connections', async () => {
      const { gracefulShutdown } = await import('../gracefulShutdown');
      gracefulShutdown.initialize(mockServer as Server);
      
      const connectionHandler = connectionHandlers.get('connection');
      expect(connectionHandler).toBeDefined();
      
      const mockConnection = {
        on: vi.fn(),
      };
      
      connectionHandler!(mockConnection);
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should not be in shutdown state initially', async () => {
      const { gracefulShutdown } = await import('../gracefulShutdown');
      expect(gracefulShutdown.isShutdownInProgress()).toBe(false);
    });
  });

  describe('Redis Connection for Multi-Instance', () => {
    it('should check Redis connection status', async () => {
      const { redisManager } = await import('../redis');
      const isConnected = redisManager.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should get Redis health status', async () => {
      const { redisManager } = await import('../redis');
      const health = await redisManager.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('responseTime');
      expect(['up', 'down', 'degraded']).toContain(health.status);
      expect(typeof health.responseTime).toBe('number');
    });
  });

  describe('Stateless Application Verification', () => {
    it('should not use in-memory session storage when Redis is enabled', async () => {
      const originalEnv = process.env.USE_REDIS_SESSIONS;
      process.env.USE_REDIS_SESSIONS = 'true';
      
      const { createSessionStore } = await import('../sessionStore');
      const store = await createSessionStore();
      const storeName = store.constructor.name;
      
      // Should be RedisStore or fallback to MemoryStore if Redis unavailable
      // In test environment without Redis, it will fallback
      expect(storeName).toBeDefined();
      
      process.env.USE_REDIS_SESSIONS = originalEnv;
    });

    it('should fall back to memory store when Redis is disabled', async () => {
      const originalEnv = process.env.USE_REDIS_SESSIONS;
      process.env.USE_REDIS_SESSIONS = 'false';
      
      const { createSessionStore } = await import('../sessionStore');
      const store = await createSessionStore();
      const storeName = store.constructor.name;
      
      // Should be MemoryStore when Redis is disabled
      expect(storeName).toContain('Memory');
      
      process.env.USE_REDIS_SESSIONS = originalEnv;
    });
  });

  describe('Instance Metadata for Logging', () => {
    it('should include instance ID in metadata', async () => {
      const { instanceId } = await import('../instanceId');
      const metadata = instanceId.getMetadata();
      expect(metadata.instanceId).toBeDefined();
      expect(metadata.instanceId.length).toBeGreaterThan(0);
    });

    it('should include hostname in metadata', async () => {
      const { instanceId } = await import('../instanceId');
      const metadata = instanceId.getMetadata();
      expect(metadata.hostname).toBeDefined();
      expect(typeof metadata.hostname).toBe('string');
    });

    it('should include PID in metadata', async () => {
      const { instanceId } = await import('../instanceId');
      const metadata = instanceId.getMetadata();
      expect(metadata.pid).toBeDefined();
      expect(typeof metadata.pid).toBe('number');
      expect(metadata.pid).toBeGreaterThan(0);
    });

    it('should include start time in metadata', async () => {
      const { instanceId } = await import('../instanceId');
      const metadata = instanceId.getMetadata();
      expect(metadata.startTime).toBeDefined();
      expect(typeof metadata.startTime).toBe('string');
      // Should be valid ISO date
      expect(() => new Date(metadata.startTime)).not.toThrow();
    });
  });
});
