import { Pool, PoolClient } from '@neondatabase/serverless';
import { IConnectionPool, ConnectionPoolConfig, ConnectionPoolStats } from './interfaces';

export class ConnectionPool implements IConnectionPool {
  private pool: Pool;
  private config: ConnectionPoolConfig;
  private stats: ConnectionPoolStats;
  private healthCheckInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(connectionString: string, config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      minConnections: 2,
      maxConnections: 10,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 5000,
      healthCheckIntervalMs: 60000,
      maxRetries: 3,
      ...config
    };

    this.pool = new Pool({
      connectionString,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
    });

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquired: 0,
      totalReleased: 0,
    };

    // Set up pool event listeners
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      // Start health check interval
      this.startHealthCheck();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize connection pool: ${error}`);
    }
  }

  async acquire(): Promise<PoolClient> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        const client = await this.pool.connect();
        this.stats.totalAcquired++;
        this.updateConnectionStats();
        return client;
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries) {
          throw new Error(`Failed to acquire connection after ${retries} retries: ${error}`);
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      }
    }
    
    throw new Error('Failed to acquire connection');
  }

  async release(connection: PoolClient): Promise<void> {
    try {
      connection.release();
      this.stats.totalReleased++;
      this.updateConnectionStats();
    } catch (error) {
      console.error('Error releasing connection:', error);
      // Force destroy the connection if release fails
      try {
        connection.release(true); // Force destroy
        this.stats.totalDestroyed++;
        this.updateConnectionStats();
      } catch (destroyError) {
        console.error('Error destroying connection:', destroyError);
      }
    }
  }

  async destroy(connection: PoolClient): Promise<void> {
    try {
      connection.release(true); // Force destroy
      this.stats.totalDestroyed++;
      this.updateConnectionStats();
    } catch (error) {
      console.error('Error destroying connection:', error);
    }
  }

  getStats(): ConnectionPoolStats {
    this.updateConnectionStats();
    return { ...this.stats };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.acquire();
      await client.query('SELECT 1');
      await this.release(client);
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async drain(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    await this.pool.end();
    this.isInitialized = false;
  }

  async clear(): Promise<void> {
    await this.drain();
    this.resetStats();
  }

  private setupEventListeners(): void {
    this.pool.on('connect', () => {
      this.stats.totalCreated++;
      this.updateConnectionStats();
    });

    this.pool.on('remove', () => {
      this.stats.totalDestroyed++;
      this.updateConnectionStats();
    });

    this.pool.on('error', (error) => {
      console.error('Connection pool error:', error);
    });
  }

  private updateConnectionStats(): void {
    // Note: Neon serverless pool doesn't expose detailed stats like totalCount, idleCount, waitingCount
    // We'll track what we can and estimate the rest
    this.stats.totalConnections = this.stats.totalCreated - this.stats.totalDestroyed;
    this.stats.activeConnections = this.stats.totalAcquired - this.stats.totalReleased;
    this.stats.idleConnections = Math.max(0, this.stats.totalConnections - this.stats.activeConnections);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        console.warn('Connection pool health check failed');
      }
    }, this.config.healthCheckIntervalMs);
  }

  private resetStats(): void {
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquired: 0,
      totalReleased: 0,
    };
  }
}