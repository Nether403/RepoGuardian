/**
 * Comprehensive error handling and logging system for performance optimizations
 * Provides centralized error management, logging, and recovery strategies
 */

/**
 * Performance error categories
 */
export enum PerformanceErrorCategory {
  DATABASE = 'database',
  CACHE = 'cache',
  COMPRESSION = 'compression',
  GITHUB_API = 'github_api',
  PAGINATION = 'pagination',
  MONITORING = 'monitoring',
  FALLBACK = 'fallback',
}

/**
 * Performance error severity levels
 */
export enum PerformanceErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Performance error with context and metadata
 */
export interface PerformanceError {
  id: string;
  category: PerformanceErrorCategory;
  severity: PerformanceErrorSeverity;
  message: string;
  originalError: Error;
  timestamp: Date;
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  recoveryAction?: string;
  fallbackActivated?: boolean;
}

/**
 * Performance log entry
 */
export interface PerformanceLogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: PerformanceErrorCategory;
  message: string;
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  error?: PerformanceError;
  duration?: number;
  fallbackActivated?: boolean;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogEntries: number;
  logRetentionMs: number;
  enableFallbackLogging: boolean;
  enableRecoveryLogging: boolean;
  enableMetricsCollection: boolean;
}

/**
 * Error handling statistics
 */
export interface ErrorHandlingStats {
  totalErrors: number;
  errorsByCategory: Record<PerformanceErrorCategory, number>;
  errorsBySeverity: Record<PerformanceErrorSeverity, number>;
  fallbackActivations: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  lastErrorTime: Date | null;
  lastRecoveryTime: Date | null;
}

/**
 * Interface for performance error handler
 */
export interface IPerformanceErrorHandler {
  /**
   * Handle a performance error
   */
  handleError(
    category: PerformanceErrorCategory,
    severity: PerformanceErrorSeverity,
    operation: string,
    component: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<PerformanceError>;

  /**
   * Log a performance event
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: PerformanceErrorCategory,
    operation: string,
    component: string,
    message: string,
    metadata?: Record<string, any>,
    duration?: number
  ): Promise<void>;

  /**
   * Log fallback activation
   */
  logFallbackActivation(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Log recovery attempt
   */
  logRecoveryAttempt(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Get error handling statistics
   */
  getStats(): ErrorHandlingStats;

  /**
   * Get recent errors
   */
  getRecentErrors(limit?: number): PerformanceError[];

  /**
   * Get recent log entries
   */
  getRecentLogs(limit?: number): PerformanceLogEntry[];

  /**
   * Clear old logs and errors
   */
  cleanup(): Promise<number>;

  /**
   * Configure error handling
   */
  configure(config: Partial<ErrorHandlingConfig>): void;
}

/**
 * Interface for performance logger
 */
export interface IPerformanceLogger {
  /**
   * Log debug message
   */
  debug(category: PerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log info message
   */
  info(category: PerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log warning message
   */
  warn(category: PerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log error message
   */
  error(category: PerformanceErrorCategory, component: string, operation: string, message: string, error?: Error, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log operation timing
   */
  timing(category: PerformanceErrorCategory, component: string, operation: string, duration: number, metadata?: Record<string, any>): Promise<void>;

  /**
   * Create a timed operation logger
   */
  createTimer(category: PerformanceErrorCategory, component: string, operation: string): IOperationTimer;
}

/**
 * Interface for operation timing
 */
export interface IOperationTimer {
  /**
   * End the timer and log the duration
   */
  end(metadata?: Record<string, any>): Promise<void>;

  /**
   * End the timer with an error
   */
  endWithError(error: Error, metadata?: Record<string, any>): Promise<void>;

  /**
   * Get elapsed time without ending the timer
   */
  getElapsed(): number;
}