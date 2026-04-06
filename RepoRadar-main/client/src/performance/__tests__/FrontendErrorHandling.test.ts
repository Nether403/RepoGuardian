/**
 * Unit tests for FrontendPerformanceErrorHandler
 * Tests frontend error handling, logging, and statistics collection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  FrontendPerformanceErrorHandler,
  getFrontendPerformanceErrorHandler,
  getFrontendPerformanceLogger,
} from '../FrontendErrorHandling';
import {
  FrontendPerformanceErrorCategory,
  FrontendPerformanceErrorSeverity,
} from '../FrontendErrorHandling';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
};

// Mock navigator
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
};

// Mock window
const mockWindow = {
  location: {
    href: 'https://test.example.com/page',
  },
};

// Mock fetch for remote logging
const mockFetch = vi.fn();

vi.stubGlobal('console', mockConsole);
vi.stubGlobal('performance', mockPerformance);
vi.stubGlobal('navigator', mockNavigator);
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('fetch', mockFetch);

describe('FrontendPerformanceErrorHandler', () => {
  let errorHandler: FrontendPerformanceErrorHandler;

  beforeEach(() => {
    errorHandler = new FrontendPerformanceErrorHandler({
      enableLogging: true,
      logLevel: 'debug',
      maxLogEntries: 100,
      logRetentionMs: 60000,
      enableConsoleLogging: true,
      enableRemoteLogging: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('should handle errors and update statistics', async () => {
      const testError = new Error('Test code splitting error');
      
      const performanceError = await errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.HIGH,
        'loadChunk',
        'CodeSplitter',
        testError,
        { chunkName: 'test-chunk' }
      );

      expect(performanceError).toMatchObject({
        category: FrontendPerformanceErrorCategory.CODE_SPLITTING,
        severity: FrontendPerformanceErrorSeverity.HIGH,
        message: 'Test code splitting error',
        operation: 'loadChunk',
        component: 'CodeSplitter',
        metadata: { chunkName: 'test-chunk' },
        userAgent: 'Mozilla/5.0 (Test Browser)',
        url: 'https://test.example.com/page',
      });

      expect(performanceError.id).toBeDefined();
      expect(performanceError.timestamp).toBeInstanceOf(Date);
      expect(performanceError.stackTrace).toBeDefined();
      expect(performanceError.recoveryAction).toBeDefined();

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[FrontendPerformanceErrorCategory.CODE_SPLITTING]).toBe(1);
      expect(stats.errorsBySeverity[FrontendPerformanceErrorSeverity.HIGH]).toBe(1);
      expect(stats.lastErrorTime).toBeInstanceOf(Date);
      expect(stats.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    });

    it('should determine appropriate recovery actions for different categories', async () => {
      const testError = new Error('Test error');
      
      const codeSplittingError = await errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'loadChunk',
        'CodeSplitter',
        testError
      );

      expect(codeSplittingError.recoveryAction).toBe('Fall back to synchronous component loading');

      const lazyLoadingError = await errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'loadComponent',
        'LazyLoader',
        testError
      );

      expect(lazyLoadingError.recoveryAction).toBe('Fall back to immediate component rendering');

      const bundleOptimizationError = await errorHandler.handleError(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        FrontendPerformanceErrorSeverity.LOW,
        'analyze',
        'BundleOptimizer',
        testError
      );

      expect(bundleOptimizationError.recoveryAction).toBe('Continue with unoptimized bundle loading');
    });

    it('should log errors to console when enabled', async () => {
      const testError = new Error('Test error');
      
      await errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.CRITICAL,
        'loadComponent',
        'LazyLoader',
        testError
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[LAZY_LOADING] LazyLoader.loadComponent: Test error'),
        expect.objectContaining({
          severity: FrontendPerformanceErrorSeverity.CRITICAL,
        })
      );
    });

    it('should not log to console when disabled', async () => {
      errorHandler.configure({ enableConsoleLogging: false });
      
      const testError = new Error('Test error');
      await errorHandler.handleError(
        FrontendPerformanceErrorCategory.CACHING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'store',
        'CacheManager',
        testError
      );

      expect(mockConsole.error).not.toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log messages at appropriate levels', async () => {
      await errorHandler.log(
        'info',
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        'loadChunk',
        'CodeSplitter',
        'Chunk loaded successfully',
        { chunkName: 'test-chunk', size: 1024 }
      );

      const logs = errorHandler.getRecentLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: 'info',
        category: FrontendPerformanceErrorCategory.CODE_SPLITTING,
        operation: 'loadChunk',
        component: 'CodeSplitter',
        message: 'Chunk loaded successfully',
        metadata: { chunkName: 'test-chunk', size: 1024 },
        userAgent: 'Mozilla/5.0 (Test Browser)',
        url: 'https://test.example.com/page',
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CODE_SPLITTING] CodeSplitter.loadChunk: Chunk loaded successfully',
        { chunkName: 'test-chunk', size: 1024 }
      );
    });

    it('should respect log level configuration', async () => {
      errorHandler.configure({ logLevel: 'warn' });

      await errorHandler.log('debug', FrontendPerformanceErrorCategory.CACHING, 'get', 'CacheManager', 'Debug message');
      await errorHandler.log('info', FrontendPerformanceErrorCategory.CACHING, 'get', 'CacheManager', 'Info message');
      await errorHandler.log('warn', FrontendPerformanceErrorCategory.CACHING, 'get', 'CacheManager', 'Warning message');

      const logs = errorHandler.getRecentLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });

    it('should log fallback activations', async () => {
      await errorHandler.logFallbackActivation(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        'CodeSplitter',
        'loadChunk',
        'Network timeout, using synchronous loading',
        { chunkName: 'test-chunk', timeout: 5000 }
      );

      const stats = errorHandler.getStats();
      expect(stats.fallbackActivations).toBe(1);

      const logs = errorHandler.getRecentLogs(10);
      expect(logs[0]).toMatchObject({
        level: 'warn',
        message: 'Fallback activated: Network timeout, using synchronous loading',
        metadata: expect.objectContaining({
          fallbackActivated: true,
          reason: 'Network timeout, using synchronous loading',
        }),
      });
    });

    it('should not log fallback activations when disabled', async () => {
      errorHandler.configure({ enableFallbackLogging: false });

      await errorHandler.logFallbackActivation(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        'LazyLoader',
        'loadComponent',
        'Component load failed',
        { componentId: 'test-component' }
      );

      const stats = errorHandler.getStats();
      expect(stats.fallbackActivations).toBe(0);

      const logs = errorHandler.getRecentLogs(10);
      expect(logs).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should track error statistics by category and severity', async () => {
      const testError = new Error('Test error');

      await errorHandler.handleError(FrontendPerformanceErrorCategory.CODE_SPLITTING, FrontendPerformanceErrorSeverity.HIGH, 'op1', 'comp1', testError);
      await errorHandler.handleError(FrontendPerformanceErrorCategory.CODE_SPLITTING, FrontendPerformanceErrorSeverity.MEDIUM, 'op2', 'comp2', testError);
      await errorHandler.handleError(FrontendPerformanceErrorCategory.LAZY_LOADING, FrontendPerformanceErrorSeverity.HIGH, 'op3', 'comp3', testError);

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[FrontendPerformanceErrorCategory.CODE_SPLITTING]).toBe(2);
      expect(stats.errorsByCategory[FrontendPerformanceErrorCategory.LAZY_LOADING]).toBe(1);
      expect(stats.errorsBySeverity[FrontendPerformanceErrorSeverity.HIGH]).toBe(2);
      expect(stats.errorsBySeverity[FrontendPerformanceErrorSeverity.MEDIUM]).toBe(1);
    });

    it('should provide recent errors and logs sorted by timestamp', async () => {
      const testError = new Error('Test error');

      // Add multiple errors with slight delays
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(
          FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
          FrontendPerformanceErrorSeverity.MEDIUM,
          `operation${i}`,
          'TestComponent',
          testError
        );
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const recentErrors = errorHandler.getRecentErrors(3);
      expect(recentErrors).toHaveLength(3);
      expect(recentErrors[0].timestamp.getTime()).toBeGreaterThanOrEqual(recentErrors[1].timestamp.getTime());
      expect(recentErrors[1].timestamp.getTime()).toBeGreaterThanOrEqual(recentErrors[2].timestamp.getTime());
    });

    it('should include session information in statistics', () => {
      const stats = errorHandler.getStats();
      expect(stats.sessionStartTime).toBeInstanceOf(Date);
      expect(stats.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    });
  });

  describe('Cleanup', () => {
    it('should clean up old entries based on retention policy', async () => {
      const testError = new Error('Test error');
      
      // Create error handler with short retention
      const shortRetentionHandler = new FrontendPerformanceErrorHandler({
        logRetentionMs: 100, // 100ms retention
      });

      await shortRetentionHandler.handleError(
        FrontendPerformanceErrorCategory.CACHING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'test',
        'TestComponent',
        testError
      );

      await shortRetentionHandler.log('info', FrontendPerformanceErrorCategory.CACHING, 'test', 'TestComponent', 'Test message');

      expect(shortRetentionHandler.getRecentErrors()).toHaveLength(1);
      expect(shortRetentionHandler.getRecentLogs()).toHaveLength(2); // Error creates a log entry too

      // Wait for retention period to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleanedCount = await shortRetentionHandler.cleanup();
      expect(cleanedCount).toBeGreaterThan(0);
      expect(shortRetentionHandler.getRecentErrors()).toHaveLength(0);
    });

    it('should trim entries when max limit is exceeded', async () => {
      const smallLimitHandler = new FrontendPerformanceErrorHandler({
        maxLogEntries: 3,
      });

      const testError = new Error('Test error');

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        await smallLimitHandler.handleError(
          FrontendPerformanceErrorCategory.FALLBACK,
          FrontendPerformanceErrorSeverity.MEDIUM,
          `operation${i}`,
          'TestComponent',
          testError
        );
      }

      const errors = smallLimitHandler.getRecentErrors();
      expect(errors.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Remote Logging', () => {
    it('should send logs to remote endpoint when enabled', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      
      errorHandler.configure({
        enableRemoteLogging: true,
        remoteLoggingEndpoint: 'https://api.example.com/logs',
      });

      const testError = new Error('Test error');
      await errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.HIGH,
        'loadChunk',
        'CodeSplitter',
        testError
      );

      await errorHandler.sendLogsToRemote();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/logs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"errors"'),
        })
      );
    });

    it('should not send logs when remote logging is disabled', async () => {
      errorHandler.configure({ enableRemoteLogging: false });

      await errorHandler.sendLogsToRemote();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle remote logging failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      errorHandler.configure({
        enableRemoteLogging: true,
        remoteLoggingEndpoint: 'https://api.example.com/logs',
        enableConsoleLogging: true,
      });

      await errorHandler.sendLogsToRemote();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        'Failed to send logs to remote endpoint:',
        expect.any(Error)
      );
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
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1150);

      const logger = errorHandler.getLogger();
      const timer = logger.createTimer(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        'TestComponent',
        'testOperation'
      );

      expect(timer.getElapsed()).toBe(150);

      await timer.end({ testMetadata: 'value' });

      const logs = errorHandler.getRecentLogs(10);
      expect(logs[0]).toMatchObject({
        level: 'info',
        category: FrontendPerformanceErrorCategory.LAZY_LOADING,
        component: 'TestComponent',
        operation: 'testOperation',
        message: expect.stringContaining('Operation completed in 150.00ms'),
        metadata: expect.objectContaining({
          testMetadata: 'value',
          duration: 150,
        }),
      });
    });

    it('should handle timer errors', async () => {
      const logger = errorHandler.getLogger();
      const timer = logger.createTimer(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        'TestComponent',
        'failingOperation'
      );

      const testError = new Error('Operation failed');
      await timer.endWithError(testError, { context: 'test' });

      const errors = errorHandler.getRecentErrors(10);
      expect(errors[0]).toMatchObject({
        category: FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        severity: FrontendPerformanceErrorSeverity.HIGH,
        operation: 'failingOperation',
        component: 'TestComponent',
        message: expect.stringContaining('Operation failed'),
      });
    });
  });

  describe('Global Instance', () => {
    it('should provide global error handler instance', () => {
      const globalHandler1 = getFrontendPerformanceErrorHandler();
      const globalHandler2 = getFrontendPerformanceErrorHandler();
      
      expect(globalHandler1).toBe(globalHandler2);
    });

    it('should provide global logger instance', () => {
      const globalLogger1 = getFrontendPerformanceLogger();
      const globalLogger2 = getFrontendPerformanceLogger();
      
      expect(globalLogger1).toBe(globalLogger2);
    });
  });
});