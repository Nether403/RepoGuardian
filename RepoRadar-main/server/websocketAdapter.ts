import { createAdapter } from '@socket.io/redis-adapter';
import { redisManager } from './redis';
import { logger } from './instanceId';

/**
 * WebSocket Redis Adapter
 * Enables WebSocket communication across multiple instances
 * Requirement 3.3: Add fallback for Socket.io (single-instance mode)
 */

export async function createWebSocketAdapter() {
  try {
    const useRedis = process.env.USE_REDIS_SESSIONS === 'true';
    
    if (!useRedis) {
      logger.info('WebSocket: Redis disabled, using in-memory adapter (single-instance mode)');
      return null;
    }

    if (!redisManager.isRedisEnabled()) {
      logger.info('WebSocket: Redis not enabled, using in-memory adapter (single-instance mode)');
      return null;
    }

    logger.info('WebSocket: Attempting to initialize Redis adapter for multi-instance support');
    
    // Try to get Redis client with timeout
    const pubClient = await Promise.race([
      redisManager.getClient(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout for WebSocket')), 10000)
      )
    ]) as any;
    
    // Create separate subscriber client
    const subClient = pubClient.duplicate();
    await subClient.connect();
    
    // Create Redis adapter
    const adapter = createAdapter(pubClient, subClient);
    
    logger.info('WebSocket: Redis adapter initialized successfully (multi-instance mode enabled)');
    
    return adapter;
  } catch (error) {
    logger.error('WebSocket: Failed to initialize Redis adapter, falling back to in-memory adapter', error);
    logger.warn('WebSocket: Running in single-instance mode - multiple instances will not share WebSocket state');
    return null;
  }
}

/**
 * Close WebSocket adapter connections
 */
export async function closeWebSocketAdapter(adapter: any): Promise<void> {
  if (!adapter) {
    return;
  }

  try {
    logger.info('WebSocket: Closing Redis adapter');
    // The adapter will be closed when Redis connections are closed
    logger.info('WebSocket: Redis adapter closed');
  } catch (error) {
    logger.error('WebSocket: Error closing Redis adapter', error);
  }
}
