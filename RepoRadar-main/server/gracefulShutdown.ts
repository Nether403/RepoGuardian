import type { Server } from 'http';

/**
 * Graceful Shutdown Handler
 * Handles clean shutdown of the application with connection draining
 */

interface ShutdownOptions {
  timeout?: number; // Maximum time to wait for connections to close (ms)
  logger?: (message: string) => void;
}

class GracefulShutdownHandler {
  private isShuttingDown = false;
  private activeConnections = new Set<any>();
  private server: Server | null = null;

  /**
   * Initialize graceful shutdown handler
   */
  initialize(server: Server, options: ShutdownOptions = {}): void {
    this.server = server;
    const timeout = options.timeout || 30000; // 30 seconds default
    const logger = options.logger || console.log;

    // Track active connections
    server.on('connection', (connection) => {
      this.activeConnections.add(connection);
      
      connection.on('close', () => {
        this.activeConnections.delete(connection);
      });
    });

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger(`Already shutting down, ignoring ${signal}`);
        return;
      }

      this.isShuttingDown = true;
      logger(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(() => {
        logger('HTTP server closed');
      });

      // Set timeout for forced shutdown
      const forceShutdownTimer = setTimeout(() => {
        logger(`Shutdown timeout reached (${timeout}ms), forcing shutdown`);
        this.forceShutdown();
        process.exit(1);
      }, timeout);

      try {
        // Step 1: Close WebSocket connections (notify clients first)
        await this.closeWebSockets(logger);

        // Step 2: Stop accepting new jobs and wait for active jobs
        await this.closeJobQueue(logger);

        // Step 3: Drain HTTP connections
        await this.drainConnections(logger);

        // Step 4: Close cache service
        await this.closeCache(logger);

        // Step 5: Close database connections
        await this.closeDatabase(logger);

        // Step 6: Close Redis connection (last, as it's used by other services)
        await this.closeRedis(logger);

        clearTimeout(forceShutdownTimer);
        logger('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger(`Error during shutdown: ${error}`);
        clearTimeout(forceShutdownTimer);
        this.forceShutdown();
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger(`Uncaught exception: ${error}`);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger(`Unhandled rejection: ${reason}`);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Drain active connections
   */
  private async drainConnections(logger: (message: string) => void): Promise<void> {
    if (this.activeConnections.size === 0) {
      logger('No active connections to drain');
      return;
    }

    logger(`Draining ${this.activeConnections.size} active connections...`);

    // Wait for connections to close naturally
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.activeConnections.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeConnections.size > 0) {
      logger(`${this.activeConnections.size} connections still active, closing forcefully`);
      this.activeConnections.forEach(connection => {
        try {
          connection.destroy();
        } catch (error) {
          // Ignore errors during force close
        }
      });
    }

    logger('Connection draining complete');
  }

  /**
   * Close WebSocket connections
   */
  private async closeWebSockets(logger: (message: string) => void): Promise<void> {
    try {
      logger('Closing WebSocket connections...');
      
      // Check if server has WebSocket server attached
      if (this.server && (this.server as any).wss) {
        const wss = (this.server as any).wss;
        
        logger(`Closing ${wss.clients.size} active WebSocket connections...`);
        
        // Notify all connected clients about shutdown
        wss.clients.forEach((ws: any) => {
          try {
            if (ws.readyState === 1) { // OPEN state
              ws.send(JSON.stringify({
                type: 'server_shutdown',
                message: 'Server is shutting down for maintenance',
                timestamp: new Date().toISOString()
              }));
              ws.close(1001, 'Server shutting down'); // 1001 = Going Away
            }
          } catch (error) {
            // Ignore errors when closing individual connections
          }
        });
        
        // Close the WebSocket server
        await new Promise<void>((resolve) => {
          wss.close(() => {
            logger('WebSocket server closed');
            resolve();
          });
        });
      } else {
        logger('No WebSocket server found, skipping');
      }
      
      logger('WebSocket connections closed');
    } catch (error) {
      logger(`Error closing WebSocket connections: ${error}`);
      // Don't throw error to prevent shutdown failure
    }
  }

  /**
   * Close database connections
   */
  private async closeDatabase(logger: (message: string) => void): Promise<void> {
    try {
      logger('Closing database connections...');
      const { closePool } = await import('./db.js');
      await closePool();
      logger('Database connections closed');
    } catch (error) {
      logger(`Error closing database: ${error}`);
      // Don't throw error to prevent shutdown failure
    }
  }

  /**
   * Close cache service
   */
  private async closeCache(logger: (message: string) => void): Promise<void> {
    try {
      logger('Shutting down cache service...');
      const { cacheService } = await import('./cache.js');
      await cacheService.shutdown();
      logger('Cache service shutdown complete');
    } catch (error) {
      logger(`Error shutting down cache: ${error}`);
      // Don't throw error to prevent shutdown failure
    }
  }

  /**
   * Close job queue (stops workers and waits for active jobs)
   */
  private async closeJobQueue(logger: (message: string) => void): Promise<void> {
    try {
      logger('Closing job queue...');
      const { jobQueue } = await import('./jobs/JobQueue.js');
      
      // Close will wait for active jobs to complete
      await jobQueue.close();
      logger('Job queue closed (active jobs completed)');
    } catch (error) {
      logger(`Error closing job queue: ${error}`);
      // Don't throw error to prevent shutdown failure
    }
  }

  /**
   * Close Redis connection
   */
  private async closeRedis(logger: (message: string) => void): Promise<void> {
    try {
      logger('Closing Redis connection...');
      const { redisManager } = await import('./redis.js');
      
      if (!redisManager.isRedisEnabled()) {
        logger('Redis is disabled, skipping disconnect');
        return;
      }
      
      await redisManager.disconnect();
      logger('Redis connection closed');
    } catch (error) {
      logger(`Error closing Redis: ${error}`);
      // Don't throw error to prevent shutdown failure
    }
  }

  /**
   * Force shutdown by destroying all connections
   */
  private forceShutdown(): void {
    this.activeConnections.forEach(connection => {
      try {
        connection.destroy();
      } catch (error) {
        // Ignore errors during force close
      }
    });
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

// Export singleton instance
export const gracefulShutdown = new GracefulShutdownHandler();
