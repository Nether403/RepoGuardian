import { createClient, type RedisClientType } from 'redis';
import type { RedisClientOptions } from 'redis';

/**
 * Redis Connection Manager
 * Handles Redis client lifecycle with error handling and reconnection logic
 */
class RedisConnectionManager {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000; // 1 second
  private readonly isEnabled: boolean;

  constructor() {
    // Check if Redis is enabled via environment variables
    this.isEnabled = process.env.USE_REDIS_SESSIONS === 'true' || 
                     process.env.REDIS_ENABLED === 'true' ||
                     (process.env.NODE_ENV === 'production' && !process.env.REDIS_DISABLED);
  }

  /**
   * Check if Redis is enabled
   */
  isRedisEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get or create Redis client
   * Requirement 3.1: Graceful fallback when Redis unavailable
   */
  async getClient(): Promise<ReturnType<typeof createClient>> {
    if (!this.isEnabled) {
      throw new Error('Redis is disabled in configuration');
    }

    if (this.client && this.client.isOpen) {
      return this.client;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      await this.waitForConnection();
      if (this.client && this.client.isOpen) {
        return this.client;
      }
    }

    return this.connect();
  }

  /**
   * Try to get Redis client without throwing errors
   * Returns null if Redis is unavailable
   * Requirement 3.1: Non-blocking Redis access
   */
  async tryGetClient(): Promise<ReturnType<typeof createClient> | null> {
    try {
      if (!this.isEnabled) {
        return null;
      }

      if (this.client && this.client.isOpen) {
        return this.client;
      }

      // Don't wait for connection if already connecting
      if (this.isConnecting) {
        return null;
      }

      return await this.connect();
    } catch (error) {
      console.error('Redis: Failed to get client:', error);
      return null;
    }
  }

  /**
   * Connect to Redis with retry logic
   */
  private async connect(): Promise<ReturnType<typeof createClient>> {
    this.isConnecting = true;

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      // Check if using Upstash (rediss:// protocol)
      const isUpstash = redisUrl.startsWith('rediss://');
      
      const options: RedisClientOptions = {
        url: redisUrl,
        socket: {
          // Increase timeout for Upstash connections
          connectTimeout: 10000,
          // Enable TLS for Upstash
          ...(isUpstash && {
            tls: true,
            rejectUnauthorized: false, // Upstash uses self-signed certs
          }),
          reconnectStrategy: (retries: number) => {
            if (retries > this.maxReconnectAttempts) {
              console.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            
            const delay = Math.min(retries * this.reconnectDelay, 10000);
            console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
        },
      };

      console.log(`Redis: Connecting to ${isUpstash ? 'Upstash' : 'local'} Redis...`);
      this.client = createClient(options);

      // Set up event handlers
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis: Connected');
        this.reconnectAttempts = 0;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        console.log(`Redis: Reconnecting (attempt ${this.reconnectAttempts})`);
      });

      this.client.on('ready', () => {
        console.log('Redis: Ready');
      });

      await this.client.connect();
      this.isConnecting = false;

      return this.client;
    } catch (error) {
      this.isConnecting = false;
      console.error('Redis: Connection failed:', error);
      throw error;
    }
  }

  /**
   * Wait for ongoing connection attempt
   */
  private async waitForConnection(timeout = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (this.isConnecting && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.isEnabled && this.client !== null && this.client.isOpen;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        if (this.client.isOpen) {
          await this.client.quit();
          console.log('Redis: Disconnected');
        }
      } catch (error) {
        console.error('Redis: Error during disconnect:', error);
        // Force close if quit fails
        try {
          if (this.client.isOpen) {
            await this.client.disconnect();
          }
        } catch (disconnectError) {
          // Ignore errors during force disconnect
        }
      }
      this.client = null;
    }
  }

  /**
   * Get Redis client health status
   */
  async getHealthStatus(): Promise<{
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
    message?: string;
  }> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.client.isOpen) {
        return {
          status: 'down',
          responseTime: 0,
          message: 'Redis client not connected',
        };
      }

      // Ping Redis to check health
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 100 ? 'up' : 'degraded',
        responseTime,
        message: responseTime >= 100 ? 'High latency detected' : undefined,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const redisManager = new RedisConnectionManager();

// Export type for use in other modules
export type { RedisClientType };
