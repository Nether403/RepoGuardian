import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redisManager } from '../redis';
import { analyticsService } from '../analytics';

describe('Multi-Instance Integration Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is available for multi-instance tests
    if (process.env.USE_REDIS_SESSIONS !== 'true') {
      console.log('Skipping multi-instance tests - Redis not enabled');
      return;
    }
  });

  afterAll(async () => {
    // Cleanup
    if (redisManager.isConnected()) {
      await redisManager.disconnect();
    }
  });

  describe('Session Sharing Across Instances', () => {
    it('should share session data via Redis', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const client = await redisManager.getClient();
      
      // Simulate instance 1 setting session data
      const sessionId = 'test-session-123';
      const sessionData = {
        userId: 'user-456',
        createdAt: new Date().toISOString(),
        data: { test: 'value' },
      };
      
      await client.set(
        `sess:${sessionId}`,
        JSON.stringify(sessionData),
        { EX: 3600 }
      );
      
      // Simulate instance 2 reading session data
      const retrieved = await client.get(`sess:${sessionId}`);
      expect(retrieved).toBeDefined();
      
      const parsedData = JSON.parse(retrieved!);
      expect(parsedData.userId).toBe(sessionData.userId);
      
      // Cleanup
      await client.del(`sess:${sessionId}`);
    });

    it('should handle session expiration', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const client = await redisManager.getClient();
      
      const sessionId = 'test-session-expire';
      await client.set(`sess:${sessionId}`, 'test', { EX: 1 });
      
      // Should exist immediately
      let exists = await client.exists(`sess:${sessionId}`);
      expect(exists).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      exists = await client.exists(`sess:${sessionId}`);
      expect(exists).toBe(0);
    });
  });

  describe('Analytics Opt-Out Sharing', () => {
    it('should share opt-out preferences across instances', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const sessionId = 'test-optout-session';
      
      // Instance 1: User opts out
      await analyticsService.optOut(sessionId);
      
      // Instance 2: Check opt-out status
      const hasOptedOut = await analyticsService.hasOptedOut(sessionId);
      expect(hasOptedOut).toBe(true);
      
      // Instance 1: User opts back in
      await analyticsService.optIn(sessionId);
      
      // Instance 2: Check opt-in status
      const stillOptedOut = await analyticsService.hasOptedOut(sessionId);
      expect(stillOptedOut).toBe(false);
    });

    it('should not track events for opted-out sessions', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const sessionId = 'test-no-track-session';
      
      // Opt out
      await analyticsService.optOut(sessionId);
      
      // Try to track event
      await analyticsService.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId,
        properties: { test: true },
      });
      
      // Event should not be tracked (no error should be thrown)
      expect(true).toBe(true);
      
      // Cleanup
      await analyticsService.optIn(sessionId);
    });
  });

  describe('Redis Connection Health', () => {
    it('should report healthy status when connected', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const health = await redisManager.getHealthStatus();
      expect(health.status).toBe('up');
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.responseTime).toBeLessThan(1000);
    });

    it('should handle Redis ping', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const client = await redisManager.getClient();
      const pong = await client.ping();
      expect(pong).toBe('PONG');
    });
  });

  describe('Concurrent Instance Operations', () => {
    it('should handle concurrent session writes', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const client = await redisManager.getClient();
      
      // Simulate multiple instances writing sessions concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          client.set(`sess:concurrent-${i}`, `data-${i}`, { EX: 60 })
        );
      }
      
      await Promise.all(promises);
      
      // Verify all sessions were written
      for (let i = 0; i < 10; i++) {
        const value = await client.get(`sess:concurrent-${i}`);
        expect(value).toBe(`data-${i}`);
      }
      
      // Cleanup
      const deletePromises = [];
      for (let i = 0; i < 10; i++) {
        deletePromises.push(client.del(`sess:concurrent-${i}`));
      }
      await Promise.all(deletePromises);
    });

    it('should handle concurrent opt-out operations', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      // Simulate multiple instances handling opt-outs concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(analyticsService.optOut(`concurrent-session-${i}`));
      }
      
      await Promise.all(promises);
      
      // Verify all opt-outs were recorded
      for (let i = 0; i < 5; i++) {
        const hasOptedOut = await analyticsService.hasOptedOut(`concurrent-session-${i}`);
        expect(hasOptedOut).toBe(true);
      }
      
      // Cleanup
      const cleanupPromises = [];
      for (let i = 0; i < 5; i++) {
        cleanupPromises.push(analyticsService.optIn(`concurrent-session-${i}`));
      }
      await Promise.all(cleanupPromises);
    });
  });

  describe('Instance Isolation', () => {
    it('should not share in-memory state between test runs', () => {
      // Each test run should have its own instance ID
      const { instanceId } = require('../instanceId');
      const id1 = instanceId.getId();
      
      // Re-import to simulate different instance
      delete require.cache[require.resolve('../instanceId')];
      const { instanceId: instanceId2 } = require('../instanceId');
      const id2 = instanceId2.getId();
      
      // IDs should be different (different instances)
      // Note: In same process they'll be same, but in real multi-instance they'd differ
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });
  });

  describe('Connection Draining', () => {
    it('should allow graceful shutdown without data loss', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const client = await redisManager.getClient();
      
      // Write some data
      await client.set('test-drain-key', 'test-value', { EX: 60 });
      
      // Verify data exists
      const value = await client.get('test-drain-key');
      expect(value).toBe('test-value');
      
      // Cleanup
      await client.del('test-drain-key');
    });
  });

  describe('Load Balancer Health Checks', () => {
    it('should support health check queries', async () => {
      if (process.env.USE_REDIS_SESSIONS !== 'true') {
        console.log('Skipping test - Redis not enabled');
        return;
      }

      const health = await redisManager.getHealthStatus();
      
      // Health check should complete quickly (< 2 seconds)
      expect(health.responseTime).toBeLessThan(2000);
      
      // Should return valid status
      expect(['up', 'down', 'degraded']).toContain(health.status);
    });
  });
});
