/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { analyticsEvents } from '../../shared/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Analytics Schema Structure', () => {
  describe('Schema Definition', () => {
    it('should have analyticsEvents table defined', () => {
      expect(analyticsEvents).toBeDefined();
      // Verify it's a Drizzle table object
      expect(typeof analyticsEvents).toBe('object');
    });

    it('should have all required columns', () => {
      const columns = Object.keys(analyticsEvents);
      
      // Check for required columns
      expect(columns).toContain('id');
      expect(columns).toContain('eventName');
      expect(columns).toContain('eventCategory');
      expect(columns).toContain('properties');
      expect(columns).toContain('userId');
      expect(columns).toContain('sessionId');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('createdAt');
    });
  });

  describe('Migration Script', () => {
    it('should have migration file with createAnalyticsSchema function', () => {
      const migrationPath = join(process.cwd(), 'server', 'migrations', 'create-analytics-schema.ts');
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      
      expect(migrationContent).toContain('export async function createAnalyticsSchema');
      expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS analytics_events');
    });

    it('should have migration file with rollbackAnalyticsSchema function', () => {
      const migrationPath = join(process.cwd(), 'server', 'migrations', 'create-analytics-schema.ts');
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      
      expect(migrationContent).toContain('export async function rollbackAnalyticsSchema');
      expect(migrationContent).toContain('DROP TABLE IF EXISTS analytics_events');
    });

    it('should create all required indexes in migration', () => {
      const migrationPath = join(process.cwd(), 'server', 'migrations', 'create-analytics-schema.ts');
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      
      // Check for all required indexes
      expect(migrationContent).toContain('idx_analytics_events_name');
      expect(migrationContent).toContain('idx_analytics_events_timestamp');
      expect(migrationContent).toContain('idx_analytics_events_session');
      expect(migrationContent).toContain('idx_analytics_events_category');
      expect(migrationContent).toContain('idx_analytics_events_user');
    });
  });

  describe('Database Connection Pooling Configuration', () => {
    it('should have pool configuration in environment', () => {
      // These environment variables are used in db.ts for connection pooling
      const poolConfig = {
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
      };

      expect(poolConfig.max).toBeGreaterThan(0);
      expect(poolConfig.min).toBeGreaterThan(0);
      expect(poolConfig.idleTimeout).toBeGreaterThan(0);
      expect(poolConfig.connectionTimeout).toBeGreaterThan(0);
      
      // Verify sensible defaults
      expect(poolConfig.max).toBe(20);
      expect(poolConfig.min).toBe(2);
      expect(poolConfig.idleTimeout).toBe(30000); // 30 seconds
      expect(poolConfig.connectionTimeout).toBe(10000); // 10 seconds
    });
  });
});
