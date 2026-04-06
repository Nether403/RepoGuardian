import { Pool, PoolClient } from '@neondatabase/serverless';
import { IConnectionPool, ConnectionPoolConfig, ConnectionPoolStats } from './interfaces';

/**
 * Configuration for database fallback behavior
 */
export interface DatabaseFallbackConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  enableDirectConnection: boolean;
  enablePoolRecreation: boolean;
  healthCheckIntervalMs: number;
  poolRecreationDelayMs: number;
  directConnectionTimeoutMs: number;
}

/**
 * Statistics for database fallback operations
 */
export interface DatabaseFallbackStats {
  totalOperations: number;
  fallbackOperations: number;
  poolRecreations: number;
  successfulRecreations: number;
  currentlyUsingFallback: boolean;
  lastPoolFailureTime: Date | null;
  lastRecreationTime: Date | null;
  directConnectionsUsed: number;
}

/**
 * Database connection manager that provides graceful degradation and recovery
 * for connection pool failures with direct connection fallback
 */
export class DatabaseFallbackManager implements IConnectionPool {
  private primaryPool: IConnectionPool;
  private connectionString: string;
  private poolConfig: Partial<ConnectionPoolConfig>;
  private config: DatabaseFallbackConfig;
  private stats: DatabaseFallbackStats;
  private isPoolHealthy = true;
  private recoveryTimer?: NodeJS.Timeout;
  private lastHealthCheck = new Date();
  private directPool?: Pool;

  constructor(
    primaryPool: IConnectionPool,
    connectionString: string,
    poolConfig?: Partial<ConnectionPoolConfig>,
    config?: Partial<DatabaseFallbackConfig>
  ) {
    this.primaryPool = primaryPool;
    this.connectionString = connectionString;
    this.poolConfig = poolConfig || {};
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitterFactor: 0.1,
      enableDirectConnection: true,
      enablePoolRecreation: true,
      healthCheckIntervalMs: 60000,
      poolRecreationDelayMs: 5000,
      directConnectionTimeoutMs: 10000,
      ...config,
    };
    this.stats = {
      totalOperations: 0,
      fallbackOperations: 0,
      poolRecreations: 0,
      successfulRecreations: 0,
      currentlyUsingFallback: false,
      lastPoolFailureTime: null,
      lastRecreationTime: null,
      directConnectionsUsed: 0,
    };

    if (this.config.enablePoolRecreation) {
      this.startRecoveryProcess();
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.primaryPool.initialize();
    } catch (error) {
      await this.handlePoolFailure('initialize', error);
      if (this.config.enableDirectConnection) {
        await this.initializeDirectConnection();
      } else {
        throw error;
      }
    }
  }

  async acquire(): Promise<PoolClient> {
    this.stats.totalOperations++;

    if (!this.isPoolHealthy) {
      return await this.fallbackAcquire();
    }

    try {
      return await this.executeWithRetry(() => this.primaryPool.acquire());
    } catch (error) {
      await this.handlePoolFailure('acquire', error);
      return await this.fallbackAcquire();
    }
  }

  async release(connection: PoolClient): Promise<void> {
    if (!this.isPoolHealthy && this.directPool) {
      // If using direct connection, just release it
      try {
        connection.release();
      } catch (error) {
        // Force destroy if release fails
        try {
          connection.release(true);
        } catch (destroyError) {
          // Ignore destroy errors for direct connections
        }
      }
      return;
    }

    try {
      await this.executeWithRetry(() => this.primaryPool.release(connection));
    } catch (error) {
      await this.handlePoolFailure('release', error);
      // Try to release directly as fallback
      try {
        connection.release();
      } catch (releaseError) {
        try {
          connection.release(true); // Force destroy
        } catch (destroyError) {
          // Ignore final destroy errors
        }
      }
    }
  }

  async destroy(connection: PoolClient): Promise<void> {
    if (!this.isPoolHealthy && this.directPool) {
      // If using direct connection, force destroy it
      try {
        connection.release(true);
      } catch (error) {
        // Ignore destroy errors for direct connections
      }
      return;
    }

    try {
      await this.executeWithRetry(() => this.primaryPool.destroy(connection));
    } catch (error) {
      await this.handlePoolFailure('destroy', error);
      // Try to destroy directly as fallback
      try {
        connection.release(true);
      } catch (destroyError) {
        // Ignore destroy errors
      }
    }
  }

  getStats(): ConnectionPoolStats {
    if (!this.isPoolHealthy) {
      // Return minimal stats when pool is unhealthy
      return {
        totalConnections: this.stats.directConnectionsUsed,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        totalCreated: this.stats.directConnectionsUsed,
        totalDestroyed: 0,
        totalAcquired: this.stats.directConnectionsUsed,
        totalReleased: this.stats.directConnectionsUsed,
      };
    }

    try {
      return this.primaryPool.getStats();
    } catch (error) {
      return {
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

  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.primaryPool.healthCheck();
      
      if (!this.isPoolHealthy && isHealthy) {
        // Pool recovered
        this.isPoolHealthy = true;
        this.stats.successfulRecreations++;
        this.stats.lastRecreationTime = new Date();
        this.stats.currentlyUsingFallback = false;
        
        // Clean up direct connection pool if it exists
        if (this.directPool) {
          try {
            await this.directPool.end();
          } catch (error) {
            // Ignore cleanup errors
          }
          this.directPool = undefined;
        }
      }
      
      this.lastHealthCheck = new Date();
      return isHealthy;
    } catch (error) {
      if (this.isPoolHealthy) {
        await this.handlePoolFailure('healthCheck', error);
      }
      return false;
    }
  }

  async drain(): Promise<void> {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }

    if (this.directPool) {
      try {
        await this.directPool.end();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.directPool = undefined;
    }

    if (this.isPoolHealthy) {
      try {
        await this.primaryPool.drain();
      } catch (error) {
        // Ignore drain errors during cleanup
      }
    }
  }

  async clear(): Promise<void> {
    await this.drain();
    
    if (this.isPoolHealthy) {
      try {
        await this.primaryPool.clear();
      } catch (error) {
        // Ignore clear errors during cleanup
      }
    }
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(): DatabaseFallbackStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger pool recreation
   */
  async recreatePool(): Promise<boolean> {
    if (!this.config.enablePoolRecreation) {
      return false;
    }

    this.stats.poolRecreations++;

    try {
      // Try to reinitialize the primary pool
      await this.primaryPool.clear();
      await this.primaryPool.initialize();
      
      // Test the pool with a health check
      const isHealthy = await this.primaryPool.healthCheck();
      
      if (isHealthy) {
        this.isPoolHealthy = true;
        this.stats.successfulRecreations++;
        this.stats.lastRecreationTime = new Date();
        this.stats.currentlyUsingFallback = false;
        
        // Clean up direct connection pool
        if (this.directPool) {
          try {
            await this.directPool.end();
          } catch (error) {
            // Ignore cleanup errors
          }
          this.directPool = undefined;
        }
        
        return true;
      }
    } catch (error) {
      // Pool recreation failed
    }

    return false;
  }

  /**
   * Cleanup the fallback manager and destroy resources
   */
  cleanup(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError!;
  }

  private async fallbackAcquire(): Promise<PoolClient> {
    this.stats.fallbackOperations++;

    if (this.config.enableDirectConnection) {
      try {
        if (!this.directPool) {
          await this.initializeDirectConnection();
        }
        
        if (this.directPool) {
          const connection = await this.directPool.connect();
          this.stats.directConnectionsUsed++;
          return connection;
        }
      } catch (error) {
        // Direct connection also failed
        throw new Error(`Both pool and direct connection failed: ${error}`);
      }
    }

    throw new Error('Connection pool is unhealthy and direct connection is disabled');
  }

  private async initializeDirectConnection(): Promise<void> {
    if (this.directPool) {
      return;
    }

    this.directPool = new Pool({
      connectionString: this.connectionString,
      max: 1, // Single connection for fallback
      idleTimeoutMillis: this.config.directConnectionTimeoutMs,
      connectionTimeoutMillis: this.config.directConnectionTimeoutMs,
    });

    // Test the direct connection
    const testConnection = await this.directPool.connect();
    await testConnection.query('SELECT 1');
    testConnection.release();
  }

  private async handlePoolFailure(operation: string, error: any): Promise<void> {
    if (this.isPoolHealthy) {
      this.isPoolHealthy = false;
      this.stats.currentlyUsingFallback = true;
      this.stats.lastPoolFailureTime = new Date();
    }

    // Log the failure (in a real implementation, use proper logging)
    console.warn(`Database pool operation '${operation}' failed, falling back:`, error.message);
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.baseDelayMs * Math.pow(2, attempt);
    const jitter = baseDelay * this.config.jitterFactor * Math.random();
    const delay = Math.min(baseDelay + jitter, this.config.maxDelayMs);
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startRecoveryProcess(): void {
    this.recoveryTimer = setInterval(async () => {
      if (!this.isPoolHealthy) {
        // Wait before attempting recreation
        const timeSinceFailure = Date.now() - (this.stats.lastPoolFailureTime?.getTime() || 0);
        if (timeSinceFailure >= this.config.poolRecreationDelayMs) {
          await this.recreatePool();
        }
      }
    }, this.config.healthCheckIntervalMs);
  }
}

/**
 * Factory function to create a database fallback manager
 */
export function createDatabaseFallbackManager(
  primaryPool: IConnectionPool,
  connectionString: string,
  poolConfig?: Partial<ConnectionPoolConfig>,
  config?: Partial<DatabaseFallbackConfig>
): DatabaseFallbackManager {
  return new DatabaseFallbackManager(primaryPool, connectionString, poolConfig, config);
}