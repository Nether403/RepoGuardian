import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, correlationStorage, type LogEntry } from '../Logger';

describe('StructuredLogger', () => {
  beforeEach(() => {
    // Clear any custom handlers
    vi.clearAllMocks();
  });

  describe('Correlation ID', () => {
    it('should track correlation ID in async context', () => {
      const correlationId = 'test-correlation-id';
      
      logger.withCorrelationId(correlationId, () => {
        expect(logger.getCorrelationId()).toBe(correlationId);
      });
    });

    it('should return undefined when no correlation ID is set', () => {
      expect(logger.getCorrelationId()).toBeUndefined();
    });

    it('should maintain correlation ID across async operations', async () => {
      const correlationId = 'async-test-id';
      
      await logger.withCorrelationId(correlationId, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(logger.getCorrelationId()).toBe(correlationId);
      });
    });
  });

  describe('Logging Levels', () => {
    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'debug');
      
      logger.setLevel('debug');
      logger.debug('Test debug message');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      logger.info('Test info message');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      logger.warn('Test warning message');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      const error = new Error('Test error');
      logger.error('Test error message', error);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect minimum log level', () => {
      const consoleSpy = vi.spyOn(console, 'debug');
      
      logger.setLevel('warn');
      logger.debug('Should not be logged');
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Log Context', () => {
    it('should include error details in log entries', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      logger.error('Error occurred', error);
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should not throw if handler fails', () => {
      const failingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      logger.addHandler(failingHandler);
      
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();
    });
  });
});
