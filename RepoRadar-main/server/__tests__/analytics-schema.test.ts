/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, pool, checkDatabaseHealth } from '../db';
import { createAnalyticsSchema, rollbackAnalyticsSchema } from '../migrations/create-analytics-schema';
import { analyticsEvents } from '../../shared/schema';
import { sql } from 'drizzle-orm';

describe('Analytics Schema', () => {
  beforeAll(async () => {
    // Ensure clean state before tests
    try {
      await rollbackAnalyticsSchema();
      await createAnalyticsSchema();
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up after tests
    try {
      await rollbackAnalyticsSchema();
      await pool.end();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  beforeEach(async () => {
    // Clear analytics_events table before each test
    try {
      await db.execute(sql`DELETE FROM analytics_events`);
    } catch (error) {
      // Table might not exist yet, ignore
    }
  });

  describe('Table Creation', () => {
    it('should create analytics_events table with correct structure', async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'analytics_events'
        ORDER BY ordinal_position
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const columns = result.rows.map((row: any) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
      }));

      // Verify required columns exist
      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('event_name');
      expect(columnNames).toContain('event_category');
      expect(columnNames).toContain('properties');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('session_id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('created_at');
    });

    it('should have proper indexes for performance', async () => {
      const result = await db.execute(sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'analytics_events'
      `);

      const indexNames = result.rows.map((row: any) => row.indexname);

      // Verify all required indexes exist
      expect(indexNames).toContain('idx_analytics_events_name');
      expect(indexNames).toContain('idx_analytics_events_timestamp');
      expect(indexNames).toContain('idx_analytics_events_session');
      expect(indexNames).toContain('idx_analytics_events_category');
      expect(indexNames).toContain('idx_analytics_events_user');
    });

    it('should have foreign key constraint to users table', async () => {
      const result = await db.execute(sql`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'analytics_events'
          AND tc.constraint_type = 'FOREIGN KEY'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      const foreignKey = result.rows[0] as any;
      expect(foreignKey.column_name).toBe('user_id');
      expect(foreignKey.foreign_table_name).toBe('users');
      expect(foreignKey.foreign_column_name).toBe('id');
    });
  });

  describe('Data Operations', () => {
    it('should insert analytics event successfully', async () => {
      const event = {
        eventName: 'repository_analyzed',
        eventCategory: 'analysis',
        properties: { repositoryId: 'test-repo-123', duration: 1500 },
        sessionId: 'session-123',
        timestamp: new Date(),
      };

      const result = await db.insert(analyticsEvents).values(event).returning();

      expect(result).toHaveLength(1);
      expect(result[0].eventName).toBe('repository_analyzed');
      expect(result[0].eventCategory).toBe('analysis');
      expect(result[0].sessionId).toBe('session-123');
      expect(result[0].properties).toEqual(event.properties);
    });

    it('should insert event with user_id', async () => {
      // First, create a test user
      await db.execute(sql`
        INSERT INTO users (id, email)
        VALUES ('test-user-123', 'test@example.com')
        ON CONFLICT (id) DO NOTHING
      `);

      const event = {
        eventName: 'search_performed',
        eventCategory: 'search',
        properties: { query: 'react', resultCount: 10 },
        userId: 'test-user-123',
        sessionId: 'session-456',
        timestamp: new Date(),
      };

      const result = await db.insert(analyticsEvents).values(event).returning();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('test-user-123');
      expect(result[0].eventName).toBe('search_performed');

      // Clean up test user
      await db.execute(sql`DELETE FROM users WHERE id = 'test-user-123'`);
    });

    it('should handle null user_id (anonymous events)', async () => {
      const event = {
        eventName: 'page_view',
        eventCategory: 'navigation',
        properties: { page: '/home' },
        sessionId: 'session-789',
        timestamp: new Date(),
      };

      const result = await db.insert(analyticsEvents).values(event).returning();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBeNull();
      expect(result[0].eventName).toBe('page_view');
    });

    it('should store complex properties as JSONB', async () => {
      const complexProperties = {
        repository: {
          id: 'repo-123',
          name: 'test-repo',
          stars: 1000,
        },
        analysis: {
          scores: {
            originality: 8.5,
            completeness: 9.0,
            marketability: 7.5,
          },
          duration: 2500,
        },
        metadata: {
          browser: 'Chrome',
          os: 'Windows',
        },
      };

      const event = {
        eventName: 'analysis_completed',
        eventCategory: 'analysis',
        properties: complexProperties,
        sessionId: 'session-complex',
        timestamp: new Date(),
      };

      const result = await db.insert(analyticsEvents).values(event).returning();

      expect(result).toHaveLength(1);
      expect(result[0].properties).toEqual(complexProperties);
    });

    it('should query events by event_name efficiently', async () => {
      // Insert multiple events
      const events = [
        {
          eventName: 'repository_analyzed',
          eventCategory: 'analysis',
          properties: { repositoryId: 'repo-1' },
          sessionId: 'session-1',
          timestamp: new Date(),
        },
        {
          eventName: 'repository_analyzed',
          eventCategory: 'analysis',
          properties: { repositoryId: 'repo-2' },
          sessionId: 'session-2',
          timestamp: new Date(),
        },
        {
          eventName: 'search_performed',
          eventCategory: 'search',
          properties: { query: 'test' },
          sessionId: 'session-3',
          timestamp: new Date(),
        },
      ];

      await db.insert(analyticsEvents).values(events);

      const result = await db.execute(sql`
        SELECT * FROM analytics_events
        WHERE event_name = 'repository_analyzed'
      `);

      expect(result.rows.length).toBe(2);
    });

    it('should query events by timestamp range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const events = [
        {
          eventName: 'event_old',
          eventCategory: 'test',
          properties: {},
          sessionId: 'session-old',
          timestamp: twoHoursAgo,
        },
        {
          eventName: 'event_recent',
          eventCategory: 'test',
          properties: {},
          sessionId: 'session-recent',
          timestamp: now,
        },
      ];

      await db.insert(analyticsEvents).values(events);

      const result = await db.execute(sql`
        SELECT * FROM analytics_events
        WHERE timestamp >= ${oneHourAgo}
      `);

      expect(result.rows.length).toBe(1);
      expect((result.rows[0] as any).event_name).toBe('event_recent');
    });

    it('should query events by session_id', async () => {
      const sessionId = 'session-test-123';
      const events = [
        {
          eventName: 'page_view',
          eventCategory: 'navigation',
          properties: { page: '/home' },
          sessionId,
          timestamp: new Date(),
        },
        {
          eventName: 'button_click',
          eventCategory: 'interaction',
          properties: { button: 'analyze' },
          sessionId,
          timestamp: new Date(),
        },
        {
          eventName: 'page_view',
          eventCategory: 'navigation',
          properties: { page: '/search' },
          sessionId: 'different-session',
          timestamp: new Date(),
        },
      ];

      await db.insert(analyticsEvents).values(events);

      const result = await db.execute(sql`
        SELECT * FROM analytics_events
        WHERE session_id = ${sessionId}
      `);

      expect(result.rows.length).toBe(2);
    });
  });

  describe('Database Connection Pooling', () => {
    it('should have connection pool configured', () => {
      expect(pool).toBeDefined();
      // Pool is configured in db.ts with max/min connections
      expect(typeof pool.query).toBe('function');
    });

    it('should handle concurrent queries efficiently', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => 
        db.insert(analyticsEvents).values({
          eventName: `concurrent_event_${i}`,
          eventCategory: 'test',
          properties: { index: i },
          sessionId: `session-concurrent-${i}`,
          timestamp: new Date(),
        })
      );

      const startTime = Date.now();
      await Promise.all(queries);
      const duration = Date.now() - startTime;

      // All queries should complete reasonably fast with connection pooling
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 concurrent queries

      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM analytics_events
        WHERE event_name LIKE 'concurrent_event_%'
      `);

      expect(Number((result.rows[0] as any).count)).toBe(10);
    });

    it('should verify database health check works', async () => {
      const health = await checkDatabaseHealth();

      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback analytics schema successfully', async () => {
      // Rollback
      await rollbackAnalyticsSchema();

      // Verify table doesn't exist
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'analytics_events'
        ) as table_exists
      `);

      expect((result.rows[0] as any).table_exists).toBe(false);

      // Recreate for other tests
      await createAnalyticsSchema();
    });
  });

  describe('Performance Requirements', () => {
    it('should handle 1000 events per minute', async () => {
      const batchSize = 100;
      const events = Array.from({ length: batchSize }, (_, i) => ({
        eventName: 'performance_test',
        eventCategory: 'test',
        properties: { index: i },
        sessionId: `session-perf-${i}`,
        timestamp: new Date(),
      }));

      const startTime = Date.now();
      await db.insert(analyticsEvents).values(events);
      const duration = Date.now() - startTime;

      // Should insert 100 events in less than 6 seconds (to support 1000/min)
      expect(duration).toBeLessThan(6000);

      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM analytics_events
        WHERE event_name = 'performance_test'
      `);

      expect(Number((result.rows[0] as any).count)).toBe(batchSize);
    });

    it('should query events asynchronously without blocking', async () => {
      // Insert test data
      await db.insert(analyticsEvents).values({
        eventName: 'async_test',
        eventCategory: 'test',
        properties: {},
        sessionId: 'session-async',
        timestamp: new Date(),
      });

      const startTime = Date.now();
      
      // Simulate multiple concurrent queries
      const queries = [
        db.execute(sql`SELECT * FROM analytics_events WHERE event_name = 'async_test'`),
        db.execute(sql`SELECT COUNT(*) FROM analytics_events`),
        db.execute(sql`SELECT * FROM analytics_events ORDER BY timestamp DESC LIMIT 10`),
      ];

      const results = await Promise.all(queries);
      const duration = Date.now() - startTime;

      // All queries should complete quickly
      expect(duration).toBeLessThan(1000);
      expect(results).toHaveLength(3);
    });
  });
});
