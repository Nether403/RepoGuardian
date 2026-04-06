/**
 * Frontend error handling and logging for performance optimizations
 * Provides client-side error management and logging for performance features
 */

/**
 * Frontend performance error categories
 */
export enum FrontendPerformanceErrorCategory {
  CODE_SPLITTING = 'code_splitting',
  LAZY_LOADING = 'lazy_loading',
  BUNDLE_OPTIMIZATION = 'bundle_optimization',
  CACHING = 'caching',
  FALLBACK = 'fallback',
}

/**
 * Frontend performance error severity levels
 */
export enum FrontendPerformanceErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Frontend performance error
 */
export interface FrontendPerformanceError {
  id: string;
  category: FrontendPerformanceErrorCategory;
  severity: FrontendPerformanceErrorSeverity;
  message: string;
  originalError: Error;
  timestamp: Date;
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  recoveryAction?: string;
  fallbackActivated?: boolean;
  userAgent?: string;
  url?: string;
}

/**
 * Frontend performance log entry
 */
export interface FrontendPerformanceLogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: FrontendPerformanceErrorCategory;
  message: string;
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  error?: FrontendPerformanceError;
  duration?: number;
  fallbackActivated?: boolean;
  userAgent?: string;
  url?: string;
}

/**
 * Frontend error handling configuration
 */
export interface FrontendErrorHandlingConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogEntries: number;
  logRetentionMs: number;
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  remoteLoggingEndpoint?: string;
  enableFallbackLogging: boolean;
  enablePerformanceMetrics: boolean;
}

/**
 * Frontend error handling statistics
 */
export interface FrontendErrorHandlingStats {
  totalErrors: number;
  errorsByCategory: Record<FrontendPerformanceErrorCategory, number>;
  errorsBySeverity: Record<FrontendPerformanceErrorSeverity, number>;
  fallbackActivations: number;
  lastErrorTime: Date | null;
  sessionStartTime: Date;
  userAgent: string;
}

/**
 * Interface for frontend performance error handler
 */
export interface IFrontendPerformanceErrorHandler {
  /**
   * Handle a frontend performance error
   */
  handleError(
    category: FrontendPerformanceErrorCategory,
    severity: FrontendPerformanceErrorSeverity,
    operation: string,
    component: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<FrontendPerformanceError>;

  /**
   * Log a frontend performance event
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: FrontendPerformanceErrorCategory,
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
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Get error handling statistics
   */
  getStats(): FrontendErrorHandlingStats;

  /**
   * Get recent errors
   */
  getRecentErrors(limit?: number): FrontendPerformanceError[];

  /**
   * Get recent log entries
   */
  getRecentLogs(limit?: number): FrontendPerformanceLogEntry[];

  /**
   * Clear old logs and errors
   */
  cleanup(): Promise<number>;

  /**
   * Configure error handling
   */
  configure(config: Partial<FrontendErrorHandlingConfig>): void;

  /**
   * Send logs to remote endpoint
   */
  sendLogsToRemote(): Promise<void>;
}

/**
 * Interface for frontend performance logger
 */
export interface IFrontendPerformanceLogger {
  /**
   * Log debug message
   */
  debug(category: FrontendPerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log info message
   */
  info(category: FrontendPerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log warning message
   */
  warn(category: FrontendPerformanceErrorCategory, component: string, operation: string, message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log error message
   */
  error(category: FrontendPerformanceErrorCategory, component: string, operation: string, message: string, error?: Error, metadata?: Record<string, any>): Promise<void>;

  /**
   * Log operation timing
   */
  timing(category: FrontendPerformanceErrorCategory, component: string, operation: string, duration: number, metadata?: Record<string, any>): Promise<void>;

  /**
   * Create a timed operation logger
   */
  createTimer(category: FrontendPerformanceErrorCategory, component: string, operation: string): IFrontendOperationTimer;
}

/**
 * Interface for frontend operation timing
 */
export interface IFrontendOperationTimer {
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

/**
 * Generate unique ID for errors and logs
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Frontend operation timer implementation
 */
class FrontendOperationTimer implements IFrontendOperationTimer {
  private startTime: number;
  private logger: IFrontendPerformanceLogger;
  private category: FrontendPerformanceErrorCategory;
  private component: string;
  private operation: string;

  constructor(
    logger: IFrontendPerformanceLogger,
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string
  ) {
    this.startTime = performance.now();
    this.logger = logger;
    this.category = category;
    this.component = component;
    this.operation = operation;
  }

  async end(metadata?: Record<string, any>): Promise<void> {
    const duration = this.getElapsed();
    await this.logger.timing(this.category, this.component, this.operation, duration, metadata);
  }

  async endWithError(error: Error, metadata?: Record<string, any>): Promise<void> {
    const duration = this.getElapsed();
    await this.logger.error(
      this.category,
      this.component,
      this.operation,
      `Operation failed after ${duration}ms: ${error.message}`,
      error,
      { ...metadata, duration }
    );
  }

  getElapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Frontend performance logger implementation
 */
class FrontendPerformanceLogger implements IFrontendPerformanceLogger {
  private errorHandler: FrontendPerformanceErrorHandler;

  constructor(errorHandler: FrontendPerformanceErrorHandler) {
    this.errorHandler = errorHandler;
  }

  async debug(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('debug', category, operation, component, message, metadata);
  }

  async info(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('info', category, operation, component, message, metadata);
  }

  async warn(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('warn', category, operation, component, message, metadata);
  }

  async error(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (error) {
      await this.errorHandler.handleError(
        category,
        FrontendPerformanceErrorSeverity.HIGH,
        operation,
        component,
        error,
        metadata
      );
    } else {
      await this.errorHandler.log('error', category, operation, component, message, metadata);
    }
  }

  async timing(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log(
      'info',
      category,
      operation,
      component,
      `Operation completed in ${duration.toFixed(2)}ms`,
      { ...metadata, duration }
    );
  }

  createTimer(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string
  ): IFrontendOperationTimer {
    return new FrontendOperationTimer(this, category, component, operation);
  }
}

/**
 * Frontend performance error handler implementation
 */
export class FrontendPerformanceErrorHandler implements IFrontendPerformanceErrorHandler {
  private errors: FrontendPerformanceError[] = [];
  private logs: FrontendPerformanceLogEntry[] = [];
  private config: FrontendErrorHandlingConfig;
  private stats: FrontendErrorHandlingStats;
  private logger: IFrontendPerformanceLogger;
  private sessionStartTime = new Date();

  constructor(config?: Partial<FrontendErrorHandlingConfig>) {
    this.config = {
      enableLogging: true,
      logLevel: 'info',
      maxLogEntries: 1000,
      logRetentionMs: 60 * 60 * 1000, // 1 hour
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      enableFallbackLogging: true,
      enablePerformanceMetrics: true,
      ...config,
    };

    this.stats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<FrontendPerformanceErrorCategory, number>,
      errorsBySeverity: {} as Record<FrontendPerformanceErrorSeverity, number>,
      fallbackActivations: 0,
      lastErrorTime: null,
      sessionStartTime: this.sessionStartTime,
      userAgent: navigator.userAgent,
    };

    // Initialize counters
    Object.values(FrontendPerformanceErrorCategory).forEach(category => {
      this.stats.errorsByCategory[category] = 0;
    });
    Object.values(FrontendPerformanceErrorSeverity).forEach(severity => {
      this.stats.errorsBySeverity[severity] = 0;
    });

    this.logger = new FrontendPerformanceLogger(this);
  }

  async handleError(
    category: FrontendPerformanceErrorCategory,
    severity: FrontendPerformanceErrorSeverity,
    operation: string,
    component: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<FrontendPerformanceError> {
    const performanceError: FrontendPerformanceError = {
      id: generateId(),
      category,
      severity,
      message: error.message,
      originalError: error,
      timestamp: new Date(),
      operation,
      component,
      metadata,
      stackTrace: error.stack,
      recoveryAction: this.determineRecoveryAction(category, severity, operation),
      fallbackActivated: false,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Update statistics
    this.stats.totalErrors++;
    this.stats.errorsByCategory[category]++;
    this.stats.errorsBySeverity[severity]++;
    this.stats.lastErrorTime = performanceError.timestamp;

    // Store error
    this.errors.push(performanceError);
    this.trimErrors();

    // Log the error
    if (this.config.enableLogging) {
      await this.log(
        'error',
        category,
        operation,
        component,
        `${severity.toUpperCase()} error: ${error.message}`,
        {
          ...metadata,
          errorId: performanceError.id,
          stackTrace: error.stack,
          recoveryAction: performanceError.recoveryAction,
        }
      );
    }

    // Console log for immediate visibility
    if (this.config.enableConsoleLogging) {
      console.error(`[${category.toUpperCase()}] ${component}.${operation}: ${error.message}`, {
        errorId: performanceError.id,
        severity,
        metadata,
        stack: error.stack,
      });
    }

    return performanceError;
  }

  async log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: FrontendPerformanceErrorCategory,
    operation: string,
    component: string,
    message: string,
    metadata?: Record<string, any>,
    duration?: number
  ): Promise<void> {
    if (!this.config.enableLogging || !this.shouldLog(level)) {
      return;
    }

    const logEntry: FrontendPerformanceLogEntry = {
      id: generateId(),
      timestamp: new Date(),
      level,
      category,
      message,
      operation,
      component,
      metadata,
      duration,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.logs.push(logEntry);
    this.trimLogs();

    // Console log for immediate visibility
    if (this.config.enableConsoleLogging) {
      const logMethod = level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';
      console[logMethod](`[${category.toUpperCase()}] ${component}.${operation}: ${message}`, metadata);
    }
  }

  async logFallbackActivation(
    category: FrontendPerformanceErrorCategory,
    component: string,
    operation: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enableFallbackLogging) {
      return;
    }

    this.stats.fallbackActivations++;

    await this.log(
      'warn',
      category,
      operation,
      component,
      `Fallback activated: ${reason}`,
      {
        ...metadata,
        fallbackActivated: true,
        reason,
      }
    );
  }

  getStats(): FrontendErrorHandlingStats {
    return { ...this.stats };
  }

  getRecentErrors(limit: number = 100): FrontendPerformanceError[] {
    return this.errors
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecentLogs(limit: number = 100): FrontendPerformanceLogEntry[] {
    return this.logs
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async cleanup(): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.config.logRetentionMs);
    
    const initialErrorCount = this.errors.length;
    const initialLogCount = this.logs.length;

    this.errors = this.errors.filter(error => error.timestamp > cutoffTime);
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

    const cleanedCount = (initialErrorCount - this.errors.length) + (initialLogCount - this.logs.length);
    
    if (cleanedCount > 0) {
      await this.log(
        'info',
        FrontendPerformanceErrorCategory.FALLBACK,
        'cleanup',
        'FrontendPerformanceErrorHandler',
        `Cleaned up ${cleanedCount} old entries`,
        { cleanedErrors: initialErrorCount - this.errors.length, cleanedLogs: initialLogCount - this.logs.length }
      );
    }

    return cleanedCount;
  }

  configure(config: Partial<FrontendErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async sendLogsToRemote(): Promise<void> {
    if (!this.config.enableRemoteLogging || !this.config.remoteLoggingEndpoint) {
      return;
    }

    try {
      const payload = {
        errors: this.getRecentErrors(50),
        logs: this.getRecentLogs(100),
        stats: this.getStats(),
        timestamp: new Date().toISOString(),
      };

      await fetch(this.config.remoteLoggingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Don't log remote logging errors to avoid infinite loops
      if (this.config.enableConsoleLogging) {
        console.warn('Failed to send logs to remote endpoint:', error);
      }
    }
  }

  /**
   * Get the frontend performance logger instance
   */
  getLogger(): IFrontendPerformanceLogger {
    return this.logger;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  private determineRecoveryAction(
    category: FrontendPerformanceErrorCategory,
    severity: FrontendPerformanceErrorSeverity,
    operation: string
  ): string {
    switch (category) {
      case FrontendPerformanceErrorCategory.CODE_SPLITTING:
        return 'Fall back to synchronous component loading';
      
      case FrontendPerformanceErrorCategory.LAZY_LOADING:
        return 'Fall back to immediate component rendering';
      
      case FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION:
        return 'Continue with unoptimized bundle loading';
      
      case FrontendPerformanceErrorCategory.CACHING:
        return 'Continue without caching optimization';
      
      case FrontendPerformanceErrorCategory.FALLBACK:
        return 'Log failure and continue with degraded performance';
      
      default:
        return 'Log error and continue operation';
    }
  }

  private trimErrors(): void {
    if (this.errors.length > this.config.maxLogEntries) {
      this.errors = this.errors.slice(-this.config.maxLogEntries);
    }
  }

  private trimLogs(): void {
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }
}

/**
 * Global frontend performance error handler instance
 */
let globalFrontendErrorHandler: FrontendPerformanceErrorHandler | null = null;

/**
 * Get or create the global frontend performance error handler
 */
export function getFrontendPerformanceErrorHandler(config?: Partial<FrontendErrorHandlingConfig>): FrontendPerformanceErrorHandler {
  if (!globalFrontendErrorHandler) {
    globalFrontendErrorHandler = new FrontendPerformanceErrorHandler(config);
  }
  return globalFrontendErrorHandler;
}

/**
 * Get the global frontend performance logger
 */
export function getFrontendPerformanceLogger(): IFrontendPerformanceLogger {
  return getFrontendPerformanceErrorHandler().getLogger();
}