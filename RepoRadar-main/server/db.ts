import dotenv from 'dotenv';
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Connection pool configuration for scalability
// Production-appropriate settings for Render deployment
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Production defaults: smaller pool for serverless, larger for dedicated instances
  max: parseInt(process.env.DB_POOL_MAX || (isProduction ? '10' : '20'), 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  // Shorter idle timeout in production to free up connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || (isProduction ? '30000' : '60000'), 10),
  // Shorter connection timeout in production for faster failure detection
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || (isProduction ? '5000' : '10000'), 10),
  // SSL configuration for production (Neon requires SSL)
  ssl: isProduction ? { rejectUnauthorized: true } : undefined,
};

export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Graceful shutdown handler
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

export const db = drizzle({ client: pool, schema });

// Health check function for database connectivity
// Requirement 2.3: Verify database connectivity via health checks
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  details?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  const startTime = Date.now();
  try {
    // Test database connectivity with a simple query
    await pool.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    // Get connection pool statistics
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
    
    return {
      status: 'healthy',
      responseTime,
      poolStats,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      responseTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}