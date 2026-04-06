/**
 * Unit tests for PerformanceErrorHandler
 * Tests error handling, logging, and statistics collection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PerformanceErrorHandler,
  getPerformanceErrorHandler,
  getPerformanceLogger,
} from '../PerformanceErrorHandler';
import {
  PerformanceErrorCategory,
  PerformanceErrorSeverity,
} from '../ErrorHandling';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', mockConsole);

describe('PerformanceErrorHandler', () => {
  let errorHandler: PerformanceErrorHandler;

  beforeEach(() => {
    errorHandler = new PerformanceErrorHandler({
      enableLogging: true,
      logLevel: 'debug',
      maxLogEntries: 100,
      logRetentionMs: 60000,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('should handle errors and update statistics', async () => {
      const testError = new Error('Test database error');
      
      const performanceError = await errorHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.HIGH,
        'connect',
        'ConnectionPool',
        testError,
        { connectionString: 'test://localhost' }
      );

      expect(performanceError).toMatchObject({
        category: PerformanceErrorCategory.DATABASE,
        severity: PerformanceErrorSeverity.HIGH,
        message: 'Test database error',
        operation: 'connect',
        component: 'ConnectionPool',
        metadata: { connectionString: 'test://localhost' },
      });

      expect(performanceError.id).toBeDefined();
      expect(performanceError.timestamp).toBeInstanceOf(Date);
      expect(performanceError.stackTrace).toBeDefined();
      expect(performanceError.recoveryAction).toBeDefined();

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[PerformanceErrorCategory.DATABASE]).toBe(1);
      expect(stats.errorsBySeverity[PerformanceErrorSeverity.HIGH]).toBe(1);
      expect(stats.lastErrorTime).toBeInstanceOf(Date);
    });

    it('should determine appropriate recovery actions', async () => {
      const testError = new Error('Cache failure');
      
      const cacheError = await errorHandler.handleError(
        PerformanceErrorCategory.CACHE,
        PerformanceErrorSeverity.MEDIUM,
        'get',
        'CacheManager',
        testError
      );

      expect(cacheError.recoveryAction).toBe('Fall back to direct data retrieval and attempt cache recovery');

      const compressionError = await errorHandler.handleError(
        PerformanceErrorCategory.COMPRESSION,
        PerformanceErrorSeverity.LOW,
        'compress',
        'CompressionMiddleware',
        testError
      );

      expect(compressionError.recoveryAction).toBe('Fall back to uncompressed response delivery');
    });

    it('should log errors to console', async () => {
      const testError = new Error('Test error');
      
      await errorHandler.handleError(
        PerformanceErrorCategory.GITHUB_API,
        PerformanceErrorSeverity.CRITICAL,
        'request',
        'GitHubOptimizer',
        testError
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[GITHUB_API] GitHubOptimizer.request: Test error'),
        expect.objectContaining({
          severity: PerformanceErrorSeverity.CRITICAL,
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log messages at appropriate levels', async () => {
      await errorHandler.log(
        'info',
        PerformanceErrorCategory.DATABASE,
        'connect',
        'ConnectionPool',
        'Connection established successfully',
        { connectionId: 'conn-123' }
      );

      const logs = errorHandler.getRecentLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: 'info',
        category: PerformanceErrorCategory.DATABASE,
        operation: 'connect',
        component: 'ConnectionPool',
        message: 'Connection established successfully',
        metadata: { connectionId: 'conn-123' },
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[DATABASE] ConnectionPool.connect: Connection established successfully',
        { connectionId: 'conn-123' }
      );
    });

    it('should respect log level configuration', async () => {
      errorHandler.configure({ logLevel: 'warn' });

      await errorHandler.log('debug', PerformanceErrorCategory.CACHE, 'get', 'CacheManager', 'Debug message');
      await errorHandler.log('info', PerformanceErrorCategory.CACHE, 'get', 'CacheManager', 'Info message');
      await errorHandler.log('warn', PerformanceErrorCategory.CACHE, 'get', 'CacheManager', 'Warning message');

      const logs = errorHandler.getRecentLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });

    it('should log fallback activations', async () => {
      await errorHandler.logFallbackActivation(
        PerformanceErrorCategory.DATABASE,
        'ConnectionPool',
        'acquire',
        'Pool exhausted, using direct connection',
        { poolSize: 10, activeConnections: 10 }
      );

      const stats = errorHandler.getStats();
      expect(stats.fallbackActivations).toBe(1);

      const logs = errorHandler.getRecentLogs(10);
      expect(logs[0]).toMatchObject({
        level: 'warn',
        message: 'Fallback activated: Pool exhausted, using direct connection',
        metadata: expect.objectContaining({
          fallbackActivated: true,
          reason: 'Pool exhausted, using direct connection',
        }),
      });
    });

    it('should log recovery attempts', async () => {
      await errorHandler.logRecoveryAttempt(
        PerformanceErrorCategory.CACHE,
        'CacheManager',
        'healthCheck',
        true,
        { recoveryTime: 1500 }
      );

      const stats = errorHandler.getStats();
      expect(stats.recoveryAttempts).toBe(1);
      expect(stats.successfulRecoveries).toBe(1);
      expect(stats.lastRecoveryTime).toBeInstanceOf(Date);

      const logs = errorHandler.getRecentLogs(10);
      expect(logs[0]).toMatchObject({
        level: 'info',
        message: 'Recovery attempt succeeded',
        metadata: expect.objectContaining({
          recoveryAttempt: true,
          success: true,
        }),
      });
    });
  });

  describe('Statistics', () => {
    it('should track error statistics by category and severity', async () => {
      const testError = new Error('Test error');

      await errorHandler.handleError(PerformanceErrorCategory.DATABASE, PerformanceErrorSeverity.HIGH, 'op1', 'comp1', testError);
      await errorHandler.handleError(PerformanceErrorCategory.DATABASE, PerformanceErrorSeverity.MEDIUM, 'op2', 'comp2', testError);
      await errorHandler.handleError(PerformanceErrorCategory.CACHE, PerformanceErrorSeverity.HIGH, 'op3', 'comp3', testError);

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[PerformanceErrorCategory.DATABASE]).toBe(2);
      expect(stats.errorsByCategory[PerformanceErrorCategory.CACHE]).toBe(1);
      expect(stats.errorsBySeverity[PerformanceErrorSeverity.HIGH]).toBe(2);
      expect(stats.errorsBySeverity[PerformanceErrorSeverity.MEDIUM]).toBe(1);
    });

    it('should provide recent errors and logs', async () => {
      const testError = new Error('Test error');

      // Add multiple errors
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(
          PerformanceErrorCategory.DATABASE,
          PerformanceErrorSeverity.MEDIUM,
          `operation${i}`,
          'TestComponent',
          testError
        );
      }

      const recentErrors = errorHandler.getRecentErrors(3);
      expect(recentErrors).toHaveLength(3);
      expect(recentErrors[0].timestamp.getTime()).toBeGreaterThanOrEqual(recentErrors[1].timestamp.getTime());
    });
  });

  describe('Cleanup', () => {
    it('should clean up old entries based on retention policy', async () => {
      const testError = new Error('Test error');
      
      // Create error handler with short retention
      const shortRetentionHandler = new PerformanceErrorHandler({
        logRetentionMs: 100, // 100ms retention
      });

      await shortRetentionHandler.handleError(
        PerformanceErrorCategory.DATABASE,
        PerformanceErrorSeverity.MEDIUM,
        'test',
        'TestComponent',
        testError
      );

      await shortRetentionHandler.log('info', PerformanceErrorCategory.DATABASE, 'test', 'TestComponent', 'Test message');

      expect(shortRetentionHandler.getRecentErrors()).toHaveLength(1);
      expect(shortRetentionHandler.getRecentLogs()).toHaveLength(2); // Error creates a log entry too

      // Wait for retention period to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleanedCount = await shortRetentionHandler.cleanup();
      expect(cleanedCount).toBeGreaterThan(0);
      expect(shortRetentionHandler.getRecentErrors()).toHaveLength(0);
    });

    it('should trim entries when max limit is exceeded', async () => {
      const smallLimitHandler = new PerformanceErrorHandler({
        maxLogEntries: 3,
      });

      const testError = new Error('Test error');

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        await smallLimitHandler.handleError(
          PerformanceErrorCategory.DATABASE,
          PerformanceErrorSeverity.MEDIUM,
          `operation${i}`,
          'TestComponent',
          testError
        );
      }

      const errors = smallLimitHandler.getRecentErrors();
      expect(errors.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Logger Integration', () => {
    it('should provide a logger instance', () => {
      const logger = errorHandler.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.timing).toBe('function');
      expect(typeof logger.createTimer).toBe('function');
    });

    it('should create and use operation timers', async () => {
      const logger = errorHandler.getLogger();
      const timer = logger.createTimer(
        PerformanceErrorCategory.DATABASE,
        'TestComponent',
        'testOperation'
      );

      expect(timer.getElapsed()).toBeGreaterThanOrEqual(0);

      await timer.end({ testMetadata: 'value' });

      const logs = errorHandler.getRecentLogs(10);
      expect(logs[0]).toMatchObject({
        level: 'info',
        category: PerformanceErrorCategory.DATABASE,
        component: 'TestComponent',
        operation: 'testOperation',
        metadata: expect.objectContaining({
          testMetadata: 'value',
          duration: expect.any(Number),
        }),
      });
    });

    it('should handle timer errors', async () => {
      const logger = errorHandler.getLogger();
      const timer = logger.createTimer(
        PerformanceErrorCategory.CACHE,
        'TestComponent',
        'failingOperation'
      );

      const testError = new Error('Operation failed');
      await timer.endWithError(testError, { context: 'test' });

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: PerformanceErrorCategory.CACHE,
        severity: PerformanceErrorSeverity.HIGH,
        operation: 'failingOperation',
        component: 'TestComponent',
        message: expect.stringContaining('Operation failed'),
      });
    });
  });

  describe('Global Instance', () => {
    it('should provide global error handler instance', () => {
      const globalHandler1 = getPerformanceErrorHandler();
      const globalHandler2 = getPerformanceErrorHandler();
      
      expect(globalHandler1).toBe(globalHandler2);
    });

    it('should provide global logger instance', () => {
      const globalLogger1 = getPerformanceLogger();
      const globalLogger2 = getPerformanceLogger();
      
      expect(globalLogger1).toBe(globalLogger2);
    });
  });
});