import { instanceId } from '../instanceId.js';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Structured Logger with Correlation IDs
 * Provides consistent logging format with request tracking
 */

// AsyncLocalStorage for correlation ID tracking
const correlationStorage = new AsyncLocalStorage<string>();

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  instanceId: string;
  correlationId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StructuredLogger {
  private minLevel: LogLevel = 'info';
  private logHandlers: Array<(entry: LogEntry) => void> = [];

  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
      this.minLevel = envLevel;
    }

    // Add default console handler
    this.addHandler((entry) => {
      const output = this.formatForConsole(entry);
      switch (entry.level) {
        case 'error':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        case 'debug':
          console.debug(output);
          break;
        default:
          console.log(output);
      }
    });
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Add custom log handler
   */
  addHandler(handler: (entry: LogEntry) => void): void {
    this.logHandlers.push(handler);
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return correlationStorage.getStore();
  }

  /**
   * Set correlation ID for current async context
   */
  setCorrelationId(correlationId: string): void {
    // This should be called within AsyncLocalStorage.run()
  }

  /**
   * Run function with correlation ID
   */
  withCorrelationId<T>(correlationId: string, fn: () => T): T {
    return correlationStorage.run(correlationId, fn);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : context;

    this.log('error', message, errorContext);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check if level should be logged
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      instanceId: instanceId.getId(),
      correlationId: this.getCorrelationId(),
      context,
    };

    // Call all handlers
    for (const handler of this.logHandlers) {
      try {
        handler(entry);
      } catch (error) {
        // Don't let handler errors break logging
        console.error('Log handler error:', error);
      }
    }
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Format log entry for console output
   */
  private formatForConsole(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      `[${entry.instanceId}]`,
    ];

    if (entry.correlationId) {
      parts.push(`[${entry.correlationId}]`);
    }

    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    return parts.join(' ');
  }

  /**
   * Format log entry as JSON
   */
  toJSON(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

// Export singleton instance
export const logger = new StructuredLogger();

// Export AsyncLocalStorage for middleware use
export { correlationStorage };
