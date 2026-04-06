/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkDatabaseHealth, pool } from '../db';

describe('Database Health Check', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database is connected', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.poolStats).toBeDefined();
      expect(health.poolStats?.total).toBeGreaterThanOrEqual(0);
      expect(health.poolStats?.idle).toBeGreaterThanOrEqual(0);
      expect(health.poolStats?.waiting).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable response time', async () => {
      const health = await checkDatabaseHealth();
      
      // Health check should complete within 1 second
      expect(health.responseTime).toBeLessThan(1000);
    });

    it('should provide pool statistics', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.poolStats).toBeDefined();
      expect(typeof health.poolStats?.total).toBe('number');
      expect(typeof health.poolStats?.idle).toBe('number');
      expect(typeof health.poolStats?.waiting).toBe('number');
    });
  });

  describe('Connection Pool Configuration', () => {
    it('should have pool configured with correct settings', () => {
      expect(pool).toBeDefined();
      expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple concurrent health checks', async () => {
      const checks = await Promise.all([
        checkDatabaseHealth(),
        checkDatabaseHealth(),
        checkDatabaseHealth(),
      ]);

      checks.forEach(health => {
        expect(health.status).toBe('healthy');
        expect(health.responseTime).toBeGreaterThan(0);
      });
    });
  });
});
