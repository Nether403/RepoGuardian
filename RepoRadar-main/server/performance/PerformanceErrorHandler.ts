import {
  IPerformanceErrorHandler,
  IPerformanceLogger,
  IOperationTimer,
  PerformanceError,
  PerformanceLogEntry,
  PerformanceErrorCategory,
  PerformanceErrorSeverity,
  ErrorHandlingConfig,
  ErrorHandlingStats,
} from './ErrorHandling';
import { v4 as uuidv4 } from 'uuid';

/**
 * Operation timer implementation
 */
class OperationTimer implements IOperationTimer {
  private startTime: number;
  private logger: IPerformanceLogger;
  private category: PerformanceErrorCategory;
  private component: string;
  private operation: string;

  constructor(
    logger: IPerformanceLogger,
    category: PerformanceErrorCategory,
    component: string,
    operation: string
  ) {
    this.startTime = Date.now();
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
    return Date.now() - this.startTime;
  }
}

/**
 * Performance logger implementation
 */
class PerformanceLogger implements IPerformanceLogger {
  private errorHandler: PerformanceErrorHandler;

  constructor(errorHandler: PerformanceErrorHandler) {
    this.errorHandler = errorHandler;
  }

  async debug(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('debug', category, operation, component, message, metadata);
  }

  async info(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('info', category, operation, component, message, metadata);
  }

  async warn(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.errorHandler.log('warn', category, operation, component, message, metadata);
  }

  async error(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (error) {
      await this.errorHandler.handleError(
        category,
        PerformanceErrorSeverity.HIGH,
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
    category: PerformanceErrorCategory,
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
      `Operation completed in ${duration}ms`,
      { ...metadata, duration }
    );
  }

  createTimer(
    category: PerformanceErrorCategory,
    component: string,
    operation: string
  ): IOperationTimer {
    return new OperationTimer(this, category, component, operation);
  }
}

/**
 * Comprehensive performance error handler implementation
 */
export class PerformanceErrorHandler implements IPerformanceErrorHandler {
  private errors: PerformanceError[] = [];
  private logs: PerformanceLogEntry[] = [];
  private config: ErrorHandlingConfig;
  private stats: ErrorHandlingStats;
  private logger: IPerformanceLogger;

  constructor(config?: Partial<ErrorHandlingConfig>) {
    this.config = {
      enableLogging: true,
      logLevel: 'info',
      maxLogEntries: 10000,
      logRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
      enableFallbackLogging: true,
      enableRecoveryLogging: true,
      enableMetricsCollection: true,
      ...config,
    };

    this.stats = {
      totalErrors: 0,
      errorsByCategory: {} as Record<PerformanceErrorCategory, number>,
      errorsBySeverity: {} as Record<PerformanceErrorSeverity, number>,
      fallbackActivations: 0,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      lastErrorTime: null,
      lastRecoveryTime: null,
    };

    // Initialize counters
    Object.values(PerformanceErrorCategory).forEach(category => {
      this.stats.errorsByCategory[category] = 0;
    });
    Object.values(PerformanceErrorSeverity).forEach(severity => {
      this.stats.errorsBySeverity[severity] = 0;
    });

    this.logger = new PerformanceLogger(this);
  }

  async handleError(
    category: PerformanceErrorCategory,
    severity: PerformanceErrorSeverity,
    operation: string,
    component: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<PerformanceError> {
    const performanceError: PerformanceError = {
      id: uuidv4(),
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

    // Console log for immediate visibility (in production, this would go to proper logging system)
    console.error(`[${category.toUpperCase()}] ${component}.${operation}: ${error.message}`, {
      errorId: performanceError.id,
      severity,
      metadata,
      stack: error.stack,
    });

    return performanceError;
  }

  async log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: PerformanceErrorCategory,
    operation: string,
    component: string,
    message: string,
    metadata?: Record<string, any>,
    duration?: number
  ): Promise<void> {
    if (!this.config.enableLogging || !this.shouldLog(level)) {
      return;
    }

    const logEntry: PerformanceLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category,
      message,
      operation,
      component,
      metadata,
      duration,
    };

    this.logs.push(logEntry);
    this.trimLogs();

    // Console log for immediate visibility
    const logMethod = level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';
    console[logMethod](`[${category.toUpperCase()}] ${component}.${operation}: ${message}`, metadata);
  }

  async logFallbackActivation(
    category: PerformanceErrorCategory,
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

  async logRecoveryAttempt(
    category: PerformanceErrorCategory,
    component: string,
    operation: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enableRecoveryLogging) {
      return;
    }

    this.stats.recoveryAttempts++;
    if (success) {
      this.stats.successfulRecoveries++;
      this.stats.lastRecoveryTime = new Date();
    }

    await this.log(
      success ? 'info' : 'warn',
      category,
      operation,
      component,
      `Recovery attempt ${success ? 'succeeded' : 'failed'}`,
      {
        ...metadata,
        recoveryAttempt: true,
        success,
      }
    );
  }

  getStats(): ErrorHandlingStats {
    return { ...this.stats };
  }

  getRecentErrors(limit: number = 100): PerformanceError[] {
    return this.errors
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecentLogs(limit: number = 100): PerformanceLogEntry[] {
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
        PerformanceErrorCategory.MONITORING,
        'cleanup',
        'PerformanceErrorHandler',
        `Cleaned up ${cleanedCount} old entries`,
        { cleanedErrors: initialErrorCount - this.errors.length, cleanedLogs: initialLogCount - this.logs.length }
      );
    }

    return cleanedCount;
  }

  configure(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the performance logger instance
   */
  getLogger(): IPerformanceLogger {
    return this.logger;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  private determineRecoveryAction(
    category: PerformanceErrorCategory,
    severity: PerformanceErrorSeverity,
    operation: string
  ): string {
    switch (category) {
      case PerformanceErrorCategory.DATABASE:
        return severity === PerformanceErrorSeverity.CRITICAL 
          ? 'Activate direct connection fallback and attempt pool recreation'
          : 'Retry with exponential backoff';
      
      case PerformanceErrorCategory.CACHE:
        return 'Fall back to direct data retrieval and attempt cache recovery';
      
      case PerformanceErrorCategory.COMPRESSION:
        return 'Fall back to uncompressed response delivery';
      
      case PerformanceErrorCategory.GITHUB_API:
        return 'Apply rate limit backoff and use cached data if available';
      
      case PerformanceErrorCategory.PAGINATION:
        return 'Return unpaginated results with warning';
      
      case PerformanceErrorCategory.MONITORING:
        return 'Continue operation without monitoring';
      
      case PerformanceErrorCategory.FALLBACK:
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
 * Global performance error handler instance
 */
let globalErrorHandler: PerformanceErrorHandler | null = null;

/**
 * Get or create the global performance error handler
 */
export function getPerformanceErrorHandler(config?: Partial<ErrorHandlingConfig>): PerformanceErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new PerformanceErrorHandler(config);
  }
  return globalErrorHandler;
}

/**
 * Get the global performance logger
 */
export function getPerformanceLogger(): IPerformanceLogger {
  return getPerformanceErrorHandler().getLogger();
}