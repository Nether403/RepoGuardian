import { sql } from 'drizzle-orm';
import { db, pool } from '../db';

/**
 * Migration script to create analytics_events table
 * This script can be run manually or as part of deployment
 */
export async function createAnalyticsSchema(): Promise<void> {
  console.log('Starting analytics schema migration...');

  try {
    // Create analytics_events table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(255) NOT NULL,
        event_category VARCHAR(100) NOT NULL,
        properties JSONB,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✓ Created analytics_events table');

    // Create indexes for performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_name 
      ON analytics_events(event_name)
    `);
    console.log('✓ Created index on event_name');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp 
      ON analytics_events(timestamp)
    `);
    console.log('✓ Created index on timestamp');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session 
      ON analytics_events(session_id)
    `);
    console.log('✓ Created index on session_id');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_category 
      ON analytics_events(event_category)
    `);
    console.log('✓ Created index on event_category');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user 
      ON analytics_events(user_id)
    `);
    console.log('✓ Created index on user_id');

    console.log('Analytics schema migration completed successfully!');
  } catch (error) {
    console.error('Error during analytics schema migration:', error);
    throw error;
  }
}

/**
 * Rollback function to drop analytics_events table
 */
export async function rollbackAnalyticsSchema(): Promise<void> {
  console.log('Rolling back analytics schema...');

  try {
    await db.execute(sql`DROP TABLE IF EXISTS analytics_events CASCADE`);
    console.log('✓ Dropped analytics_events table');
    console.log('Analytics schema rollback completed successfully!');
  } catch (error) {
    console.error('Error during analytics schema rollback:', error);
    throw error;
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'rollback') {
    rollbackAnalyticsSchema()
      .then(() => {
        console.log('Rollback complete');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    createAnalyticsSchema()
      .then(() => {
        console.log('Migration complete');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}
