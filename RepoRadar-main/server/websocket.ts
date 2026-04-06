import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Repository, RepositoryAnalysis, User } from '@shared/schema';
import { createWebSocketAdapter } from './websocketAdapter';
import { logger } from './instanceId';

export class WebSocketService {
  private io: SocketIOServer;
  private isInitialized = false;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.FRONTEND_URL || 'https://your-domain.replit.app']
          : ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000"],
        credentials: true
      }
    });

    // Initialize adapter and handlers asynchronously
    this.initialize();
  }

  private async initialize() {
    try {
      // Set up Redis adapter for multi-instance support
      const adapter = await createWebSocketAdapter();
      if (adapter) {
        this.io.adapter(adapter);
        logger.info('WebSocket: Multi-instance support enabled');
      }

      this.setupSocketHandlers();
      this.isInitialized = true;
      logger.info('WebSocket: Service initialized');
    } catch (error) {
      logger.error('WebSocket: Initialization error', error);
      // Continue with in-memory adapter
      this.setupSocketHandlers();
      this.isInitialized = true;
    }
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Authentication
      socket.on('authenticate', (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          logger.info(`User ${userId} authenticated with socket ${socket.id}`);
          
          // Send initial connection confirmation
          socket.emit('authenticated', { userId, socketId: socket.id });
        }
      });

      // Repository tracking
      socket.on('track_repository', (repositoryId: string) => {
        socket.join(`repository:${repositoryId}`);
        logger.debug(`Socket ${socket.id} tracking repository ${repositoryId}`);
      });

      socket.on('untrack_repository', (repositoryId: string) => {
        socket.leave(`repository:${repositoryId}`);
        logger.debug(`Socket ${socket.id} stopped tracking repository ${repositoryId}`);
      });

      // Analysis tracking
      socket.on('track_analysis', (analysisId: string) => {
        socket.join(`analysis:${analysisId}`);
        logger.debug(`Socket ${socket.id} tracking analysis ${analysisId}`);
      });

      // Heartbeat for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  // Notification methods
  notifyUser(userId: string, event: string, data: unknown) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  notifyRepositoryWatchers(repositoryId: string, event: string, data: unknown) {
    this.io.to(`repository:${repositoryId}`).emit(event, data);
  }

  notifyAnalysisWatchers(analysisId: string, event: string, data: unknown) {
    this.io.to(`analysis:${analysisId}`).emit(event, data);
  }

  broadcastToAll(event: string, data: unknown) {
    this.io.emit(event, data);
  }

  // Analysis progress updates
  notifyAnalysisProgress(analysisId: string, progress: {
    stage: string;
    percentage: number;
    message: string;
  }) {
    this.notifyAnalysisWatchers(analysisId, 'analysis_progress', {
      analysisId,
      ...progress,
      timestamp: new Date().toISOString()
    });
  }

  // Repository updates
  notifyRepositoryUpdate(repositoryId: string, update: {
    type: 'stars' | 'forks' | 'commits' | 'issues';
    oldValue: number;
    newValue: number;
  }) {
    this.notifyRepositoryWatchers(repositoryId, 'repository_update', {
      repositoryId,
      ...update,
      timestamp: new Date().toISOString()
    });
  }

  // System notifications
  notifySystemAlert(severity: 'info' | 'warning' | 'error', message: string, data?: unknown) {
    this.broadcastToAll('system_alert', {
      severity,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // User activity notifications
  notifyNewAnalysis(userId: string, analysis: { id: string; repositoryName: string; overallScore: number }) {
    this.notifyUser(userId, 'new_analysis', {
      type: 'analysis_completed',
      analysis,
      timestamp: new Date().toISOString()
    });
  }

  notifyCollaborationUpdate(userIds: string[], update: {
    type: 'shared' | 'unshared' | 'comment' | 'review';
    data: unknown;
  }) {
    userIds.forEach(userId => {
      this.notifyUser(userId, 'collaboration_update', {
        ...update,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Get connection status (works across instances with Redis adapter)
  async getConnectedUsers(): Promise<string[]> {
    try {
      const rooms = await this.io.in('user:').allSockets();
      return Array.from(rooms)
        .filter(room => room.startsWith('user:'))
        .map(room => room.replace('user:', ''));
    } catch (error) {
      logger.error('Error getting connected users', error);
      return [];
    }
  }

  async isUserConnected(userId: string): Promise<boolean> {
    try {
      const sockets = await this.io.in(`user:${userId}`).allSockets();
      return sockets.size > 0;
    } catch (error) {
      logger.error('Error checking user connection', error);
      return false;
    }
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}